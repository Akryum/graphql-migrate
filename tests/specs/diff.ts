import { computeDiff } from '../../src'
import { AbstractDatabase } from '../../src/abstract/AbstractDatabase'
import { Table } from '../../src/abstract/Table'
import { TableColumn } from '../../src/abstract/TableColumn'

function dbFactory (tables: Table[] = []): AbstractDatabase {
  return {
    tables,
    tableMap: new Map(),
  }
}

function tableFactory (options: any): Table {
  return {
    columns: [],
    primaries: [],
    indexes: [],
    uniques: [],
    annotations: {},
    columnMap: new Map(),
    ...options,
  }
}

function columnFactory (options: any): TableColumn {
  return {
    args: [],
    notNull: undefined,
    annotations: {},
    defaultValue: undefined,
    comment: undefined,
    foreign: undefined,
    ...options,
  }
}

describe('compute diff', () => {
  test('create simple table', async () => {
    const result = await computeDiff(dbFactory(), dbFactory([
      tableFactory({
        name: 'User',
        comment: 'Some comment',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
            notNull: true,
          }),
          columnFactory({
            name: 'name',
            type: 'string',
            args: [150],
          }),
        ],
        primaries: [
          { columns: ['id'], name: undefined },
        ],
      }),
    ]))
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
      args: [],
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
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
      }),
    ]), dbFactory([
      tableFactory({
        name: 'users',
        annotations: {
          oldNames: ['User'],
        },
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.rename',
      fromName: 'User',
      toName: 'users',
    })
  })

  test('update table comment', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        comment: 'Some comment',
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        comment: 'New comment',
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.comment.set',
      table: 'User',
      comment: 'New comment',
    })
  })

  test('add column', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.create',
      table: 'User',
      column: 'id',
      columnType: 'uuid',
      args: [],
    })
  })

  test('add and remove column', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
      }),
    ]))
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
      args: [],
    })
  })

  test('rename column', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'email',
            type: 'uuid',
            annotations: {
              oldNames: ['id'],
            },
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.rename',
      table: 'User',
      fromName: 'id',
      toName: 'email',
    })
  })

  test('change column comment', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
            comment: 'foo',
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
            comment: 'bar',
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.comment.set',
      table: 'User',
      column: 'id',
      comment: 'bar',
    })
  })


  test('change column type', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.type.set',
      table: 'User',
      column: 'id',
      columnType: 'string',
      args: [],
    })
  })

  test('change column type args', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            args: [100],
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            args: [200],
          }),
        ],
      }),
    ]))
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
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            notNull: true,
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            notNull: false,
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.nullable.set',
      table: 'User',
      column: 'id',
      nullable: true,
    })
  })

  test('change column default value', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            defaultValue: 'foo',
          }),
        ],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'string',
            defaultValue: 'bar',
          }),
        ],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'column.default.set',
      table: 'User',
      column: 'id',
      value: 'bar',
    })
  })

  test('change primary key', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        primaries: [{ columns: ['id'] }],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        primaries: [{ columns: ['email'] }],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.primary.set',
      table: 'User',
      columns: ['email'],
    })
  })

  test('change anonymous index', async () => {
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['id'] }],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['email'] }],
      }),
    ]))
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
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['id'], name: 'foo' }],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['email'], name: 'foo' }],
      }),
    ]))
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
    const result = await computeDiff(dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['id'] }, { columns: ['id'], name: 'foo' }],
      }),
    ]), dbFactory([
      tableFactory({
        name: 'User',
        columns: [
          columnFactory({
            name: 'id',
            type: 'uuid',
          }),
          columnFactory({
            name: 'email',
            type: 'string',
          }),
        ],
        indexes: [{ columns: ['id'], name: 'foo' }],
      }),
    ]))
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      type: 'table.index.drop',
      table: 'User',
      columns: ['id'],
    })
  })
})
