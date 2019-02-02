import { buildSchema } from 'graphql'
import { Config } from 'knex'
import migrate from './migrate'

async function test () {
  const config: Config = {
    client: 'pg',
    connection: {
      host: 'localhost',
      user: 'odaxio',
      password: 'test',
      database: 'odaxio',
    },
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

  await migrate(config, schema, {
    debug: true,
  })

  console.log('DONE')
}

setTimeout(test, 2000)
