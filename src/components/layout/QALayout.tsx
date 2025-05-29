import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// QA Session Layout for organizing analysis content
interface QASessionLayoutProps {
  children: React.ReactNode
  className?: string
  sessionInfo?: {
    fileName: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    mqmScore?: number
    errorCount?: number
  }
  sidebar?: React.ReactNode
}

export const QASessionLayout: React.FC<QASessionLayoutProps> = ({
  children,
  className,
  sessionInfo,
  sidebar
}) => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default'
      case 'processing': return 'secondary'
      case 'failed': return 'destructive'
      default: return 'outline'
    }
  }

  const getMQMColor = (score?: number) => {
    if (!score) return 'text-muted-foreground'
    if (score <= 5) return 'text-green-600'
    if (score <= 15) return 'text-yellow-600'
    if (score <= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Session Header */}
      {sessionInfo && (
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">{sessionInfo.fileName}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Badge variant={getStatusVariant(sessionInfo.status)}>
                  {sessionInfo.status}
                </Badge>
                {sessionInfo.mqmScore !== undefined && (
                  <span className={getMQMColor(sessionInfo.mqmScore)}>
                    MQM Score: {sessionInfo.mqmScore}
                  </span>
                )}
                {sessionInfo.errorCount !== undefined && (
                  <span>
                    {sessionInfo.errorCount} errors found
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for filters/navigation */}
        {sidebar && (
          <div className="w-80 border-r bg-card/50 overflow-y-auto">
            {sidebar}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// Translation Segment Layout for side-by-side source/target display
interface TranslationSegmentLayoutProps {
  children: React.ReactNode
  className?: string
  sourceText?: string
  targetText?: string
  segmentId?: string
  errors?: Array<{
    id: string
    severity: 'minor' | 'major' | 'critical'
    type: string
    description: string
  }>
}

export const TranslationSegmentLayout: React.FC<TranslationSegmentLayoutProps> = ({
  children,
  className,
  sourceText,
  targetText,
  segmentId,
  errors = []
}) => {
  const hasErrors = errors.length > 0
  const criticalCount = errors.filter(e => e.severity === 'critical').length
  const majorCount = errors.filter(e => e.severity === 'major').length

  return (
    <Card className={cn(
      "mb-4",
      hasErrors && "border-l-4",
      criticalCount > 0 && "border-l-red-500",
      majorCount > 0 && !criticalCount && "border-l-orange-500",
      hasErrors && !criticalCount && !majorCount && "border-l-yellow-500",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {segmentId && (
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Segment {segmentId}
            </CardTitle>
          )}
          {hasErrors && (
            <div className="flex gap-1">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} Critical
                </Badge>
              )}
              {majorCount > 0 && (
                <Badge className="text-xs bg-orange-100 text-orange-800">
                  {majorCount} Major
                </Badge>
              )}
              {errors.length - criticalCount - majorCount > 0 && (
                <Badge className="text-xs bg-yellow-100 text-yellow-800">
                  {errors.length - criticalCount - majorCount} Minor
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Source and Target Text */}
        {(sourceText || targetText) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sourceText && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Source
                </label>
                <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border">
                  <p className="text-sm">{sourceText}</p>
                </div>
              </div>
            )}
            {targetText && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Target
                </label>
                <div className={cn(
                  "mt-1 p-3 rounded-md border",
                  hasErrors 
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200" 
                    : "bg-green-50 dark:bg-green-900/20"
                )}>
                  <p className="text-sm">{targetText}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Details */}
        {hasErrors && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Issues Found
            </label>
            <div className="space-y-2">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className={cn(
                    "p-3 rounded-md border-l-4 text-sm",
                    error.severity === 'critical' && "bg-red-50 border-l-red-500 dark:bg-red-900/20",
                    error.severity === 'major' && "bg-orange-50 border-l-orange-500 dark:bg-orange-900/20",
                    error.severity === 'minor' && "bg-yellow-50 border-l-yellow-500 dark:bg-yellow-900/20"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{error.type}</p>
                      <p className="text-muted-foreground mt-1">{error.description}</p>
                    </div>
                    <Badge
                      variant={error.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="ml-2"
                    >
                      {error.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Content */}
        {children}
      </CardContent>
    </Card>
  )
}

// Dashboard Layout for overview and statistics
interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
  actions?: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  title,
  description,
  actions
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Dashboard Header */}
      {(title || description || actions) && (
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {title && (
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            )}
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Dashboard Content */}
      {children}
    </div>
  )
}

// Panel Layout for organized content sections
interface PanelLayoutProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  variant?: 'default' | 'outline' | 'ghost'
}

export const PanelLayout: React.FC<PanelLayoutProps> = ({
  children,
  className,
  title,
  description,
  icon,
  actions,
  variant = 'default'
}) => {
  return (
    <Card className={cn(
      variant === 'outline' && "border-dashed",
      variant === 'ghost' && "border-none shadow-none",
      className
    )}>
      {(title || description || icon || actions) && (
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {icon && (
                <div className="mt-1">{icon}</div>
              )}
              <div className="space-y-1">
                {title && <CardTitle>{title}</CardTitle>}
                {description && <CardDescription>{description}</CardDescription>}
              </div>
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
} 