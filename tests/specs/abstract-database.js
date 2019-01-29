const { buildSchema } = require('graphql')
const generateAbstractDatabase = require('../../src/abstract/generateAbstractDatabase')

describe('create abstract database', () => {
  test('skip root types', async () => {
    const schema = buildSchema(`
      type Query {
        hello: String
      }

      type Mutation {
        do: Boolean
      }

      type Subscription {
        notif: String
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(0)
  })

  test('simple type', async () => {
    const schema = buildSchema(`
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
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.name).toBe('User')
    expect(User.comment).toBe('A user.')
    expect(User.columns.length).toBe(2)
    const [colId, colName] = User.columns
    expect(colId.name).toBe('id')
    expect(colId.type).toBe('uuid')
    expect(colName.name).toBe('name')
    expect(colName.type).toBe('string')
    expect(colName.comment).toBe('Display name.')
  })

  test('not null', async () => {
    const schema = buildSchema(`
      type User {
        name: String!
        nickname: String
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.columns.length).toBe(2)
    const [colName, colNickname] = User.columns
    expect(colName.notNull).toBe(true)
    expect(colNickname.notNull).toBe(false)
  })

  test('default value', async () => {
    const schema = buildSchema(`
      type User {
        """
        @db.default: true
        """
        someOption: Boolean
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    const [User] = adb.tables
    const [colSomeOption] = User.columns
    expect(colSomeOption.defaultValue).toBe(true)
  })

  test('default primary index', async () => {
    const schema = buildSchema(`
      type User {
        """
        This will get a primary index
        """
        id: ID!
        email: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.primaries.length).toBe(1)
    const [id] = User.primaries
    expect(id.columns).toEqual(['id'])
  })

  test('no default primary index', async () => {
    const schema = buildSchema(`
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
    `)
    const adb = await generateAbstractDatabase(schema)
    const [User] = adb.tables
    expect(User.primaries.length).toBe(0)
  })

  test('skip default primary index', async () => {
    const schema = buildSchema(`
      type User {
        """
        @db.primary: false
        """
        id: ID!
        email: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.primaries.length).toBe(0)
  })

  test('change primary index', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        """
        @db.primary
        """
        email: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.primaries.length).toBe(1)
    const [email] = User.primaries
    expect(email.columns).toEqual(['email'])
  })

  test('simple index', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        """
        @db.index
        """
        email: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.indexes.length).toBe(1)
    const [email] = User.indexes
    expect(email.columns).toEqual(['email'])
  })

  test('multiple indexes', async () => {
    const schema = buildSchema(`
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
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.indexes.length).toBe(2)
    const [id, email] = User.indexes
    expect(id.columns).toEqual(['id'])
    expect(email.columns).toEqual(['email'])
  })

  test('named index', async () => {
    const schema = buildSchema(`
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
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.indexes.length).toBe(1)
    const [myIndex] = User.indexes
    expect(myIndex.name).toBe('myIndex')
    expect(myIndex.columns).toEqual(['email', 'name'])
  })

  test('object index', async () => {
    const schema = buildSchema(`
      type User {
        """
        @db.index: { name: 'myIndex', type: 'string' }
        """
        email: String!
        """
        @db.index: 'myIndex'
        """
        name: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.indexes.length).toBe(1)
    const [myIndex] = User.indexes
    expect(myIndex.name).toBe('myIndex')
    expect(myIndex.type).toBe('string')
    expect(myIndex.columns).toEqual(['email', 'name'])
  })

  test('unique index', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        """
        @db.unique
        """
        email: String!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.uniques.length).toBe(1)
    const [email] = User.uniques
    expect(email.columns).toEqual(['email'])
  })

  test('custom name', async () => {
    const schema = buildSchema(`
      """
      @db.name: 'people'
      """
      type User {
        id: ID!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.annotations.name).toBe('people')
    expect(User.name).toBe('people')
  })

  test('custom type', async () => {
    const schema = buildSchema(`
      type User {
        """
        @db.type: 'string'
        @db.length: 36
        """
        id: ID!
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    const [colId] = User.columns
    expect(colId.name).toBe('id')
    expect(colId.annotations.type).toBe('string')
    expect(colId.annotations.length).toBe(36)
    expect(colId.type).toBe('string')
    expect(colId.args).toEqual([36])
  })

  test('foreign key', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        messages: [Message]
      }

      type Message {
        id: ID!
        user: User
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(2)
    const [User, Message] = adb.tables
    expect(User.name).toBe('User')
    expect(Message.name).toBe('Message')
    expect(User.columns.length).toBe(1)
    expect(Message.columns.length).toBe(2)
    const [colId, colUserForeign] = Message.columns
    expect(colId.name).toBe('id')
    expect(colUserForeign.name).toBe('user_foreign')
    expect(colUserForeign.type).toBe('uuid')
    expect(colUserForeign.foreign.tableName).toBe('User')
    expect(colUserForeign.foreign.columnName).toBe('id')
  })

  test('many to many', async () => {
    const schema = buildSchema(`
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
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(3)
    const [Join] = adb.tables
    expect(Join.name).toBe('Message_users_JOIN_User_messages')
    const [colMessageUsers, colUserMessages] = Join.columns
    expect(colMessageUsers.name).toBe('users_foreign')
    expect(colMessageUsers.type).toBe('uuid')
    expect(colMessageUsers.foreign.tableName).toBe('Message')
    expect(colMessageUsers.foreign.columnName).toBe('id')
    expect(colUserMessages.name).toBe('messages_foreign')
    expect(colUserMessages.type).toBe('uuid')
    expect(colUserMessages.foreign.tableName).toBe('User')
    expect(colUserMessages.foreign.columnName).toBe('id')
  })

  test('many to many on self', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        contacts: [User]
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(2)
    const [UserContacts, User] = adb.tables
    expect(UserContacts.name).toBe('User_contacts_JOIN_User_contacts')
    expect(User.name).toBe('User')
    expect(User.columns.length).toBe(1)
    const [col1, col2] = UserContacts.columns
    expect(col1.name).toBe('id_foreign')
    expect(col1.type).toBe('uuid')
    expect(col1.foreign.tableName).toBe('User')
    expect(col1.foreign.columnName).toBe('id')
    expect(col2.name).toBe('id_foreign_other')
    expect(col2.type).toBe('uuid')
    expect(col2.foreign.tableName).toBe('User')
    expect(col2.foreign.columnName).toBe('id')
  })

  test('simple list', async () => {
    const schema = buildSchema(`
      type User {
        id: ID!
        """
        @db.type: 'json'
        """
        names: [String]
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(1)
    const [User] = adb.tables
    expect(User.name).toBe('User')
    expect(User.columns.length).toBe(2)
    const [colId, colNames] = User.columns
    expect(colId.name).toBe('id')
    expect(colId.type).toBe('uuid')
    expect(colNames.name).toBe('names')
    expect(colNames.type).toBe('json')
  })

  test('sandbox', async () => {
    const schema = buildSchema(`
      scalar Date

      """
      A user.
      """
      type User {
        id: ID!
        """
        Display name
        @db.length: 200
        """
        name: String!
        email: String!
        score: Int
        """
        @db.type: 'json'
        """
        scores: [Int]
        messages: [Message]
        """
        @db.manyToMany: 'users'
        """
        sharedMessages: [Message]
        contacts: [User]
      }

      type Message {
        id: ID!
        user: User!
        """
        @db.manyToMany: 'sharedMessages'
        """
        users: [User]
        """
        @db.type: 'datetime'
        """
        created: Date!
        title: String!
        """
        @db.type: 'text'
        """
        content: String!
      }

      type Query {
        users: [User]
      }
    `)
    const adb = await generateAbstractDatabase(schema)
    expect(adb.tables.length).toBe(4)
  })
})
