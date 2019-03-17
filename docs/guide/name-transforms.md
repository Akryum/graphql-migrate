# Name transforms

You can customize the way table and column names are transformed before being applied to the database with the `transformTableName` and `transformColumnName` options.

By default, they will convert the table and column names to Snake case:

```js
import Case from 'case'

migrate(nkexConfig, schema, {
  transformTableName: (name, direction) => {
    if (direction === 'to-db') {
      return Case.snake(name)
    }
    return name
  },
  transformColumnName: (name, direction) => {
    if (direction === 'to-db') {
      return Case.snake(name)
    }
    return name
  },
})
```

For example, let's consider this schema:

```graphql
type UserTeam {
  id: ID!
  name: String!
  yearlyBilling: Boolean!
}
```

We will create a `user_team` table with those columns:

- `id`
- `name`
- `yearly_billing`
