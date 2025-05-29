import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  AlertCircle,
  X,
  FileX,
  Clock,
  TrendingDown,
  TrendingUp
} from 'lucide-react'

export type AlertVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  description?: string
  children?: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary'
  }
  icon?: React.ReactNode
  className?: string
}

const alertVariants = {
  default: {
    container: 'border-border bg-background text-foreground',
    icon: 'text-foreground',
    defaultIcon: AlertCircle
  },
  destructive: {
    container: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
    icon: 'text-red-600 dark:text-red-400',
    defaultIcon: XCircle
  },
  warning: {
    container: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400',
    icon: 'text-yellow-600 dark:text-yellow-400',
    defaultIcon: AlertTriangle
  },
  success: {
    container: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400',
    icon: 'text-green-600 dark:text-green-400',
    defaultIcon: CheckCircle
  },
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
    defaultIcon: Info
  }
} as const

export const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  title,
  description,
  children,
  dismissible = false,
  onDismiss,
  action,
  icon,
  className
}) => {
  const variantConfig = alertVariants[variant]
  const DefaultIcon = variantConfig.defaultIcon

  return (
    <Card className={cn(
      'p-4 border-l-4',
      variantConfig.container,
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", variantConfig.icon)}>
          {icon || <DefaultIcon className="h-5 w-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {title && (
                <h4 className="text-sm font-medium mb-1">
                  {title}
                </h4>
              )}
              
              {description && (
                <p className="text-xs opacity-90">
                  {description}
                </p>
              )}
              
              {children && (
                <div className="mt-2">
                  {children}
                </div>
              )}
              
              {action && (
                <Button
                  variant={action.variant || 'outline'}
                  size="sm"
                  className="mt-3 h-7 text-xs"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )}
            </div>
            
            {dismissible && onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-2 hover:bg-background/80"
                onClick={onDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// QA-specific Alert Components
export interface QAErrorAlertProps {
  errorCount: number
  segmentId: string
  onReview?: () => void
  onDismiss?: () => void
}

export const QAErrorAlert: React.FC<QAErrorAlertProps> = ({
  errorCount,
  segmentId,
  onReview,
  onDismiss
}) => {
  const variant = errorCount > 5 ? 'destructive' : 'warning'
  
  return (
    <Alert
      variant={variant}
      title={`${errorCount} Error${errorCount > 1 ? 's' : ''} Found`}
      description={`Segment ${segmentId} requires attention`}
      dismissible
      onDismiss={onDismiss}
      action={onReview ? {
        label: 'Review Errors',
        onClick: onReview,
        variant: 'outline'
      } : undefined}
    />
  )
}

export interface FileProcessingAlertProps {
  filename: string
  status: 'processing' | 'error' | 'success'
  message?: string
  onRetry?: () => void
  onDismiss?: () => void
}

export const FileProcessingAlert: React.FC<FileProcessingAlertProps> = ({
  filename,
  status,
  message,
  onRetry,
  onDismiss
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'processing':
        return {
          variant: 'info' as AlertVariant,
          title: 'Processing File',
          icon: <Clock className="h-5 w-5 animate-spin" />
        }
      case 'error':
        return {
          variant: 'destructive' as AlertVariant,
          title: 'Processing Failed',
          icon: <FileX className="h-5 w-5" />
        }
      case 'success':
        return {
          variant: 'success' as AlertVariant,
          title: 'File Processed Successfully',
          icon: <CheckCircle className="h-5 w-5" />
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Alert
      variant={config.variant}
      title={config.title}
      description={`${filename}${message ? ` - ${message}` : ''}`}
      icon={config.icon}
      dismissible={status !== 'processing'}
      onDismiss={onDismiss}
      action={status === 'error' && onRetry ? {
        label: 'Retry',
        onClick: onRetry,
        variant: 'outline'
      } : undefined}
    />
  )
}

export interface QualityScoreAlertProps {
  score: number
  threshold: number
  segmentCount: number
  onViewDetails?: () => void
  onDismiss?: () => void
}

export const QualityScoreAlert: React.FC<QualityScoreAlertProps> = ({
  score,
  threshold,
  segmentCount,
  onViewDetails,
  onDismiss
}) => {
  const variant = score < threshold ? 'warning' : 'success'
  const icon = score < threshold ? TrendingDown : TrendingUp
  const title = score < threshold 
    ? 'Quality Score Below Threshold'
    : 'Quality Score Target Met'

  return (
    <Alert
      variant={variant}
      title={title}
      description={`Score: ${score}% (${segmentCount} segments reviewed)`}
      icon={React.createElement(icon, { className: "h-5 w-5" })}
      dismissible
      onDismiss={onDismiss}
      action={onViewDetails ? {
        label: 'View Details',
        onClick: onViewDetails,
        variant: 'outline'
      } : undefined}
    />
  )
}

export interface SessionTimeoutAlertProps {
  minutesRemaining: number
  onExtend?: () => void
  onSave?: () => void
}

export const SessionTimeoutAlert: React.FC<SessionTimeoutAlertProps> = ({
  minutesRemaining,
  onExtend,
  onSave
}) => {
  const variant = minutesRemaining <= 5 ? 'destructive' : 'warning'
  
  return (
    <Alert
      variant={variant}
      title="Session Timeout Warning"
      description={`Your session will expire in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}. Save your work to prevent data loss.`}
      icon={<Clock className="h-5 w-5" />}
    >
      <div className="flex gap-2 mt-3">
        {onSave && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onSave}
          >
            Save Work
          </Button>
        )}
        {onExtend && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={onExtend}
          >
            Extend Session
          </Button>
        )}
      </div>
    </Alert>
  )
}

// Alert List Component for managing multiple alerts
export interface AlertListProps {
  alerts: Array<{
    id: string
    component: React.ReactNode
  }>
  className?: string
}

export const AlertList: React.FC<AlertListProps> = ({ alerts, className }) => {
  if (alerts.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      {alerts.map(alert => (
        <div key={alert.id}>
          {alert.component}
        </div>
      ))}
    </div>
  )
}

export default Alert 