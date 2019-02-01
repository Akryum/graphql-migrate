// eslint-disable-next-line import/no-duplicates
import * as Operations from '../diff/Operation'
// eslint-disable-next-line import/no-duplicates
import { Operation, OperationType } from '../diff/Operation'
import Knex, { Config, CreateTableBuilder, TableBuilder } from 'knex'

const CREATE_TABLE_CHILD_OPS: OperationType[] = [
  'table.comment.set',
  'table.foreign.create',
  'table.index.create',
  'table.unique.create',
  'table.primary.set',
  'column.create',
]

const ALTER_TABLE_CHILD_OPS: OperationType[] = [
  ...CREATE_TABLE_CHILD_OPS,
  'column.rename',
  'column.alter',
  'column.drop',
]

/**
 * @param {Operation[]} operations
 * @param {Config} config Knex configuration
 * @param {string} schemaName Table schema prefix: `<schemaName>.<tableName>`
 * @param {string} prefix Table and column name prefix: `<prefix><tableName>`
 */
export default async function (operations: Operation[], config: Config, schemaName = 'public', prefix = '') {
  const writer = new Writer(operations, config, schemaName, prefix)
  return writer.write()
}

class Writer {
  private operations: Operation[]
  private config: Config
  private schemaName: string
  private prefix: string
  private knex: Knex
  // @ts-ignore
  private trx: Knex.Transaction

  constructor (operations: Operation[], config: Config, schemaName = 'public', prefix = '') {
    this.operations = operations
    this.config = config
    this.schemaName = schemaName
    this.prefix = prefix
    this.knex = Knex(config)
  }

  public async write () {
    await this.knex.transaction(async (trx) => {
      this.trx = trx
      let op: Operation | undefined
      while ((op = this.operations.shift())) {
        switch (op.type) {
        case 'table.create':
          await this.createTable(op as Operations.TableCreateOperation)
          break
        case 'table.rename':
          const trop = (op as Operations.TableRenameOperation)
          await this.trx.schema.withSchema(this.schemaName).renameTable(this.getName(trop.fromName), this.getName(trop.toName))
          break
        case 'table.drop':
          const tdop = (op as Operations.TableDropOperation)
          await this.trx.schema.withSchema(this.schemaName).dropTable(this.getName(tdop.table))
          break
        default:
          await this.alterTable((op as any).table)
        }
      }
    })
  }

  private getName (name: string) {
    return `${this.prefix}${name}`
  }

  private getNames (names: string[]) {
    return names.map(name => this.getName(name))
  }

  private removeOperation (op: Operation) {
    const index = this.operations.indexOf(op)
    if (index !== -1) { this.operations.splice(index, 1) }
  }

  private async createTable (op: Operations.TableCreateOperation) {
    await this.trx.schema.withSchema(this.schemaName).createTable(this.getName(op.table), (table) => {
      const childOps: Operation[] = this.operations.filter(
        (child) => CREATE_TABLE_CHILD_OPS.includes(child.type) &&
        (child as any).table === op.table,
      )
      for (const childOp of childOps) {
        switch (childOp.type) {
        case 'column.create':
          this.createColumn(childOp as Operations.ColumnCreateOperation, table)
          break
        case 'table.comment.set':
          table.comment((childOp as Operations.TableCommentSetOperation).comment || '')
          break
        case 'table.foreign.create':
          const tfop = (childOp as Operations.TableForeignCreateOperation)
          table.foreign(this.getName(tfop.column)).references(`${this.getName(tfop.referenceTable)}.${this.getName(tfop.referenceColumn)}`)
          break
        case 'table.index.create':
          const tiop = (childOp as Operations.TableIndexCreateOperation)
          table.index(this.getNames(tiop.columns), tiop.indexName || undefined, tiop.indexType || undefined)
          break
        case 'table.unique.create':
          const tuop = (childOp as Operations.TableUniqueCreateOperation)
          table.unique(this.getNames(tuop.columns), tuop.indexName || undefined)
          break
        case 'table.primary.set':
          const tpop = (childOp as Operations.TablePrimarySetOperation)
          if (tpop.columns) { table.primary(this.getNames(tpop.columns)) }
          break
        }
        this.removeOperation(childOp)
      }
    })
  }

