# Custom logic with Plugins

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
