const { computeDiff } = require('../..')

describe('compute diff', () => {
  test('create simple table', async () => {
    const result = await computeDiff({
      tables: [],
    }, {
      tables: [
        {
          name: 'User',
          comment: 'Some comment',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              notNull: true,
            },
            {
              name: 'name',
              type: 'string',
              args: [150],
            }
          ],
          primaries: [
            { columns: ['id'] },
          ],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(6)
    expect(result[0]).toEqual({
      type: 'table.create',
      table: 'User'
    })
    expect(result[1]).toEqual({
      type: 'table.comment.set',
      table: 'User',
      comment: 'Some comment',
    })
    expect(result[2]).toEqual({
      type: 'column.create',
      table: 'User',
      column: 'id',
      columnType: 'uuid',
    })
    expect(result[3]).toEqual({
      type: 'column.nullable.set',
      table: 'User',
      column: 'id',
      nullable: false,
    })
    expect(result[4]).toEqual({
      type: 'column.create',
      table: 'User',
      column: 'name',
      columnType: 'string',
      args: [150],
    })
    expect(result[5]).toEqual({
      type: 'table.primary.set',
      table: 'User',
      columns: ['id'],
    })
  })

  test('rename table', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'users',
          annotations: {
            oldNames: ['User'],
          },
          columns: [],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.rename',
      fromName: 'User',
      toName: 'users',
    })
  })

  test('update table comment', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          comment: 'Some comment',
          columns: [],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          comment: 'New comment',
          columns: [],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.comment.set',
      table: 'User',
      comment: 'New comment',
    })
  })

  test('add column', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.create',
      table: 'User',
      column: 'id',
      columnType: 'uuid',
    })
  })

  test('add and remove column', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      type: 'column.drop',
      table: 'User',
      column: 'id',
    })
    expect(result[1]).toEqual({
      type: 'column.create',
      table: 'User',
      column: 'email',
      columnType: 'string',
    })
  })

  test('rename column', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'email',
              type: 'uuid',
              annotations: {
                oldNames: ['id'],
              },
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.rename',
      table: 'User',
      fromName: 'id',
      toName: 'email',
    })
  })

  test('change column comment', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              comment: 'foo',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              comment: 'bar',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.comment.set',
      table: 'User',
      column: 'id',
      comment: 'bar',
    })
  })


  test('change column type', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.type.set',
      table: 'User',
      column: 'id',
      columnType: 'string',
    })
  })

  test('change column type args', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              args: [100],
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              args: [200],
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.type.set',
      table: 'User',
      column: 'id',
      columnType: 'string',
      args: [200],
    })
  })

  test('change column nullable', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              notNull: true,
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              notNull: false,
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.nullable.set',
      table: 'User',
      column: 'id',
      nullable: true,
    })
  })

  test('change column default value', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              defaultValue: 'foo',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'string',
              defaultValue: 'bar',
            },
          ],
          primaries: [],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.default.set',
      table: 'User',
      column: 'id',
      value: 'bar',
    })
  })

  test('change primary key', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [{ columns: ['id'] }],
          indexes: [],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [{ columns: ['email'] }],
          indexes: [],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.primary.set',
      table: 'User',
      columns: ['email'],
    })
  })

  test('change anonymous index', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['id'] }],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['email'] }],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      type: 'table.index.drop',
      table: 'User',
      columns: ['id'],
    })
    expect(result[1]).toEqual({
      type: 'table.index.create',
      table: 'User',
      columns: ['email'],
    })
  })

  test('change named index', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['id'], name: 'foo' }],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['email'], name: 'foo' }],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({
      type: 'table.index.drop',
      table: 'User',
      columns: ['id'],
      indexName: 'foo',
    })
    expect(result[1]).toEqual({
      type: 'table.index.create',
      table: 'User',
      columns: ['email'],
      indexName: 'foo',
    })
  })

  test('untouched named index', async () => {
    const result = await computeDiff({
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['id'] }, { columns: ['id'], name: 'foo' }],
          uniques: [],
        },
      ],
    }, {
      tables: [
        {
          name: 'User',
          columns: [
            {
              name: 'id',
              type: 'uuid',
            },
            {
              name: 'email',
              type: 'string',
            },
          ],
          primaries: [],
          indexes: [{ columns: ['id'], name: 'foo' }],
          uniques: [],
        },
      ],
    })
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.index.drop',
      table: 'User',
      columns: ['id'],
    })
  })
})
