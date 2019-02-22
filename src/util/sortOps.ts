import { Operation, OperationType } from '../diff/Operation'

const priority: OperationType[] = [
  'table.foreign.drop',
  'table.unique.drop',
  'table.index.drop',
  'column.drop',
  'table.drop',
]

function getPriority (op: Operation) {
  const index = priority.indexOf(op.type)
  if (index === -1) {
    return 999
  }
  return index
}

export function sortOps (a: Operation, b: Operation): number {
  return getPriority(a) - getPriority(b)
}
