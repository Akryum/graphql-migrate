import { Config } from 'knex'
import { GraphQLSchema } from 'graphql'
import { read } from './connector/read'
import { generateAbstractDatabase, ScalarMap } from './abstract/generateAbstractDatabase'
import { computeDiff } from './diff/computeDiff'
import { write } from './connector/write'
import { MigratePlugin } from './plugin/MigratePlugin'
import { Operation } from './diff/Operation'

export interface MigrateOptions {
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
   * Custom Scalar mapping
   */
  scalarMap?: ScalarMap | null
  /**
   * Map scalar/enum lists to json column type by default.
   */
  mapListToJson?: boolean
  /**
   * List of graphql-migrate plugins
   */
  plugins?: MigratePlugin[],
  /**
   * Display debug information
   */
  debug?: boolean
}

export const defaultOptions: MigrateOptions = {
  dbSchemaName: 'public',
  dbTablePrefix: '',
  dbColumnPrefix: '',
  updateComments: false,
  lowercaseNames: true,
  scalarMap: null,
  mapListToJson: true,
  plugins: [],
  debug: false,
}

export async function migrate (
  config: Config,
  schema: GraphQLSchema,
  options: MigrateOptions = {},
): Promise<Operation[]> {
  // Default options
  const finalOptions = {
    ...defaultOptions,
    ...options,
  }
  if (finalOptions.debug) {
    config = {
      ...config,
      debug: true,
    }
  }
  // Read current
  const existingAdb = await read(
    config,
    finalOptions.dbSchemaName,
    finalOptions.dbTablePrefix,
    finalOptions.dbColumnPrefix,
  )
  // Generate new
  const newAdb = await generateAbstractDatabase(schema, {
    lowercaseNames: finalOptions.lowercaseNames,
    scalarMap: finalOptions.scalarMap,
  })
  if (finalOptions.debug) {
    console.log('BEFORE', JSON.stringify(existingAdb.tables, null, 2))
    console.log('AFTER', JSON.stringify(newAdb.tables, null, 2))
  }
  // Diff
  const ops = await computeDiff(existingAdb, newAdb, {
    updateComments: finalOptions.updateComments,
  })
  if (finalOptions.debug) {
    console.log('OPERATIONS', ops)
  }
  // Write back to DB
  await write(
    ops,
    config,
    finalOptions.dbSchemaName,
    finalOptions.dbTablePrefix,
    finalOptions.dbColumnPrefix,
    finalOptions.plugins,
  )

  return ops
}
