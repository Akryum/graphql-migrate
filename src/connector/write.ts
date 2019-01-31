import { Operation } from '../..'
import * as OperationTypes from '../../types/Operation'

import Knex, { Config } from 'knex'

/**
 * @param {Operation[]} operations
 * @param {Config} config Knex configuration
 * @param {string} schemaName Table and column prefix: `<schemaName>.<tableName>`
 * @param {string} prefix Table and column name prefix: `<prefix><tableName>`
 */
export default async function (operations, config, schemaName = 'public', prefix = '') {
  const writer = new Writer(operations, config, schemaName, prefix)
  return writer.write()
}

class Writer {
  operations: Operation[]
  config: Config
  schemaName: string
  prefix: string
  knex: Knex

  constructor (operations, config, schemaName = 'public', prefix = '') {
    this.operations = operations
    this.config = config
    this.schemaName = schemaName
    this.prefix = prefix
    this.knex = Knex(config)
  }

  async write () {
    for (const op of this.operations) {
      
    }
  }

  /** @param {} */
  async createDatabase (op) {

  }
}
