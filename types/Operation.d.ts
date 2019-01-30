export type OperationType =
  'table.create' |
  'table.rename' |
  'table.comment.set' |
  'table.drop' |
  'table.index.create' |
  'table.index.drop' |
  'table.primary.set' |
  'table.unique.create' |
  'table.unique.drop' |
  'table.foreign.create' |
  'table.foreign.drop' |
  'column.create' |
  'column.rename' |
  'column.type.set' |
  'column.comment.set' |
  'column.drop' |
  'column.nullable.set' |
  'column.default.set'

export interface Operation {
  type: OperationType
}

export interface TableCreateOperation extends Operation {
  type: 'table.create'
  table: string
}

export interface TableRenameOperation extends Operation {
  type: 'table.rename'
  fromName: string
  toName: string
}

export interface TableCommentSetOperation extends Operation {
  type: 'table.comment.set'
  table: string
  comment: string | null
}

export interface TableDropOperation extends Operation {
  type: 'table.drop'
  table: string
}

export interface TableIndexCreateOperation extends Operation {
  type: 'table.index.create'
  table: string
  columns: string[]
  indexName: string | null
  indexType: string | null
}

export interface TableIndexDropOperation extends Operation {
  type: 'table.index.drop'
  table: string
  columns: string[]
  indexName: string | null
}

export interface TablePrimarySetOperation extends Operation {
  type: 'table.primary.set'
  table: string
  columns: string[] | null
  indexName: string | null
}

export interface TableUniqueCreateOperation extends Operation {
  type: 'table.unique.create'
  table: string
  columns: string[]
  indexName: string | null
}

export interface TableUniqueDropOperation extends Operation {
  type: 'table.unique.drop'
  table: string
  columns: string[]
  indexName: string | null
}

export interface TableForeignCreateOperation extends Operation {
  type: 'table.foreign.create'
  table: string
  column: string
  reference: string
}

export interface TableForeignDropOperation extends Operation {
  type: 'table.foreign.drop'
  table: string
  column: string
}

export interface ColumnCreateOperation extends Operation {
  type: 'column.create'
  table: string
  column: string
  columnType: string
  args: string[]
}

export interface ColumnTypeSetOperation extends Operation {
  type: 'column.type.set'
  table: string
  column: string
  columnType: string
  args: string[]
}

export interface ColumnRenameOperation extends Operation {
  type: 'column.rename'
  table: string
  fromName: string
  toName: string
}

export interface ColumnCommentSetOperation extends Operation {
  type: 'column.comment.set'
  table: string
  column: string
  comment: string | null
}

export interface ColumnDropOperation extends Operation {
  type: 'column.drop'
  table: string
  column: string
}

export interface ColumnNullableSetOperation extends Operation {
  type: 'column.nullable.set'
  table: string
  column: string
  nullable: boolean
}

export interface ColumnDefaultSetOperation extends Operation {
  type: 'column.default.set'
  table: string
  column: string
  value: any
}
