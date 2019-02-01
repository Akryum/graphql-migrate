import Knex, { Config, ColumnInfo } from 'knex'
import { AbstractDatabase } from '../abstract/AbstractDatabase'
import { Table } from '../abstract/Table'
import { TableColumn } from '../abstract/TableColumn'
import listTables from '../util/listTables'
import getTypeAlias from '../util/getTypeAlias'
import getColumnComments from '../util/getColumnComments'
import transformDefaultValue from '../util/transformDefaultValue'
import getPrimaryKey from '../util/getPrimaryKey'
import getForeignKeys from '../util/getForeignKeys'
import getIndexes from '../util/getIndexes'
import getUniques from '../util/getUniques'

/**
 * @param {Config} config Knex configuration
 * @param {string} schemaName Table and column prefix: `<schemaName>.<tableName>`
 * @param {string} prefix Table and column name prefix: `<prefix><tableName>`
 */
export default function read (config: Config, schemaName = 'public', prefix = ''): Promise<AbstractDatabase> {
  const reader = new Reader(config, schemaName, prefix)
  return reader.read()
}

class Reader {
  config: Config
  schemaName: string
  prefix: string
  knex: Knex
  database: AbstractDatabase

  constructor (config: Config, schemaName: string, prefix: string) {
    this.config = config
    this.schemaName = schemaName
    this.prefix = prefix
    this.knex = Knex(config)
    this.database = {
      tables: [],
      tableMap: new Map(),
    }
  }

  public async read () {
    const tables: { name: string, comment: string }[] = await listTables(this.knex, this.schemaName)
    for (const { name: tableName, comment } of tables) {
      const table: Table = {
        name: tableName,
        comment,
        annotations: {},
        columns: [],
        columnMap: new Map(),
        primaries: [],
        indexes: [],
        uniques: [],
      }
      this.database.tables.push(table)
      this.database.tableMap.set(tableName, table)

      // Foreign keys
      const foreignKeys = await getForeignKeys(this.knex, tableName, this.schemaName)

      // Columns
      const columnComments = await getColumnComments(this.knex, tableName, this.schemaName)
      const columnInfo: { [key: string]: ColumnInfo } = await this.knex(tableName).columnInfo() as any
      for (const key in columnInfo) {
        const info = columnInfo[key]
        const foreign = foreignKeys.find(k => k.column === key)
        const column: TableColumn = {
          name: key,
          comment: this.getComment(columnComments, key),
          annotations: {},
          ...getTypeAlias(info.type, info.maxLength),
          nullable: info.nullable,
          defaultValue: transformDefaultValue(info.defaultValue),
          foreign: foreign ? {
            type: null,
            field: null,
            tableName: foreign.foreignTable,
            columnName: foreign.foreignColumn,
          } : null,
        }
        table.columns.push(column)
        table.columnMap.set(key, column)
      }

      // Primary key
      const primaries = await getPrimaryKey(this.knex, tableName, this.schemaName)
      table.primaries = primaries.map(p => ({
        columns: [p.column],
        name: p.indexName,
      }))

      // Index
      const indexes = await getIndexes(this.knex, tableName, this.schemaName)
      table.indexes = indexes.filter(
        i => i.columnNames.length > 1 ||
          // Not already the primary key
          !primaries.find(p => p.column === i.columnNames[0])
      ).map(i => ({
        name: i.indexName,
        columns: i.columnNames,
        type: i.type,
      }))

      // Unique constraints
      const uniques = await getUniques(this.knex, tableName, this.schemaName)
      table.uniques = uniques.map(u => ({
        columns: u.columnNames,
        name: u.indexName,
      }))
    }

    return this.database
  }

  private getComment (comments: { column: string, comment: string }[], column: string) {
    const row = comments.find(c => c.column === column)
    if (row) return row.comment
    return null
  }
}
