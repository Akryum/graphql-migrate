import { Config } from 'knex'
import { GraphQLSchema } from 'graphql'
import read from './connector/read'
import generateAbstractDatabase from './abstract/generateAbstractDatabase'
import computeDiff from './diff/computeDiff'
import write from './connector/write'

export interface Options {
  /**
   * Table schema: `<schemaName>.<tableName>`.
   */
  dbSchemaName?: string
  /**
   * Table name prefix: `<prefix><tableName>`.
   */
  dbTablePrefix?: string
  /**
   * Column name prefix: `<prefix><columnName>`.
   */
  dbColumnPrefix?: string
  /**
   * Overwrite table and column comments (not supported in some databases).
   */
  updateComments?: boolean
  /**
   * Default table and column names all lowercase.
   */
  lowercaseNames?: boolean
  /**
   * Display debug information
   */
  debug?: boolean
}

export const defaultOptions: Options = {
  dbSchemaName: 'public',
  dbTablePrefix: '',
  dbColumnPrefix: '',
  updateComments: false,
  lowercaseNames: true,
  debug: false,
}

export default async function (config: Config, schema: GraphQLSchema, options: Options = {}): Promise<void> {
  // Default options
  options = {
    ...defaultOptions,
    ...options,
  }
  if (options.debug) {
    config = {
      ...config,
      debug: true,
    }
  }
  // Read current
  const existingAdb = await read(
    config,
    options.dbSchemaName,
    options.dbTablePrefix,
    options.dbColumnPrefix,
  )
  // Generate new
  const newAdb = await generateAbstractDatabase(schema, {
    lowercaseNames: options.lowercaseNames,
  })
  if (options.debug) {
    console.log('BEFORE', JSON.stringify(existingAdb.tables, null, 2))
    console.log('AFTER', JSON.stringify(newAdb.tables, null, 2))
  }
  // Diff
  const ops = await computeDiff(existingAdb, newAdb, {
    updateComments: options.updateComments,
  })
  if (options.debug) {
    console.log('OPERATIONS', ops)
  }
  // Write back to DB
  await write(
    ops,
    config,
    options.dbSchemaName,
    options.dbTablePrefix,
    options.dbColumnPrefix,
  )
}
