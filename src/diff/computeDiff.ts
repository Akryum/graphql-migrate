import { AbstractDatabase } from '../abstract/AbstractDatabase'
import { Table, TablePrimary, TableIndex, TableUnique } from '../abstract/Table'
import { TableColumn } from '../abstract/TableColumn'
import * as Operations from './Operation'

// @ts-ignore
import shallowEqualArrays from 'shallow-equal/arrays'
// @ts-ignore
import shallowEqualObjects from 'shallow-equal/objects'

export default async function(from: AbstractDatabase, to: AbstractDatabase): Promise<Operations.Operation []> {
  const differ = new Differ(from, to)
  return differ.diff()
}

class Differ {
  private from: AbstractDatabase
  private to: AbstractDatabase
  private operations: Operations.Operation[] = []

  constructor(from: AbstractDatabase, to: AbstractDatabase) {
    this.from = from
    this.to = to
  }

  public diff(): Operations.Operation[] {
    this.operations.length = 0

    const sameTableQueue: Array<{ fromTable: Table, toTable: Table }> = []
    const addTableQueue = this.to.tables.slice()
    for (const fromTable of this.from.tables) {
      let removed = true
      for (let i = 0, l = addTableQueue.length; i < l; i++) {
        const toTable = addTableQueue[i]
        // Same table
        if (toTable.name === fromTable.name) {
          removed = false
        }

        // Rename table
        const { annotations } = toTable
        if (annotations && annotations.oldNames && annotations.oldNames.includes(fromTable.name)) {
          removed = false
          this.renameTable(fromTable, toTable)
        }

        // Same or Rename
        if (!removed) {
          sameTableQueue.push({ fromTable, toTable })
          // A new table shouldn't be added
          addTableQueue.splice(i, 1)
          break
        }
      }

      // Drop table
      if (removed) {
        this.dropTable(fromTable)
      }
    }

    // Create table
    for (const toTable of addTableQueue) {
      this.createTable(toTable)
    }

    // Compare tables
    for (const { fromTable, toTable } of sameTableQueue) {
      // Comment
      if (fromTable.comment !== toTable.comment) {
        this.setTableComment(toTable)
      }

      const sameColumnQueue: Array<{ fromCol: TableColumn, toCol: TableColumn }> = []
      const addColumnQueue = toTable.columns.slice()
      for (const fromCol of fromTable.columns) {
        let removed = true
        for (let i = 0, l = addColumnQueue.length; i < l; i++) {
          const toCol = addColumnQueue[i]
          // Same column
          if (toCol.name === fromCol.name) {
            removed = false
          }

          // Rename column
          const { annotations } = toCol
          if (annotations && annotations.oldNames && annotations.oldNames.includes(fromCol.name)) {
            removed = false
            this.renameColumn(toTable, fromCol, toCol)
          }

          // Same or Rename
          if (!removed) {
            sameColumnQueue.push({ fromCol, toCol })
            // A new table shouldn't be added
            addColumnQueue.splice(i, 1)
            break
          }
        }

        // Drop column
        if (removed) {
          this.dropColumn(fromTable, fromCol)
        }
      }

      // Add columns
      for (const column of addColumnQueue) {
        this.createColumn(toTable, column)
      }

      // Compare columns
      for (const { fromCol, toCol } of sameColumnQueue) {
        // Comment
        if (fromCol.comment !== toCol.comment) {
          this.setColumnComment(toTable, toCol)
        }

        // Type
        if (fromCol.type !== toCol.type || !shallowEqualArrays(fromCol.args, toCol.args)) {
          this.setColumnType(toTable, toCol)
        }

        // Not null
        if (fromCol.notNull !== toCol.notNull) {
          this.setColumnNullable(toTable, toCol)
        }

        // Default value
        if (
          fromCol.defaultValue !== toCol.defaultValue ||
          (Array.isArray(fromCol.defaultValue) && !shallowEqualArrays(fromCol.defaultValue, toCol.defaultValue)) ||
          (typeof fromCol.defaultValue === 'object' && !shallowEqualObjects(fromCol.defaultValue, toCol.defaultValue))
        ) {
          this.setColumnDefaultValue(toTable, toCol)
        }

        // Foreign key
        if (fromCol.foreign !== toCol.foreign || !shallowEqualObjects(fromCol.foreign, toCol.foreign)) {
          this.dropForeignKey(toTable, fromCol)
          this.createForeignKey(toTable, toCol)
        }
      }

      // Primary index
      if (!shallowEqualArrays(fromTable.primaries, toTable.primaries)) {
        const [index] = toTable.primaries
        this.setPrimary(toTable, index)
      }

      // Index
      this.compareIndex(
        fromTable.indexes,
        toTable.indexes,
        // @ts-ignore
        (index: TableIndex) => this.createIndex(toTable, index),
        (index: TableIndex) => this.dropIndex(fromTable, index),
      )

      // Unique contraint
      this.compareIndex(
        fromTable.uniques,
        toTable.uniques,
        (index: TableUnique) => this.createUnique(toTable, index),
        (index: TableUnique) => this.dropUnique(fromTable, index),
      )
    }

    return this.operations
  }

  private createTable(table: Table) {
    const op: Operations.TableCreateOperation = {
      type: 'table.create',
      table: table.name,
    }
    this.operations.push(op)

    // Comment
    if (table.comment) {
      this.setTableComment(table)
    }

    // Columns
    for (const column of table.columns) {
      this.createColumn(table, column)
    }

    // Primary index
    if (table.primaries.length) {
      const [index] = table.primaries
      this.setPrimary(table, index)
    }

    // Index
    for (const index of table.indexes) {
      this.createIndex(table, index)
    }

    // Unique contraint
    for (const index of table.uniques) {
      this.createUnique(table, index)
    }
  }

