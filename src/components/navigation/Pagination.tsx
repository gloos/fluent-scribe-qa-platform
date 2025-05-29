import React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  className?: string
  showItemsPerPage?: boolean
  showTotalItems?: boolean
  showPageNumbers?: boolean
  maxVisiblePages?: number
  itemsPerPageOptions?: number[]
  size?: 'sm' | 'md' | 'lg'
}

const defaultItemsPerPageOptions = [10, 25, 50, 100]

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className,
  showItemsPerPage = true,
  showTotalItems = true,
  showPageNumbers = true,
  maxVisiblePages = 5,
  itemsPerPageOptions = defaultItemsPerPageOptions,
  size = 'md'
}) => {
  // Calculate visible page numbers
  const getVisiblePages = (): number[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const halfVisible = Math.floor(maxVisiblePages / 2)
    let startPage = Math.max(currentPage - halfVisible, 1)
    let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages)

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(endPage - maxVisiblePages + 1, 1)
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
  }

  const visiblePages = getVisiblePages()
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const buttonSizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-base'
  }

  const buttonSize = buttonSizes[size]

  if (totalPages <= 1 && !showTotalItems) {
    return null
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {/* Items per page selector and total count */}
      <div className="flex items-center space-x-4">
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-16 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        )}

        {showTotalItems && (
          <div className="text-sm text-muted-foreground">
            {totalItems > 0 ? (
              <>
                Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{' '}
                <span className="font-medium">{totalItems.toLocaleString()}</span> results
              </>
            ) : (
              'No results found'
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-1">
          {/* Previous button */}
          <Button
            variant="outline"
            size="sm"
            className={cn(buttonSize)}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {showPageNumbers && (
            <>
              {/* First page + ellipsis */}
              {visiblePages[0] > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(buttonSize)}
                    onClick={() => onPageChange(1)}
                  >
                    1
                  </Button>
                  {visiblePages[0] > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(buttonSize)}
                      disabled
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}

              {/* Visible page numbers */}
              {visiblePages.map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  className={cn(buttonSize)}
                  onClick={() => onPageChange(page)}
                  aria-label={`Go to page ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </Button>
              ))}

              {/* Last page + ellipsis */}
              {visiblePages[visiblePages.length - 1] < totalPages && (
                <>
                  {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(buttonSize)}
                      disabled
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(buttonSize)}
                    onClick={() => onPageChange(totalPages)}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </>
          )}

          {/* Next button */}
          <Button
            variant="outline"
            size="sm"
            className={cn(buttonSize)}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Simplified pagination for mobile or compact layouts
interface SimplePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  showPageInfo?: boolean
}

export const SimplePagination: React.FC<SimplePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageInfo = true
}) => {
  if (totalPages <= 1) return null

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      {showPageInfo && (
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-2"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Hook for managing pagination state
export const usePagination = (
  totalItems: number,
  initialItemsPerPage: number = 25
) => {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(initialItemsPerPage)

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Reset to page 1 when items per page changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // Ensure current page is valid when total items change
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const onPageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const onItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
  }

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    // Helper to get slice indices for array pagination
    getSliceIndices: () => ({
      start: (currentPage - 1) * itemsPerPage,
      end: currentPage * itemsPerPage
    })
  }
}

export default Pagination 