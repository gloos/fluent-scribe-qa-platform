import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react'
import { format } from 'date-fns'

interface SearchFiltersProps {
  onSearchChange: (query: string) => void
  onFiltersChange: (filters: FilterState) => void
  className?: string
  initialFilters?: Partial<FilterState>
}

export interface FilterState {
  searchQuery: string
  status: string[]
  severity: string[]
  errorTypes: string[]
  mqmScoreRange: [number, number]
  dateRange: {
    from?: Date
    to?: Date
  }
  fileTypes: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const defaultFilters: FilterState = {
  searchQuery: '',
  status: [],
  severity: [],
  errorTypes: [],
  mqmScoreRange: [0, 100],
  dateRange: {},
  fileTypes: [],
  sortBy: 'date',
  sortOrder: 'desc'
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  onSearchChange,
  onFiltersChange,
  className,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    ...initialFilters
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleSearchChange = (query: string) => {
    updateFilters({ searchQuery: query })
    onSearchChange(query)
  }

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    const currentArray = filters[key] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    
    updateFilters({ [key]: newArray })
  }

  const clearFilters = () => {
    const resetFilters = { ...defaultFilters }
    setFilters(resetFilters)
    onFiltersChange(resetFilters)
    onSearchChange('')
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.searchQuery) count++
    if (filters.status.length > 0) count++
    if (filters.severity.length > 0) count++
    if (filters.errorTypes.length > 0) count++
    if (filters.mqmScoreRange[0] > 0 || filters.mqmScoreRange[1] < 100) count++
    if (filters.dateRange.from || filters.dateRange.to) count++
    if (filters.fileTypes.length > 0) count++
    return count
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' }
  ]

  const severityOptions = [
    { value: 'critical', label: 'Critical', color: 'text-red-600' },
    { value: 'major', label: 'Major', color: 'text-orange-600' },
    { value: 'minor', label: 'Minor', color: 'text-yellow-600' }
  ]

  const errorTypeOptions = [
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'fluency', label: 'Fluency' },
    { value: 'terminology', label: 'Terminology' },
    { value: 'style', label: 'Style' },
    { value: 'locale', label: 'Locale Convention' },
    { value: 'other', label: 'Other' }
  ]

  const fileTypeOptions = [
    { value: 'xliff', label: 'XLIFF' },
    { value: 'xlf', label: 'XLF' },
    { value: 'mxliff', label: 'MXLIFF' }
  ]

  const sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'filename', label: 'File Name' },
    { value: 'mqm_score', label: 'MQM Score' },
    { value: 'error_count', label: 'Error Count' },
    { value: 'status', label: 'Status' }
  ]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files, error types, or content..."
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {filters.searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSearchChange('')}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-1">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>

          {getActiveFilterCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <Label className="text-sm">Sort by:</Label>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => updateFilters({ sortBy: value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateFilters({ 
              sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
            })}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => (
                  <Badge
                    key={option.value}
                    variant={filters.status.includes(option.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('status', option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Error Severity</Label>
              <div className="flex flex-wrap gap-2">
                {severityOptions.map(option => (
                  <Badge
                    key={option.value}
                    variant={filters.severity.includes(option.value) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer",
                      filters.severity.includes(option.value) && option.color
                    )}
                    onClick={() => toggleArrayFilter('severity', option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Error Types Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Error Types</Label>
              <div className="flex flex-wrap gap-2">
                {errorTypeOptions.map(option => (
                  <Badge
                    key={option.value}
                    variant={filters.errorTypes.includes(option.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('errorTypes', option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* MQM Score Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                MQM Score Range: {filters.mqmScoreRange[0]} - {filters.mqmScoreRange[1]}
              </Label>
              <Slider
                value={filters.mqmScoreRange}
                onValueChange={(value) => updateFilters({ mqmScoreRange: value as [number, number] })}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {filters.dateRange.from 
                        ? format(filters.dateRange.from, "PPP")
                        : "From date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.from}
                      onSelect={(date) => updateFilters({ 
                        dateRange: { ...filters.dateRange, from: date } 
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {filters.dateRange.to 
                        ? format(filters.dateRange.to, "PPP")
                        : "To date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange.to}
                      onSelect={(date) => updateFilters({ 
                        dateRange: { ...filters.dateRange, to: date } 
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* File Types */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">File Types</Label>
              <div className="flex flex-wrap gap-2">
                {fileTypeOptions.map(option => (
                  <Badge
                    key={option.value}
                    variant={filters.fileTypes.includes(option.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('fileTypes', option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{filters.searchQuery}"
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleSearchChange('')}
              />
            </Badge>
          )}
          
          {filters.status.map(status => (
            <Badge key={status} variant="secondary" className="gap-1">
              Status: {status}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter('status', status)}
              />
            </Badge>
          ))}

          {filters.severity.map(severity => (
            <Badge key={severity} variant="secondary" className="gap-1">
              Severity: {severity}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter('severity', severity)}
              />
            </Badge>
          ))}

          {(filters.mqmScoreRange[0] > 0 || filters.mqmScoreRange[1] < 100) && (
            <Badge variant="secondary" className="gap-1">
              MQM: {filters.mqmScoreRange[0]}-{filters.mqmScoreRange[1]}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ mqmScoreRange: [0, 100] })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
} 