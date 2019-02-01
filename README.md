# grahpql-migrate
Create or migrate SQL databases from a GraphQL server schema

```js
import { buildSchema } from 'graphql'
import { migrate } from 'graphql-migrate'

const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    user: 'some-user',
    password: 'secret-password',
    database: 'my-app',
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

migrate(config, schema).then(() => {
  console.log('Your database is up-to-date!')
})
```
