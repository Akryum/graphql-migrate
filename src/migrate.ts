import { Config } from 'knex'
import { GraphQLSchema } from 'graphql'
import read from './connector/read'
import generateAbstractDatabase from './abstract/generateAbstractDatabase'
import computeDiff from './diff/computeDiff'
import write from './connector/write'

export interface Options {
  dbSchemaName?: string
  dbPrefix?: string
  updateComments?: boolean
}

export default async function (config: Config, schema: GraphQLSchema, options: Options): Promise<void> {
  const existingAdb = await read(config, options.dbSchemaName, options.dbPrefix)
  const newAdb = await generateAbstractDatabase(schema)
  const ops = await computeDiff(existingAdb, newAdb, {
    updateComments: options.updateComments,
  })
  await write(ops, config, options.dbSchemaName, options.dbPrefix)
}
