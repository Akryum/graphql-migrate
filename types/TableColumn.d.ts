export type TableColumnType =
  'integer' |
  'bigInteger' |
  'text' |
  'string' |
  'float' |
  'decimal' |
  'boolean' |
  'date' |
  'datetime' |
  'time' |
  'timestamp' |
  'binary' |
  'enum' |
  'json' |
  'jsonb' |
  'uuid'

export interface ForeignKey {
  type: string
  field: string
  tableName: string?;
  columnName: string?;
}

export interface TableColumn {
  name: string
  comment: string?;
  annotations: any
  type: string
  args: Array
  notNull: boolean
  foreign: ForeignKey?;
  defaultValue: any
}
