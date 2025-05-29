import React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  FileText,
  Target,
  TrendingUp
} from 'lucide-react'

export interface ProgressProps {
  value: number
  max?: number
  className?: string
  showValue?: boolean
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  description?: string
}

const progressVariants = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  destructive: 'bg-red-500'
} as const

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
} as const

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className,
  showValue = false,
  variant = 'default',
  size = 'md',
  label,
  description
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-foreground">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-sm text-muted-foreground">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={cn(
        "w-full bg-secondary rounded-full overflow-hidden",
        progressSizes[size]
      )}>
        <div
          className={cn(
            "transition-all duration-300 ease-in-out rounded-full",
            progressSizes[size],
            progressVariants[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      )}
    </div>
  )
}

// Circular Progress Component
export interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  children?: React.ReactNode
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  showValue = true,
  variant = 'default',
  children
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const colors = {
    default: 'stroke-primary',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    destructive: 'stroke-red-500'
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn("transition-all duration-300 ease-in-out", colors[variant])}
        />
      </svg>
      
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span className="text-sm font-medium text-foreground">
            {Math.round(percentage)}%
          </span>
        ))}
      </div>
    </div>
  )
}

// Multi-step Progress Component
export interface Step {
  id: string
  title: string
  description?: string
  status: 'pending' | 'current' | 'completed' | 'error'
}

export interface StepProgressProps {
  steps: Step[]
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  className,
  orientation = 'horizontal'
}) => {
  const getStepIcon = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'current':
        return <Clock className="h-5 w-5 text-blue-600" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getStepStyles = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'current':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  if (orientation === 'vertical') {
    return (
      <div className={cn("space-y-4", className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2",
                getStepStyles(step.status)
              )}>
                {getStepIcon(step.status)}
              </div>
              {index < steps.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 mt-2" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground">
                {step.title}
              </h4>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full border-2",
              getStepStyles(step.status)
            )}>
              {getStepIcon(step.status)}
            </div>
            <span className="text-xs font-medium mt-2 text-center max-w-20">
              {step.title}
            </span>
          </div>
          
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 bg-gray-200 mx-4 mt-4" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// QA-specific Progress Components
export interface QASessionProgressProps {
  currentSegment: number
  totalSegments: number
  errorsFound: number
  qualityScore: number
  className?: string
}

export const QASessionProgress: React.FC<QASessionProgressProps> = ({
  currentSegment,
  totalSegments,
  errorsFound,
  qualityScore,
  className
}) => {
  const progressPercentage = (currentSegment / totalSegments) * 100
  const scoreVariant = qualityScore >= 90 ? 'success' : qualityScore >= 70 ? 'warning' : 'destructive'

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">QA Session Progress</h3>
          <span className="text-xs text-muted-foreground">
            {currentSegment} of {totalSegments} segments
          </span>
        </div>
        
        <Progress
          value={currentSegment}
          max={totalSegments}
          variant="default"
          showValue
        />
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-foreground">
              {currentSegment}
            </div>
            <div className="text-xs text-muted-foreground">Reviewed</div>
          </div>
          
          <div>
            <div className="text-lg font-semibold text-red-600">
              {errorsFound}
            </div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          
          <div>
            <div className={cn(
              "text-lg font-semibold",
              scoreVariant === 'success' ? 'text-green-600' :
              scoreVariant === 'warning' ? 'text-yellow-600' : 'text-red-600'
            )}>
              {qualityScore}%
            </div>
            <div className="text-xs text-muted-foreground">Quality</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export interface FileUploadProgressProps {
  filename: string
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  onCancel?: () => void
  className?: string
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  filename,
  progress,
  status,
  onCancel,
  className
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'uploading':
        return {
          variant: 'default' as const,
          label: 'Uploading...',
          icon: <TrendingUp className="h-4 w-4 text-blue-600" />
        }
      case 'processing':
        return {
          variant: 'default' as const,
          label: 'Processing...',
          icon: <Clock className="h-4 w-4 text-blue-600 animate-spin" />
        }
      case 'completed':
        return {
          variant: 'success' as const,
          label: 'Completed',
          icon: <CheckCircle className="h-4 w-4 text-green-600" />
        }
      case 'error':
        return {
          variant: 'destructive' as const,
          label: 'Failed',
          icon: <AlertTriangle className="h-4 w-4 text-red-600" />
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {filename}
            </p>
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-xs text-muted-foreground">
                {config.label}
              </span>
            </div>
          </div>
          
          {onCancel && status !== 'completed' && (
            <button
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
        
        {status !== 'completed' && (
          <Progress
            value={progress}
            variant={config.variant}
            showValue
            size="sm"
          />
        )}
      </div>
    </Card>
  )
}

export default Progress 