  private renameTable(fromTable: Table, toTable: Table) {
    const op: Operations.TableRenameOperation = {
      type: 'table.rename',
      fromName: fromTable.name,
      toName: toTable.name,
    }
    this.operations.push(op)
  }

  private dropTable(table: Table) {
    const op: Operations.TableDropOperation = {
      type: 'table.drop',
      table: table.name,
    }
    this.operations.push(op)
  }

  private setTableComment(table: Table) {
    const op: Operations.TableCommentSetOperation = {
      type: 'table.comment.set',
      table: table.name,
      comment: table.comment,
    }
    this.operations.push(op)
  }

  private setPrimary(table: Table, index: TablePrimary | null) {
    const op: Operations.TablePrimarySetOperation = {
      type: 'table.primary.set',
      table: table.name,
      columns: index ? index.columns : null,
      indexName: index ? index.name : null,
    }
    this.operations.push(op)
  }

  private createIndex(table: Table, index: TableIndex) {
    const op: Operations.TableIndexCreateOperation = {
      type: 'table.index.create',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
      indexType: index.type,
    }
    this.operations.push(op)
  }

  private dropIndex(table: Table, index: TableIndex) {
    const op: Operations.TableIndexDropOperation = {
      type: 'table.index.drop',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
    }
    this.operations.push(op)
  }

  private createUnique(table: Table, index: TableUnique) {
    const op: Operations.TableUniqueCreateOperation = {
      type: 'table.unique.create',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableUnique} index
   */
  private dropUnique(table: Table, index: TableUnique) {
    const op: Operations.TableUniqueDropOperation = {
      type: 'table.unique.drop',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
    }
    this.operations.push(op)
  }

  private createForeignKey(table: Table, column: TableColumn) {
    if (column.foreign) {
      const op: Operations.TableForeignCreateOperation = {
        type: 'table.foreign.create',
        table: table.name,
        column: column.name,
        reference: `${column.foreign.tableName}.${column.foreign.columnName}`,
      }
      this.operations.push(op)
    }
  }

  private dropForeignKey(table: Table, column: TableColumn) {
    if (column.foreign) {
      const op: Operations.TableForeignDropOperation = {
        type: 'table.foreign.drop',
        table: table.name,
        column: column.name,
      }
      this.operations.push(op)
    }
  }

  private createColumn(table: Table, column: TableColumn) {
    const op: Operations.ColumnCreateOperation = {
      type: 'column.create',
      table: table.name,
      column: column.name,
      columnType: column.type,
      args: column.args,
    }
    this.operations.push(op)

    // Comment
    if (column.comment) {
      this.setColumnComment(table, column)
    }

    // Not null
    if (column.notNull) {
      this.setColumnNullable(table, column)
    }

    // Default value
    if (typeof column.defaultValue !== 'undefined') {
      this.setColumnDefaultValue(table, column)
    }

    // Foreign key
    this.createForeignKey(table, column)
  }

  private renameColumn(table: Table, fromCol: TableColumn, toCol: TableColumn) {
    const op: Operations.ColumnRenameOperation = {
      type: 'column.rename',
      table: table.name,
      fromName: fromCol.name,
      toName: toCol.name,
    }
    this.operations.push(op)
  }

  private setColumnType(table: Table, column: TableColumn) {
    const op: Operations.ColumnTypeSetOperation = {
      type: 'column.type.set',
      table: table.name,
      column: column.name,
      columnType: column.type,
      args: column.args,
    }
    this.operations.push(op)
  }

  private setColumnComment(table: Table, column: TableColumn) {
    const op: Operations.ColumnCommentSetOperation = {
      type: 'column.comment.set',
      table: table.name,
      column: column.name,
      comment: column.comment,
    }
    this.operations.push(op)
  }

  private setColumnNullable(table: Table, column: TableColumn) {
    const op: Operations.ColumnNullableSetOperation = {
      type: 'column.nullable.set',
      table: table.name,
      column: column.name,
      nullable: !column.notNull,
    }
    this.operations.push(op)
  }

  private setColumnDefaultValue(table: Table, column: TableColumn) {
    const op: Operations.ColumnDefaultSetOperation = {
      type: 'column.default.set',
      table: table.name,
      column: column.name,
      value: column.defaultValue,
    }
    this.operations.push(op)
  }

  private dropColumn(table: Table, column: TableColumn) {
    const op: Operations.ColumnDropOperation = {
      type: 'column.drop',
      table: table.name,
      column: column.name,
    }
    this.operations.push(op)
  }

  private compareIndex(
    fromList: Array<TableIndex | TableUnique>,
    toList: Array<TableIndex | TableUnique>,
    create: (index: TableIndex | TableUnique) => void,
    drop: (index: TableIndex | TableUnique) => void,
  ) {
    const addIndexQueue = toList.slice()
    for (const fromIndex of fromList) {
      let removed = true
      for (let i = 0, l = addIndexQueue.length; i < l; i++) {
        const toIndex = addIndexQueue[i]
        if (
          fromIndex.name === toIndex.name &&
          // @ts-ignore
          fromIndex.type === toIndex.type &&
          shallowEqualArrays(fromIndex.columns.sort(), toIndex.columns.sort())
        ) {
          removed = false
          addIndexQueue.splice(i, 1)
          break
        }
      }

      if (removed) {
        drop(fromIndex)
      }
    }
    for (const index of addIndexQueue) {
      create(index)
    }
  }
}
