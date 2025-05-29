import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3,
  Activity
} from 'lucide-react'

interface MetricsCardProps {
  title: string
  value: string | number
  subtitle?: string
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    label?: string
  }
  progress?: {
    value: number
    max?: number
    color?: 'default' | 'success' | 'warning' | 'danger'
  }
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  variant?: 'default' | 'outline' | 'filled'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
  switch (direction) {
    case 'up':
      return <TrendingUp className="h-4 w-4" />
    case 'down':
      return <TrendingDown className="h-4 w-4" />
    case 'neutral':
      return <Minus className="h-4 w-4" />
  }
}

const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
  switch (direction) {
    case 'up':
      return 'text-green-600 dark:text-green-400'
    case 'down':
      return 'text-red-600 dark:text-red-400'
    case 'neutral':
      return 'text-gray-600 dark:text-gray-400'
  }
}

const getProgressColor = (color: string) => {
  switch (color) {
    case 'success':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'danger':
      return 'bg-red-500'
    default:
      return 'bg-primary'
  }
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  subtitle,
  description,
  icon,
  trend,
  progress,
  badge,
  variant = 'default',
  size = 'md',
  className,
  onClick
}) => {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  }

  const cardClasses = cn(
    "transition-all duration-200",
    onClick && "cursor-pointer hover:shadow-md",
    variant === 'filled' && "bg-primary text-primary-foreground",
    className
  )

  return (
    <Card className={cardClasses} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge variant={badge.variant}>
              {badge.text}
            </Badge>
          )}
          {icon && (
            <div className="h-4 w-4 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={sizeClasses[size]}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className={cn("font-bold", valueSizeClasses[size])}>
              {value}
            </div>
            
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
            
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                getTrendColor(trend.direction)
              )}>
                {getTrendIcon(trend.direction)}
                <span>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                  {trend.label && ` ${trend.label}`}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {progress && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress.value}%</span>
            </div>
            <Progress 
              value={progress.value} 
              className="h-2"
            />
          </div>
        )}
        
        {description && (
          <p className="text-xs text-muted-foreground mt-2">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Pre-configured QA-specific metric cards
export const QualityScoreCard: React.FC<{
  score: number
  trend?: number
  className?: string
}> = ({ score, trend, className }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success'
    if (score >= 70) return 'warning'
    return 'danger'
  }

  const scoreColor = getScoreColor(score)
  const icon = score >= 90 ? <CheckCircle /> : score >= 70 ? <AlertTriangle /> : <XCircle />

  return (
    <MetricsCard
      title="Quality Score"
      value={`${score}%`}
      subtitle="Overall MQM Score"
      icon={icon}
      progress={{
        value: score,
        color: scoreColor
      }}
      trend={trend ? {
        value: trend,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
        label: 'from last week'
      } : undefined}
      className={className}
    />
  )
}

export const ErrorCountCard: React.FC<{
  errorCount: number
  totalSegments: number
  trend?: number
  className?: string
}> = ({ errorCount, totalSegments, trend, className }) => {
  const errorRate = totalSegments > 0 ? (errorCount / totalSegments) * 100 : 0
  
  return (
    <MetricsCard
      title="Errors Found"
      value={errorCount}
      subtitle={`${errorRate.toFixed(1)}% error rate`}
      icon={<AlertTriangle />}
      badge={{
        text: `${totalSegments} segments`,
        variant: 'secondary'
      }}
      trend={trend ? {
        value: trend,
        direction: trend < 0 ? 'up' : trend > 0 ? 'down' : 'neutral', // Less errors is better
        label: 'vs last session'
      } : undefined}
      className={className}
    />
  )
}

export const ProductivityCard: React.FC<{
  segmentsPerHour: number
  hoursWorked: number
  trend?: number
  className?: string
}> = ({ segmentsPerHour, hoursWorked, trend, className }) => {
  return (
    <MetricsCard
      title="Productivity"
      value={segmentsPerHour}
      subtitle={`segments/hour • ${hoursWorked}h worked`}
      icon={<Activity />}
      trend={trend ? {
        value: trend,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
        label: 'vs average'
      } : undefined}
      className={className}
    />
  )
}

export const SessionProgressCard: React.FC<{
  completed: number
  total: number
  estimatedCompletion?: string
  className?: string
}> = ({ completed, total, estimatedCompletion, className }) => {
  const progress = total > 0 ? (completed / total) * 100 : 0
  
  return (
    <MetricsCard
      title="Session Progress"
      value={`${completed}/${total}`}
      subtitle={estimatedCompletion ? `ETA: ${estimatedCompletion}` : 'segments reviewed'}
      icon={<Target />}
      progress={{
        value: progress,
        color: progress >= 80 ? 'success' : progress >= 40 ? 'warning' : 'default'
      }}
      className={className}
    />
  )
}

// Grid layout for multiple metrics
export const MetricsGrid: React.FC<{
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}> = ({ children, columns = 3, className }) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={cn("grid gap-4", gridClasses[columns], className)}>
      {children}
    </div>
  )
}

export default MetricsCard 