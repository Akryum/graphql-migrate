import { buildSchema } from 'graphql'
import { Config } from 'knex'
import generateAbstractDatabse from './abstract/generateAbstractDatabase'
import computeDiff from './diff/computeDiff'
import read from './connector/read'
import write from './connector/write'

async function test () {
  const config: Config = {
    client: 'pg',
    connection: {
      host: 'localhost',
      user: 'odaxio',
      password: 'test',
      database: 'odaxio',
    },
    debug: true,
  }

  const schema = buildSchema(`
  type User {
    id: ID!
    name: String
    messages: [Message]
    contacts: [User]
  }

  type Message {
    id: ID!
    user: User
  }
  `)

  const existingAdb = await read(config)

  const newAdb = await generateAbstractDatabse(schema)

  console.log('BEFORE', JSON.stringify(existingAdb.tables, null, 2))
  console.log('AFTER', JSON.stringify(newAdb.tables, null, 2))

  const ops = await computeDiff(existingAdb, newAdb)

  console.log('OPERATIONS', ops)

  await write(ops, config)
}

setTimeout(test, 2000)
