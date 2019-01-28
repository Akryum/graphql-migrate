import { TableColumn } from './TableColumn'

export interface Table {
  name: string
  comment: string?;
  columns: TableColumn[]
  columnMap: Map<string, TableColumn>
  indexes: TableIndex[]
  uniques: TableUnique[]
}

export interface TableIndex {
  columns: string[]
  name: string?;
  type: string?;
}

export interface TableUnique {
  columns: string[]
  name: string?;
}
