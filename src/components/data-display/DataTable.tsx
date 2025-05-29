import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Pagination } from '@/components/navigation/Pagination'

export interface DataTableColumn<T = any> {
  key: string
  header: string
  accessor?: string | ((row: T) => any)
  sortable?: boolean
  filterable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: T, index: number) => React.ReactNode
  className?: string
}

export interface DataTableAction<T = any> {
  label: string
  icon?: React.ReactNode
  onClick: (row: T, index: number) => void
  variant?: 'default' | 'destructive' | 'secondary'
  show?: (row: T) => boolean
}

interface DataTableProps<T = any> {
  data: T[]
  columns: DataTableColumn<T>[]
  actions?: DataTableAction<T>[]
  className?: string
  loading?: boolean
  emptyMessage?: string
  searchable?: boolean
  selectable?: boolean
  onSelectionChange?: (selectedRows: T[]) => void
  pagination?: boolean
  pageSize?: number
  sortable?: boolean
  filterable?: boolean
  exportable?: boolean
  onExport?: (data: T[]) => void
}

type SortConfig = {
  key: string
  direction: 'asc' | 'desc'
} | null

export const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  className,
  loading = false,
  emptyMessage = 'No data available',
  searchable = true,
  selectable = false,
  onSelectionChange,
  pagination = true,
  pageSize = 25,
  sortable = true,
  filterable = true,
  exportable = false,
  onExport
}: DataTableProps<T>) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [selectedRows, setSelectedRows] = useState<T[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(pageSize)

  // Get value from row using accessor
  const getValue = (row: T, column: DataTableColumn<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row)
    }
    const key = column.accessor || column.key
    return key.split('.').reduce((obj, k) => obj?.[k], row)
  }

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data

    return data.filter(row =>
      columns.some(column => {
        if (!column.filterable) return false
        const value = getValue(row, column)
        return String(value).toLowerCase().includes(searchQuery.toLowerCase())
      })
    )
  }, [data, searchQuery, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    return [...filteredData].sort((a, b) => {
      const column = columns.find(col => col.key === sortConfig.key)
      if (!column) return 0

      const aValue = getValue(a, column)
      const bValue = getValue(b, column)

      if (aValue === bValue) return 0

      const comparison = aValue < bValue ? -1 : 1
      return sortConfig.direction === 'desc' ? -comparison : comparison
    })
  }, [filteredData, sortConfig, columns])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData

    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, currentPage, itemsPerPage, pagination])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  // Handle sorting
  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return

    setSortConfig(current => {
      if (current?.key === column.key) {
        if (current.direction === 'asc') {
          return { key: column.key, direction: 'desc' }
        } else {
          return null
        }
      }
      return { key: column.key, direction: 'asc' }
    })
  }

  // Handle row selection
  const handleRowSelection = (row: T, checked: boolean) => {
    const newSelection = checked
      ? [...selectedRows, row]
      : selectedRows.filter(selected => selected !== row)
    
    setSelectedRows(newSelection)
    onSelectionChange?.(newSelection)
  }

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? [...paginatedData] : []
    setSelectedRows(newSelection)
    onSelectionChange?.(newSelection)
  }

  const isRowSelected = (row: T) => selectedRows.includes(row)
  const isAllSelected = paginatedData.length > 0 && paginatedData.every(row => isRowSelected(row))
  const isIndeterminate = selectedRows.length > 0 && !isAllSelected

  if (loading) {
    return (
      <div className="w-full space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Table Actions */}
      {(searchable || exportable || selectedRows.length > 0) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            )}
            
            {selectedRows.length > 0 && (
              <Badge variant="secondary">
                {selectedRows.length} selected
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {exportable && onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport(selectedRows.length > 0 ? selectedRows : sortedData)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.width && `w-[${column.width}]`,
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.sortable && 'cursor-pointer hover:bg-muted/50',
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(column)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={cn(
                            "h-3 w-3",
                            sortConfig?.key === column.key && sortConfig.direction === 'asc'
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 -mt-1",
                            sortConfig?.key === column.key && sortConfig.direction === 'desc'
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        />
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}
              
              {actions.length > 0 && (
                <TableHead className="w-16">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow key={index} className="hover:bg-muted/50">
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isRowSelected(row)}
                        onCheckedChange={(checked) => handleRowSelection(row, !!checked)}
                      />
                    </TableCell>
                  )}
                  
                  {columns.map((column) => {
                    const value = getValue(row, column)
                    const content = column.render ? column.render(value, row, index) : value
                    
                    return (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.className
                        )}
                      >
                        {content}
                      </TableCell>
                    )
                  })}
                  
                  {actions.length > 0 && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action, actionIndex) => {
                            if (action.show && !action.show(row)) return null
                            
                            return (
                              <DropdownMenuItem
                                key={actionIndex}
                                onClick={() => action.onClick(row, index)}
                                className={cn(
                                  action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                                )}
                              >
                                {action.icon && <span className="mr-2">{action.icon}</span>}
                                {action.label}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}
    </div>
  )
}

// Default actions for common use cases
export const getDefaultActions = <T,>(
  onView?: (row: T) => void,
  onEdit?: (row: T) => void,
  onDelete?: (row: T) => void
): DataTableAction<T>[] => {
  const actions: DataTableAction<T>[] = []

  if (onView) {
    actions.push({
      label: 'View',
      icon: <Eye className="h-4 w-4" />,
      onClick: onView
    })
  }

  if (onEdit) {
    actions.push({
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      onClick: onEdit
    })
  }

  if (onDelete) {
    actions.push({
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onDelete,
      variant: 'destructive'
    })
  }

  return actions
}

export default DataTable 