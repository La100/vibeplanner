import { RowData } from '@tanstack/react-table'

declare module '@tanstack/table-core' {
  interface ColumnMeta<TData extends RowData, TValue> {
    name?: string
    icon?: React.ComponentType<{ className?: string }>
  }
} 