  private createColumn (op: Operations.ColumnCreateOperation, table: CreateTableBuilder) {
    if (op.columnType in table) {
      // @ts-ignore
      let col: Knex.ColumnBuilder = table[op.columnType](this.getName(op.column), ...op.args)
      if (op.comment) {
        col = col.comment(op.comment)
      }
      if (op.nullable) {
        col = col.nullable()
      } else {
        col = col.notNullable()
      }
      if (typeof op.defaultValue !== 'undefined') {
        col = col.defaultTo(op.defaultValue)
      }
      return col
    } else {
      throw new Error(`Table ${op.table} column ${op.column}: Unsupported column type ${op.columnType}`)
    }
  }

  private async alterTable (tableName: string) {
    await this.trx.schema.withSchema(this.schemaName).alterTable(this.getName(tableName), (table) => {
      const childOps = this.operations.filter(
        (child) => ALTER_TABLE_CHILD_OPS.includes(child.type) &&
        (child as any).table === tableName,
      )
      for (const childOp of childOps) {
        switch (childOp.type) {
        case 'table.comment.set':
          table.comment((childOp as Operations.TableCommentSetOperation).comment || '')
          break
        case 'table.foreign.create':
          const tfop = (childOp as Operations.TableForeignCreateOperation)
          table.foreign(this.getName(tfop.column)).references(`${this.getName(tfop.referenceTable)}.${this.getName(tfop.referenceColumn)}`)
          break
        case 'table.foreign.drop':
          const tfdop = (childOp as Operations.TableForeignDropOperation)
          table.dropForeign([this.getName(tfdop.column)])
          break
        case 'table.index.create':
          const tiop = (childOp as Operations.TableIndexCreateOperation)
          table.index(this.getNames(tiop.columns), tiop.indexName || undefined, tiop.indexType || undefined)
          break
        case 'table.index.drop':
          const tidop = (childOp as Operations.TableIndexDropOperation)
          table.dropIndex(this.getNames(tidop.columns), tidop.indexName || undefined)
          break
        case 'table.unique.create':
          const tuop = (childOp as Operations.TableUniqueCreateOperation)
          table.unique(this.getNames(tuop.columns), tuop.indexName || undefined)
          break
        case 'table.unique.drop':
          const tudop = (childOp as Operations.TableUniqueDropOperation)
          table.dropUnique(this.getNames(tudop.columns), tudop.indexName || undefined)
          break
        case 'table.primary.set':
          const tpop = (childOp as Operations.TablePrimarySetOperation)
          tpop.columns ? table.primary(this.getNames(tpop.columns)) : table.dropPrimary()
          break
        case 'column.create':
          this.createColumn(childOp as Operations.ColumnCreateOperation, table)
          break
        case 'column.rename':
          const crop = (childOp as Operations.ColumnRenameOperation)
          table.renameColumn(this.getName(crop.fromName), this.getName(crop.toName))
          break
        case 'column.alter':
          this.alterColumn(table, (childOp as Operations.ColumnAlterOperation))
          break
        case 'column.drop':
          table.dropColumn(this.getName((childOp as Operations.ColumnDropOperation).column))
          break
        }
        this.removeOperation(childOp)
      }
    })
  }

  private alterColumn (table: TableBuilder, op: Operations.ColumnAlterOperation) {
    // @ts-ignore
    let col: Knex.ColumnBuilder = table[op.columnType](op.column, ...op.args)
    if (op.comment) {
      col = col.comment(op.comment)
    }
    if (op.nullable) {
      col = col.nullable()
    } else {
      col = col.notNullable()
    }
    if (typeof op.defaultValue !== 'undefined') {
      col = col.defaultTo(op.defaultValue)
    }
    col = col.alter()
    return col
  }
}
