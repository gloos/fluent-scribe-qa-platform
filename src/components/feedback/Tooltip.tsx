import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { 
  HelpCircle, 
  Info, 
  AlertCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'
export type TooltipVariant = 'default' | 'info' | 'warning' | 'error' | 'success'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: TooltipPosition
  variant?: TooltipVariant
  delay?: number
  disabled?: boolean
  className?: string
  maxWidth?: string
  showArrow?: boolean
}

const tooltipVariants = {
  default: 'bg-gray-900 text-white border-gray-700',
  info: 'bg-blue-900 text-blue-100 border-blue-700',
  warning: 'bg-yellow-900 text-yellow-100 border-yellow-700',
  error: 'bg-red-900 text-red-100 border-red-700',
  success: 'bg-green-900 text-green-100 border-green-700'
} as const

const arrowPositions = {
  top: 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full border-t-current border-x-transparent border-b-transparent',
  bottom: 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-full border-b-current border-x-transparent border-t-transparent',
  left: 'right-0 top-1/2 transform translate-x-full -translate-y-1/2 border-l-current border-y-transparent border-r-transparent',
  right: 'left-0 top-1/2 transform -translate-x-full -translate-y-1/2 border-r-current border-y-transparent border-l-transparent'
} as const

const tooltipPositions = {
  top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
} as const

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  variant = 'default',
  delay = 500,
  disabled = false,
  className,
  maxWidth = '300px',
  showArrow = true
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    if (disabled) return
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
      // Position adjustment logic could be added here
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      {isVisible && content && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 px-3 py-2 text-xs rounded-lg border shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            tooltipVariants[variant],
            tooltipPositions[actualPosition],
            className
          )}
          style={{ maxWidth }}
        >
          {content}
          
          {showArrow && (
            <div
              className={cn(
                "absolute w-0 h-0 border-4",
                arrowPositions[actualPosition]
              )}
              style={{ 
                borderColor: 'currentColor transparent transparent transparent',
                ...(actualPosition === 'bottom' && { borderColor: 'transparent transparent currentColor transparent' }),
                ...(actualPosition === 'left' && { borderColor: 'transparent transparent transparent currentColor' }),
                ...(actualPosition === 'right' && { borderColor: 'transparent currentColor transparent transparent' })
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Icon Tooltip Component
export interface IconTooltipProps {
  content: React.ReactNode
  variant?: TooltipVariant
  position?: TooltipPosition
  icon?: React.ReactNode
  className?: string
}

export const IconTooltip: React.FC<IconTooltipProps> = ({
  content,
  variant = 'default',
  position = 'top',
  icon,
  className
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <HelpCircle className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Tooltip
      content={content}
      variant={variant}
      position={position}
      className={className}
    >
      <button className="inline-flex items-center justify-center hover:opacity-80 transition-opacity">
        {icon || getDefaultIcon()}
      </button>
    </Tooltip>
  )
}

// QA-specific Tooltip Components
export interface QAErrorTooltipProps {
  error: {
    type: string
    severity: 'critical' | 'major' | 'minor' | 'info'
    description: string
    suggestion?: string
  }
  children: React.ReactNode
  position?: TooltipPosition
}

export const QAErrorTooltip: React.FC<QAErrorTooltipProps> = ({
  error,
  children,
  position = 'top'
}) => {
  const getVariant = (): TooltipVariant => {
    switch (error.severity) {
      case 'critical':
      case 'major':
        return 'error'
      case 'minor':
        return 'warning'
      case 'info':
        return 'info'
    }
  }

  const content = (
    <div className="space-y-2">
      <div className="font-medium">
        {error.type} ({error.severity})
      </div>
      <div className="text-xs opacity-90">
        {error.description}
      </div>
      {error.suggestion && (
        <div className="text-xs opacity-75 border-t border-current/20 pt-2">
          <strong>Suggestion:</strong> {error.suggestion}
        </div>
      )}
    </div>
  )

  return (
    <Tooltip
      content={content}
      variant={getVariant()}
      position={position}
      maxWidth="350px"
    >
      {children}
    </Tooltip>
  )
}

export interface SegmentInfoTooltipProps {
  segment: {
    id: string
    source: string
    target: string
    status: 'pending' | 'reviewed' | 'approved' | 'rejected'
    wordCount: number
    lastModified?: Date
  }
  children: React.ReactNode
  position?: TooltipPosition
}

export const SegmentInfoTooltip: React.FC<SegmentInfoTooltipProps> = ({
  segment,
  children,
  position = 'top'
}) => {
  const getStatusColor = () => {
    switch (segment.status) {
      case 'approved':
        return 'text-green-400'
      case 'rejected':
        return 'text-red-400'
      case 'reviewed':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const content = (
    <div className="space-y-2">
      <div className="font-medium">
        Segment {segment.id}
      </div>
      
      <div className="space-y-1 text-xs">
        <div>
          <span className="opacity-75">Status:</span>{' '}
          <span className={getStatusColor()}>
            {segment.status}
          </span>
        </div>
        
        <div>
          <span className="opacity-75">Word count:</span> {segment.wordCount}
        </div>
        
        {segment.lastModified && (
          <div>
            <span className="opacity-75">Modified:</span>{' '}
            {segment.lastModified.toLocaleDateString()}
          </div>
        )}
      </div>
      
      <div className="border-t border-current/20 pt-2 space-y-1">
        <div className="text-xs">
          <div className="opacity-75">Source:</div>
          <div className="italic">{segment.source}</div>
        </div>
        
        <div className="text-xs">
          <div className="opacity-75">Target:</div>
          <div className="italic">{segment.target}</div>
        </div>
      </div>
    </div>
  )

  return (
    <Tooltip
      content={content}
      variant="info"
      position={position}
      maxWidth="400px"
    >
      {children}
    </Tooltip>
  )
}

export interface QualityScoreTooltipProps {
  score: {
    overall: number
    accuracy: number
    fluency: number
    style: number
    terminology: number
  }
  children: React.ReactNode
  position?: TooltipPosition
}

export const QualityScoreTooltip: React.FC<QualityScoreTooltipProps> = ({
  score,
  children,
  position = 'top'
}) => {
  const getScoreColor = (value: number) => {
    if (value >= 90) return 'text-green-400'
    if (value >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const content = (
    <div className="space-y-2">
      <div className="font-medium">
        Quality Score Breakdown
      </div>
      
      <div className="space-y-1 text-xs">
        {Object.entries(score).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="opacity-75 capitalize">
              {key}:
            </span>
            <span className={getScoreColor(value)}>
              {value}%
            </span>
          </div>
        ))}
      </div>
      
      <div className="border-t border-current/20 pt-2 text-xs opacity-75">
        Based on MQM framework evaluation
      </div>
    </div>
  )

  return (
    <Tooltip
      content={content}
      variant={score.overall >= 90 ? 'success' : score.overall >= 70 ? 'warning' : 'error'}
      position={position}
      maxWidth="250px"
    >
      {children}
    </Tooltip>
  )
}

// Tooltip Provider for managing multiple tooltips
export interface TooltipContextType {
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined)

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  return (
    <TooltipContext.Provider value={{ activeTooltip, setActiveTooltip }}>
      {children}
    </TooltipContext.Provider>
  )
}

export const useTooltipContext = () => {
  const context = React.useContext(TooltipContext)
  if (!context) {
    throw new Error('useTooltipContext must be used within a TooltipProvider')
  }
  return context
}

export default Tooltip 