/** @typedef {import('../..').AbstractDatabase} AbstractDatabase */
/** @typedef {import('../..').Table} Table */
/** @typedef {import('../..').TableColumn} TableColumn */
/** @typedef {import('../..').TablePrimary} TablePrimary */
/** @typedef {import('../..').TableIndex} TableIndex */
/** @typedef {import('../..').TableUnique} TableUnique */
/** @typedef {import('../..').Operation} Operation */
/** @typedef {import('../..').OperationType} OperationType */

const shallowEqualArrays = require('shallow-equal/arrays')
const shallowEqualObjects = require('shallow-equal/objects')

/**
 * @param {AbstractDatabase} from
 * @param {AbstractDatabase} to
 * @returns {Promise.<Operation[]>}
 */
module.exports = async function (from, to) {
  const differ = new Differ(from, to)
  return differ.diff()
}

class Differ {
  /**
   * @param {AbstractDatabase} from
   * @param {AbstractDatabase} to
   */
  constructor (from, to) {
    this.from = from
    this.to = to
    /** @type {Operation[]} */
    this.operations = []
  }

  /**
   * @returns {Operation[]}
   */
  diff () {
    this.operations.length = 0

    /** @type {{ fromTable: Table, toTable: Table }[]} */
    const sameTableQueue = []
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

      /** @type {{ fromCol:TableColumn, toCol: TableColumn }[]} */
      const sameColumnQueue = []
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
        /** @param {TableIndex} index */
        index => this.createIndex(toTable, index),
        /** @param {TableIndex} index */
        index => this.dropIndex(fromTable, index)
      )

      // Unique contraint
      this.compareIndex(
        fromTable.uniques,
        toTable.uniques,
        /** @param {TableUnique} index */
        index => this.createUnique(toTable, index),
        /** @param {TableUnique} index */
        index => this.dropUnique(fromTable, index)
      )
    }

    return this.operations
  }

  /**
   * @param {Table} table
   */
  createTable (table) {
    /** @type {import('../../types/Operation').TableCreateOperation} */
    const op = {
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

  /**
   * @param {Table} fromTable
   * @param {Table} toTable
   */
  renameTable (fromTable, toTable) {
    /** @type {import('../../types/Operation').TableRenameOperation} */
    const op = {
      type: 'table.rename',
      fromName: fromTable.name,
      toName: toTable.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   */
  dropTable (table) {
    /** @type {import('../../types/Operation').TableDropOperation} */
    const op = {
      type: 'table.drop',
      table: table.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   */
  setTableComment (table) {
    /** @type {import('../../types/Operation').TableCommentSetOperation} */
    const op = {
      type: 'table.comment.set',
      table: table.name,
      comment: table.comment,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TablePrimary | null} index
   */
  setPrimary (table, index) {
    /** @type {import('../../types/Operation').TablePrimarySetOperation} */
    const op = {
      type: 'table.primary.set',
      table: table.name,
      columns: index ? index.columns : null,
      indexName: index ? index.name : null,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableIndex} index
   */
  createIndex (table, index) {
    /** @type {import('../../types/Operation').TableIndexCreateOperation} */
    const op = {
      type: 'table.index.create',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
      indexType: index.type,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableIndex} index
   */
  dropIndex (table, index) {
    /** @type {import('../../types/Operation').TableIndexDropOperation} */
    const op = {
      type: 'table.index.drop',
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
  createUnique (table, index) {
    /** @type {import('../../types/Operation').TableUniqueCreateOperation} */
    const op = {
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
  dropUnique (table, index) {
    /** @type {import('../../types/Operation').TableUniqueDropOperation} */
    const op = {
      type: 'table.unique.drop',
      table: table.name,
      columns: index.columns,
      indexName: index.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  createForeignKey (table, column) {
    if (column.foreign) {
      /** @type {import('../../types/Operation').TableForeignCreateOperation} */
      const op = {
        type: 'table.foreign.create',
        table: table.name,
        column: column.name,
        reference: `${column.foreign.tableName}.${column.foreign.columnName}`,
      }
      this.operations.push(op)
    }
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  dropForeignKey (table, column) {
    if (column.foreign) {
      /** @type {import('../../types/Operation').TableForeignDropOperation} */
      const op = {
        type: 'table.foreign.drop',
        table: table.name,
        column: column.name,
      }
      this.operations.push(op)
    }
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  createColumn (table, column) {
    /** @type {import('../../types/Operation').ColumnCreateOperation} */
    const op = {
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

  /**
   * @param {Table} table
   * @param {TableColumn} fromCol
   * @param {TableColumn} toCol
   */
  renameColumn (table, fromCol, toCol) {
    /** @type {import('../../types/Operation').ColumnRenameOperation} */
    const op = {
      type: 'column.rename',
      table: table.name,
      fromName: fromCol.name,
      toName: toCol.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  setColumnType (table, column) {
    /** @type {import('../../types/Operation').ColumnTypeSetOperation} */
    const op = {
      type: 'column.type.set',
      table: table.name,
      column: column.name,
      columnType: column.type,
      args: column.args,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  setColumnComment (table, column) {
    /** @type {import('../../types/Operation').ColumnCommentSetOperation} */
    const op = {
      type: 'column.comment.set',
      table: table.name,
      column: column.name,
      comment: column.comment,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  setColumnNullable (table, column) {
    /** @type {import('../../types/Operation').ColumnNullableSetOperation} */
    const op = {
      type: 'column.nullable.set',
      table: table.name,
      column: column.name,
      nullable: !column.notNull,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  setColumnDefaultValue (table, column) {
    /** @type {import('../../types/Operation').ColumnDefaultSetOperation} */
    const op = {
      type: 'column.default.set',
      table: table.name,
      column: column.name,
      value: column.defaultValue,
    }
    this.operations.push(op)
  }

  /**
   * @param {Table} table
   * @param {TableColumn} column
   */
  dropColumn (table, column) {
    /** @type {import('../../types/Operation').ColumnDropOperation} */
    const op = {
      type: 'column.drop',
      table: table.name,
      column: column.name,
    }
    this.operations.push(op)
  }

  /**
   * @param {(TableIndex | TableUnique)[]} fromList
   * @param {(TableIndex | TableUnique)[]} toList
   * @param {(index: TableIndex | TableUnique) => void} create
   * @param {(index: TableIndex | TableUnique) => void} drop
   */
  compareIndex (fromList, toList, create, drop) {
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
