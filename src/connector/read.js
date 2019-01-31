/** @typedef {import('knex').Config} Config */
/** @typedef {import('../..').AbstractDatabase} AbstractDatabase */
/** @typedef {import('../..').Table} Table */
/** @typedef {import('../..').TableColumn} TableColumn */
/** @typedef {import('../..').TableColumnType} TableColumnType */
/** @typedef {import('../..').ForeignKey} ForeignKey */

const knex = require('knex')
const listTables = require('../util/listTables')
const getTypeAlias = require('../util/getTypeAlias')

/**
 * @param {Config} config Knex configuration
 * @param {string} schemaName Table and column prefix: `<schemaName>.<tableName>`
 * @param {string} prefix Table and column name prefix: `<prefix><tableName>`
 * @return {Promise.<AbstractDatabase>}
 */
module.exports = function (config, schemaName = 'public', prefix = '') {
  const reader = new Reader(config, schemaName, prefix)
  return reader.read()
}

class Reader {
  /**
   * @param {Config} config
   * @param {string} schemaName
   * @param {string} prefix
   */
  constructor (config, schemaName, prefix) {
    this.config = config
    this.schemaName = schemaName
    this.prefix = prefix
    this.knex = knex(config)
    /** @type {AbstractDatabase} */
    this.database = {
      tables: [],
      tableMap: new Map(),
    }
  }

  /**
   * @return {Promise.<AbstractDatabase>}
   */
  async read () {
    const tables = await listTables(this.knex, this.schemaName)
    for (const { name, comment } of tables) {
      /** @type {Table} */
      const table = {
        name,
        comment,
        annotations: {},
        columns: [],
        columnMap: new Map(),
        primaries: [],
        indexes: [],
        uniques: [],
      }
      this.database.tables.push(table)
      this.database.tableMap.set(name, table)

      // Columns
      const columnInfo = await this.knex(name).columnInfo()
      for (const key in columnInfo) {
        const info = columnInfo[key]
        /** @type {TableColumn} */
        const column = {
          name: key,
          comment: null, // TODO
          annotations: {},
          ...getTypeAlias(info.type, info.maxLength),
          notNull: !info.nullable,
          defaultValue: info.defaultValue,
          foreign: null,
        }
        table.columns.push(column)
        table.columnMap.set(key, column)
      }
    }
    console.log(this.database.tables)
    return this.database
  }
}

module.exports({
  client: 'postgres',
  connection: {
    host: 'localhost',
    database: 'livestorm_development',
    user: 'livestorm',
    password: 'kaliarco37',
  },
})
