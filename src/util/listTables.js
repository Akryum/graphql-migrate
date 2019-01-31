/** @typedef {import('knex')} Knex */

const queries = {
  /**
   * @param {Knex} knex
   * @param {string} schemaName
   */
  mssql: (knex, schemaName) => ({
    sql: `select table_name from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema = ? and table_catalog = ?`,
    bindings: [schemaName, knex.client.database()],
    output: resp => resp.rows.map(table => ({ name: table.table_name })),
  }),

  /**
   * @param {Knex} knex
   * @param {string} schemaName
   */
  mysql: (knex, schemaName) => ({
    sql: `select table_name, table_comment from information_schema.tables where table_schema = ?`,
    bindings: [knex.client.database()],
    output: resp => resp.map(table => ({ name: table.table_name, comment: table.table_comment })),
  }),

  /**
   * @param {Knex} knex
   * @param {string} schemaName
   */
  oracle: (knex, schemaName) => ({
    sql: `select table_name from user_tables`,
    output: resp => resp.map(table => ({ name: table.TABLE_NAME })),
  }),

  /**
   * @param {Knex} knex
   * @param {string} schemaName
   */
  postgres: (knex, schemaName) => ({
    sql: `select t.table_name, d.description from information_schema.tables t
    inner join pg_class c on c.relkind = 'r' and c.relname = t.table_name
    left join pg_description d on d.objoid = c.oid
    where t.table_schema = ? and t.table_catalog = ?`,
    bindings: [schemaName, knex.client.database()],
    output: resp => resp.rows.map(table => ({ name: table.table_name, comment: table.description })),
  }),

  /**
   * @param {Knex} knex
   * @param {string} schemaName
   */
  sqlite3: (knex, schemaName) => ({
    sql: `SELECT name FROM sqlite_master WHERE type='table';`,
    output: resp => resp.map(table => ({ name: table.name })),
  }),
}

/**
 * @param {Knex} knex
 * @param {string} schemaName
 */
module.exports = async function (knex, schemaName) {
  const query = queries[knex.client.config.client]
  if (!query) {
    console.error(`Client ${knex.client.config.client} not supported`)
  }
  const { sql, bindings, output } = query(knex, schemaName)
  const resp = await knex.raw(sql, bindings)
  return output(resp)
}
