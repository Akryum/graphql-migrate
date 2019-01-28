import { TableColumn } from './TableColumn'

export interface Table {
  name: string
  comment: string?;
  annotations: any
  columns: TableColumn[]
  columnMap: Map<string, TableColumn>
  indexes: TableIndex[]
  primaries: TablePrimary[]
  uniques: TableUnique[]
}

export interface TableIndex {
  columns: string[]
  name: string?;
  type: string?;
}

export interface TablePrimary {
  columns: string[]
  name: string?;
}

export interface TableUnique {
  columns: string[]
  name: string?;
}
