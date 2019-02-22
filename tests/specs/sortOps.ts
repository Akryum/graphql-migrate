import { sortOps } from '../../src/util/sortOps'
import { Operation } from '../../src/diff/Operation'

describe('sortOps', () => {
  test('sort ops by priority', () => {
    const ops: Operation[] = [
      { type: 'table.index.drop' },
      { type: 'column.create' },
      { type: 'table.unique.drop' },
      { type: 'table.create' },
      { type: 'table.drop' },
    ]
    ops.sort(sortOps)
    expect(ops).toEqual([
      { type: 'table.unique.drop' },
      { type: 'table.index.drop' },
      { type: 'table.drop' },
      { type: 'column.create' },
      { type: 'table.create' },
    ])
  })
})
