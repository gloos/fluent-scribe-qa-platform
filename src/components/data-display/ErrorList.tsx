import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Search,
  Filter,
  Clock,
  User,
  FileText,
  MapPin
} from 'lucide-react'

export interface QAError {
  id: string
  type: string
  severity: 'critical' | 'major' | 'minor' | 'info'
  message: string
  description?: string
  segmentId: string
  segmentText: string
  position?: {
    start: number
    end: number
  }
  category: string
  subcategory?: string
  createdAt: string
  createdBy: string
  resolved?: boolean
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

interface ErrorListProps {
  errors: QAError[]
  className?: string
  showFilters?: boolean
  groupBy?: 'severity' | 'category' | 'type' | 'none'
  onErrorClick?: (error: QAError) => void
  onErrorResolve?: (errorId: string) => void
  maxHeight?: string
}

const getSeverityIcon = (severity: QAError['severity']) => {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'major':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />
    case 'minor':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

const getSeverityBadgeVariant = (severity: QAError['severity']) => {
  switch (severity) {
    case 'critical':
      return 'destructive'
    case 'major':
      return 'secondary'
    case 'minor':
      return 'outline'
    case 'info':
      return 'default'
    default:
      return 'secondary'
  }
}

const getSeverityColor = (severity: QAError['severity']) => {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
    case 'major':
      return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
    case 'minor':
      return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
    case 'info':
      return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
  }
}

export const ErrorList: React.FC<ErrorListProps> = ({
  errors,
  className,
  showFilters = true,
  groupBy = 'none',
  onErrorClick,
  onErrorResolve,
  maxHeight = '600px'
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [resolvedFilter, setResolvedFilter] = useState<string>('all')

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = [...new Set(errors.map(error => error.category))]
    return cats.sort()
  }, [errors])

  // Filter errors
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      const matchesSearch = !searchQuery || 
        error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        error.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        error.segmentText.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSeverity = severityFilter === 'all' || error.severity === severityFilter
      const matchesCategory = categoryFilter === 'all' || error.category === categoryFilter
      const matchesResolved = resolvedFilter === 'all' || 
        (resolvedFilter === 'resolved' && error.resolved) ||
        (resolvedFilter === 'unresolved' && !error.resolved)

      return matchesSearch && matchesSeverity && matchesCategory && matchesResolved
    })
  }, [errors, searchQuery, severityFilter, categoryFilter, resolvedFilter])

  // Group errors
  const groupedErrors = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Errors': filteredErrors }
    }

    const groups: Record<string, QAError[]> = {}
    filteredErrors.forEach(error => {
      const key = groupBy === 'severity' ? error.severity :
                   groupBy === 'category' ? error.category :
                   groupBy === 'type' ? error.type : 'default'
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(error)
    })

    return groups
  }, [filteredErrors, groupBy])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Severity Filter */}
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Resolved Filter */}
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Errors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Errors</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Count Summary */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing {filteredErrors.length} of {errors.length} errors
        </div>
        <div className="flex gap-2">
          {Object.entries(
            filteredErrors.reduce((acc, error) => {
              acc[error.severity] = (acc[error.severity] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          ).map(([severity, count]) => (
            <Badge 
              key={severity} 
              variant={getSeverityBadgeVariant(severity as QAError['severity'])}
              className="text-xs"
            >
              {severity}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Error Groups */}
      <div 
        className="space-y-4 overflow-y-auto pr-2"
        style={{ maxHeight }}
      >
        {Object.entries(groupedErrors).map(([groupName, groupErrors]) => (
          <div key={groupName}>
            {groupBy !== 'none' && (
              <div className="mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {groupName} ({groupErrors.length})
                </h3>
                <Separator className="mt-1" />
              </div>
            )}
            
            <div className="space-y-2">
              {groupErrors.map((error) => (
                <Card 
                  key={error.id} 
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md border-l-4",
                    getSeverityColor(error.severity),
                    error.resolved && "opacity-60"
                  )}
                  onClick={() => onErrorClick?.(error)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(error.severity)}
                          <Badge variant={getSeverityBadgeVariant(error.severity)}>
                            {error.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {error.type}
                          </Badge>
                          {error.resolved && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm">{error.message}</h4>
                          {error.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {error.description}
                            </p>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Segment {error.segmentId}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(error.createdAt)}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {error.createdBy}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs bg-muted p-2 rounded">
                          <div className="flex items-center gap-1 mb-1">
                            <FileText className="h-3 w-3" />
                            <span className="font-medium">Segment Text:</span>
                          </div>
                          <p className="text-muted-foreground">{error.segmentText}</p>
                        </div>

                        {error.notes && (
                          <div className="text-xs">
                            <span className="font-medium">Notes:</span>
                            <p className="text-muted-foreground">{error.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {!error.resolved && onErrorResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              onErrorResolve(error.id)
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredErrors.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No errors found</h3>
              <p className="text-sm text-muted-foreground">
                {errors.length === 0 
                  ? "No errors have been detected in this session."
                  : "No errors match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Quick error summary component
export const ErrorSummary: React.FC<{
  errors: QAError[]
  className?: string
}> = ({ errors, className }) => {
  const summary = useMemo(() => {
    const total = errors.length
    const resolved = errors.filter(e => e.resolved).length
    const bySeverity = errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, resolved, bySeverity }
  }, [errors])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm">Error Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>Total Errors:</span>
          <span className="font-medium">{summary.total}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Resolved:</span>
          <span className="font-medium text-green-600">{summary.resolved}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Pending:</span>
          <span className="font-medium text-orange-600">{summary.total - summary.resolved}</span>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          {Object.entries(summary.bySeverity).map(([severity, count]) => (
            <div key={severity} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                {getSeverityIcon(severity as QAError['severity'])}
                <span className="capitalize">{severity}</span>
              </div>
              <Badge variant={getSeverityBadgeVariant(severity as QAError['severity'])}>
                {count}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default ErrorList 