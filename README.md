
<p align="center">
  <img src="https://raw.githubusercontent.com/Akryum/graphql-migrate/master/graphql-migrate.png" alt="Logo">
</p>

# graphql-migrate

[![circleci](https://img.shields.io/circleci/project/github/Akryum/graphql-migrate/master.svg)](https://circleci.com/gh/Akryum/graphql-migrate)

Instantly create or update a SQL database from a GraphQL API schema.

<br>

<p align="center">
  <a href="https://www.patreon.com/akryum" target="_blank">
    <img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" alt="Become a Patreon">
  </a>
</p>

## Sponsors

### Silver

<p align="center">
  <a href="https://vueschool.io/" target="_blank">
    <img src="https://vueschool.io/img/logo/vueschool_logo_multicolor.svg" alt="VueSchool logo" width="200px">
  </a>
</p>

### Bronze

<p align="center">
  <a href="https://vuetifyjs.com" target="_blank" title="Vuetify">
    <img src="https://cdn.discordapp.com/attachments/537832759985700914/537832771691872267/Horizontal_Logo_-_Dark.png" width="100">
  </a>
</p>

- [Installation](#installation)
- [Programmatic Usage](#programmatic-usage)
- [CLI Usage](#cli-usage)
- [Cookbook](#cookbook)
- [Custom Scalar Mapping](#custom-scalar-mapping)
- [Custom logic with plugins](#custom-logic-with-plugins)
- [Database compatibility](#database-compatibility)
- [Roadmap](https://github.com/Akryum/graphql-migrate/projects/1)

## Installation

```bash
npm i graphql-migrate
```

## Programmatic Usage

The `migrate` methods is able to create and update tables and columns. It will execute those steps:

- Read your database and construct an abstraction.
- Read your GraphQL schema and turn it to an equivalent abstraction.
- Compare both abstractions and generate database operations.
- Convert to SQL and execute the queries from operations using [knex](https://knexjs.org).

All the operations executed on the database will be wrapped in a transaction: if an error occurs, it will be fully rollbacked to the initial state.

`migrate` has the following arguments:

- `config`: a [knex config object](https://knexjs.org/#Installation-client) to connect to the database.
- `schema`: a GraphQL schema object. You can use `buildSchema` from `graphql`.
- `options`:
  - `dbSchemaName` (default: `'public'`): table schema: `<schemaName>.<tableName>`.
  - `dbTablePrefix` (default: `''`): table name prefix: `<prefix><tableName>`.
  - `dbColumnPrefix` (default: `''`): column name prefix: `<prefix><columnName>`.
  - `updateComments` (default: `false`): by default, `migrate` won't overwrite comments on table and columns. This forces comment overwritting.
  - `lowercaseNames` (default: `true`): default table and column names will be lowercase.
  - `scalarMap` (default: `null`): Custom Scalar mapping
  - `mapListToJson` (default: `true`): Map scalar/enum lists to json column type by default.
  - `plugins` (default: `[]`): List of graphql-migrate plugins
  - `debug` (default: `false`): displays debugging informations and SQL queries.

Example:

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

migrate(config, schema, {
  // Additional options here
}).then(() => {
  console.log('Your database is up-to-date!')
})
```

## CLI Usage

Available soon!

## Cookbook

Schema annotations are parsed using [graphql-annotations](https://github.com/Akryum/graphql-annotations).

### Simple type with comments

```graphql
"""
A user.
"""
type User {
  id: ID!

  """
  Display name.
  """
  name: String!
}
```

### Skip table or field

```graphql
"""
@db.skip
"""
type MutationResult {
  success: Boolean!
}

type OtherType {
  id: ID!
  """
  @db.skip
  """
  computedField: String
}
```

### Rename

```graphql
"""
@db.oldNames: ['user']
"""
type People {
  id: ID!

  """
  @db.oldNames: ['name']
  """
  nickname: String!
}
```

### Not null field

```graphql
type User {
  """
  Not null
  """
  name: String!

  """
  Nullable
  """
  nickname: String
}
```

### Default field value

```graphql
type User {
  """
  @db.default: true
  """
  someOption: Boolean
}
```

### Default primary index

By default, `id` fields of type `ID` will be the primary key on the table:

```graphql
type User {
  """
  This will get a primary index
  """
  id: ID!
  email: String!
}
```

In this example, no primary key will be generated automatically:

```graphql
type User {
  """
  This will NOT get a primary index
  """
  foo: ID!

  """
  Neither will this
  """
  id: String!
}
```

You can disable the automatic primary key:

```graphql
type User {
  """
  @db.primary: false
  """
  id: ID!

  email: String!
}
```

### Primary key

In this example, the primary key will be on `email` instead of `id`:

```graphql
type User {
  id: ID!

  """
  @db.primary
  """
  email: String!
}
```

### Simple index

```graphql
type User {
  id: ID!

  """
  @db.index
  """
  email: String!
}
```

### Multiple index

```graphql
type User {
  """
  @db.index
  """
  id: String!

  """
  @db.index
  """
  email: String!
}
```

### Named index

```graphql
type User {
  """
  @db.index: 'myIndex'
  """
  email: String!

  """
  @db.index: 'myIndex'
  """
  name: String!
}
```

You can also specify an index type on PostgresSQL or MySQL:

```graphql
type User {
  """
  @db.index: { name: 'myIndex', type: 'hash' }
  """
  email: String!

  """
  You don't need to specify the type again.
  @db.index: 'myIndex'
  """
  name: String!
}
```

### Unique constraint

```graphql
type User {
  id: ID!
  """
  @db.unique
  """
  email: String!
}
```

### Custom name

```graphql
"""
@db.name: 'people'
"""
type User {
  """
  @db.name: 'uuid'
  """
  id: ID!
}
```

### Custom column type

```graphql
type User {
  """
  @db.type: 'string'
  @db.length: 36
  """
  id: ID!
}
```

See [knex schema builder methods](https://knexjs.org/#Schema-increments) for the supported types.

### Simple list

```graphql
type User {
  id: ID!

  """
  @db.type: 'json'
  """
  names: [String]
}
```

You can set the `mapListToJson` option to automatically map scalar and enum lists to JSON:

```js
const schema = buildSchema(`
  type User {
    names: [String]
  }
`)
const adb = await generateAbstractDatabase(schema, {
  mapListToJson: true,
})
```

### Foreign key

```graphql
type User {
  id: ID!
  messages: [Message]
}

type Message {
  id: ID!
  user: User
}
```

This will create the following tables:

```js
{
  user: {
    id: uuid primary
  },
  message: {
    id: uuid primary
    user_foreign: uuid foreign key references 'user.id'
  }
}
```

### Many-to-many

```graphql
type User {
  id: ID!
  """
  @db.manyToMany: 'users'
  """
  messages: [Message]
}

type Message {
  id: ID!
  """
  @db.manyToMany: 'messages'
  """
  users: [User]
}
```

This will create an additional join table:

```js
{
  message_users_join_user_messages: {
    users_foreign: uuid foreign key references 'message.id',
    messages_foreign: uuid foreign key references 'user.id',
  }
}
```

### Many-to-many on same type

```graphql
type User {
  id: ID!
  contacts: [User]
}
```

This will create an additional join table:

```js
{
  user_contacts_join_user_contacts: {
    id_foreign: uuid foreign key references 'user.id',
    id_foreign_other: uuid foreign key references 'user.id',
  }
}
```

## Custom Scalar Mapping

To customize the scalar mapping, you can provide a function on the `scalarMap` option that gets field information and that returns a `TableColumnDescriptor` or `null`. Here is its signature:

```ts
type ScalarMap = (
  field: GraphQLField<any, any>,
  scalarType: GraphQLScalarType | null,
  annotations: any,
) => TableColumnTypeDescriptor | null
```

Here is the `TableColumnTypeDescriptor` interface:

```ts
interface TableColumnTypeDescriptor {
  /**
   * Knex column builder function name.
   */
  type: string
  /**
   * Builder function arguments.
   */
  args: any[]
}
```

Example:

```js
migrate(config, schema, {
  scalarMap: (field, scalarType, annotations) => {
    if (scalarType && scalarType.name === 'Timestamp') {
      return {
        type: 'timestamp',
        // useTz, precision
        args: [true, undefined],
      }
    }

    if (field.name === 'id' || annotations.type === 'uuid') {
      return {
        type: 'uuid',
        args: [],
      }
    }

    return null
  }
})
```

## Custom logic with Plugins

It's possible to write custom queries to be executed during migrations using Plugins.

Currently a plugin can only declare tap on the Writer system, with the `write` and `tap` methods:

```js
import { MigratePlugin } from 'graphql-migrate'

class MyPlugin extends MigratePlugin {
  write ({ tap }) {
    tap('op-type', 'before', (op, transaction) => {
      // or 'after'
    })
  }
}
```

The arguments are:

- `operation: string`, can be one of the following:
  - `table.create`
  - `table.rename`
  - `table.comment.set`
  - `table.drop`
  - `table.index.create`
  - `table.index.drop`
  - `table.primary.set`
  - `table.unique.create`
  - `table.unique.drop`
  - `table.foreign.create`
  - `table.foreign.drop`
  - `column.create`
  - `column.rename`
  - `column.alter`
  - `column.drop`
- `type: 'before' | 'after'`
- `callback: function` which get those parameters:
  - `operation`: the operation object (see [Operation.d.ts](./src/diff/Operation.d.ts))
  - `transaction`: the Knex SQL transaction

Then, instanciate the plugin in the `plugins` option array of the `migrate` method.

For example, let's say we have the following schema:

```js
// old schema
const schema = buildSchema(`
type User {
  id: ID!
  fname: String
  lname: String
}
`)
```

Now we want to migrate the `user` table from two columns `fname` and `lname` into one:

```js
fullname = fname + ' ' + lname
```

Here is the example code to achieve this:

```js
import { buildSchema } from 'graphql'
import { migrate, MigratePlugin } from 'graphql-migrate'

const schema = buildSchema(`
type User {
  id: ID!
  """
  @db.oldNames: ['lname']
  """
  fullname: String
}
`)

class MyPlugin extends MigratePlugin {
  write ({ tap }) {
    tap('column.drop', 'before', async (op, transaction) => {
      // Check the table and column
      if (op.table === 'user' && op.column === 'fname') {
        // Update the users lname with fname + ' ' + lname
        const users = await transaction
          .select('id', 'fname', 'lname')
          .from('user')
        for (const user of users) {
          await transaction('user')
            .where({ id: user.id })
            .update({
              lname: `${user.fname} ${user.lname}`,
            })
        }
      }
    })
  }
}

migrate(config, schema, {
  plugins: [
    new MyPlugin(),
  ],
})
```

Let's describe what's going on -- we:

- Remove the `fname` field from the schema.
- Rename `lname` to `fullname` in the schema.
- Annotate the `fullname` field to indicate it's the new name of `lname`.
- We declare a plugin that tap into the `column.drop` write operation.
- In this hook, we read the users and update each one of them to merge the two columns into `lname` before the `fname` column is dropped.

## Database compatibility

**🙂 Contributions are welcome for SQL queries or testing!**

| Icon | Meaning |
|:--:| ----- |
| ✔️ | Supported |
| ❓ | Not tested |
| - | Not implemented |
| ❌ | Not supported |

---

| Operation     | pg | mysql | mssql | oracle | sqlite3 |
| ------------- |:--:|:-----:|:-----:|:------:|:-------:|
| Read tables   | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Read table comments | ✔️ | ❓ | - | - | ❌ |
| Read columns  | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Read column types  | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Read column comments | ✔️ | - | - | - | ❌ |
| Read column default values  | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Read foreign keys | ✔️ | - | - | - | - |
| Read primary keys | ✔️ | - | - | - | - |
| Read index | ✔️ | - | - | - | - |
| Read unique constraint | ✔️ | - | - | - | - |
| Write tables   | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Write table comments | ✔️ | ❓ | ❓ | ❓ | ❌ |
| Write columns   | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Write column comments | ✔️ | ❓ | ❓ | ❓ | ❌ |
| Write foreign keys | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Write primary keys | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Write index | ✔️ | ❓ | ❓ | ❓ | ❓ |
| Write unique constraint | ✔️ | ❓ | ❓ | ❓ | ❓ |
