import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Award,
  Target,
  BarChart3
} from 'lucide-react'

interface QAScoreDisplayProps {
  score: number
  maxScore?: number
  label?: string
  showTrend?: boolean
  trend?: number
  showGrading?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'circular' | 'compact'
}

const getScoreGrade = (score: number, maxScore: number = 100) => {
  const percentage = (score / maxScore) * 100
  
  if (percentage >= 95) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-100' }
  if (percentage >= 90) return { grade: 'A', color: 'text-green-600', bgColor: 'bg-green-100' }
  if (percentage >= 85) return { grade: 'A-', color: 'text-green-500', bgColor: 'bg-green-50' }
  if (percentage >= 80) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-100' }
  if (percentage >= 75) return { grade: 'B', color: 'text-blue-500', bgColor: 'bg-blue-50' }
  if (percentage >= 70) return { grade: 'B-', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
  if (percentage >= 65) return { grade: 'C+', color: 'text-orange-600', bgColor: 'bg-orange-100' }
  if (percentage >= 60) return { grade: 'C', color: 'text-orange-500', bgColor: 'bg-orange-50' }
  if (percentage >= 55) return { grade: 'C-', color: 'text-red-600', bgColor: 'bg-red-100' }
  if (percentage >= 50) return { grade: 'D', color: 'text-red-700', bgColor: 'bg-red-200' }
  return { grade: 'F', color: 'text-red-800', bgColor: 'bg-red-300' }
}

const getScoreIcon = (score: number, maxScore: number = 100) => {
  const percentage = (score / maxScore) * 100
  
  if (percentage >= 90) return <CheckCircle className="h-5 w-5 text-green-600" />
  if (percentage >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-600" />
  return <XCircle className="h-5 w-5 text-red-600" />
}

const getProgressColor = (score: number, maxScore: number = 100) => {
  const percentage = (score / maxScore) * 100
  
  if (percentage >= 90) return 'bg-green-500'
  if (percentage >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

export const QAScoreDisplay: React.FC<QAScoreDisplayProps> = ({
  score,
  maxScore = 100,
  label = 'Quality Score',
  showTrend = false,
  trend,
  showGrading = true,
  className,
  size = 'md',
  variant = 'default'
}) => {
  const percentage = (score / maxScore) * 100
  const grade = getScoreGrade(score, maxScore)
  const icon = getScoreIcon(score, maxScore)

  const sizeClasses = {
    sm: { text: 'text-2xl', card: 'p-4' },
    md: { text: 'text-4xl', card: 'p-6' },
    lg: { text: 'text-6xl', card: 'p-8' }
  }

  if (variant === 'circular') {
    return (
      <div className={cn("flex flex-col items-center space-y-2", className)}>
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
            {/* Background circle */}
            <path
              className="text-muted stroke-current"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            {/* Progress circle */}
            <path
              className={cn(
                "stroke-current",
                percentage >= 90 ? "text-green-500" :
                percentage >= 70 ? "text-yellow-500" : "text-red-500"
              )}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${percentage}, 100`}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold">{Math.round(percentage)}%</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">
            {score} / {maxScore}
          </div>
          {showGrading && (
            <Badge className={cn("mt-1", grade.bgColor, grade.color)}>
              {grade.grade}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {icon}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{Math.round(percentage)}%</span>
            {showGrading && (
              <Badge variant="outline" className={cn(grade.color)}>
                {grade.grade}
              </Badge>
            )}
            {showTrend && trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : 
                 trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                {trend !== 0 && `${trend > 0 ? '+' : ''}${trend}%`}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className="flex items-center gap-2">
          {showGrading && (
            <Badge className={cn(grade.bgColor, grade.color)}>
              {grade.grade}
            </Badge>
          )}
          {icon}
        </div>
      </CardHeader>
      
      <CardContent className={sizeClasses[size].card}>
        <div className="space-y-4">
          <div className="flex items-baseline gap-2">
            <div className={cn("font-bold", sizeClasses[size].text)}>
              {Math.round(percentage)}%
            </div>
            <div className="text-sm text-muted-foreground">
              ({score} / {maxScore})
            </div>
          </div>
          
          <Progress 
            value={percentage} 
            className="h-3"
            style={{
              background: `var(--muted)`
            }}
          />
          
          {showTrend && trend !== undefined && (
            <div className={cn(
              "flex items-center gap-2 text-sm",
              trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              {trend > 0 ? <TrendingUp className="h-4 w-4" /> : 
               trend < 0 ? <TrendingDown className="h-4 w-4" /> : null}
              <span>
                {trend === 0 ? 'No change' : 
                 `${trend > 0 ? '+' : ''}${trend}% from last session`}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// MQM Score component specifically for Multidimensional Quality Metrics
export const MQMScoreDisplay: React.FC<{
  accuracy: number
  fluency: number
  style: number
  terminology: number
  locale?: number
  overall?: number
  className?: string
}> = ({ 
  accuracy, 
  fluency, 
  style, 
  terminology, 
  locale,
  overall,
  className 
}) => {
  const scores = [
    { label: 'Accuracy', value: accuracy, icon: <Target className="h-4 w-4" /> },
    { label: 'Fluency', value: fluency, icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Style', value: style, icon: <Award className="h-4 w-4" /> },
    { label: 'Terminology', value: terminology, icon: <CheckCircle className="h-4 w-4" /> },
  ]

  if (locale !== undefined) {
    scores.push({ label: 'Locale', value: locale, icon: <Target className="h-4 w-4" /> })
  }

  const calculatedOverall = overall || scores.reduce((sum, score) => sum + score.value, 0) / scores.length

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">MQM Quality Assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-3xl font-bold mb-2">
            {Math.round(calculatedOverall)}%
          </div>
          <div className="text-sm text-muted-foreground">Overall Quality Score</div>
          <Badge className={cn(
            "mt-2",
            getScoreGrade(calculatedOverall).bgColor,
            getScoreGrade(calculatedOverall).color
          )}>
            {getScoreGrade(calculatedOverall).grade}
          </Badge>
        </div>

        {/* Individual Scores */}
        <div className="space-y-4">
          {scores.map((score, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {score.icon}
                  <span className="text-sm font-medium">{score.label}</span>
                </div>
                <span className="text-sm font-semibold">{Math.round(score.value)}%</span>
              </div>
              <Progress 
                value={score.value} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Score comparison component
export const ScoreComparison: React.FC<{
  current: number
  previous: number
  target?: number
  label?: string
  className?: string
}> = ({ current, previous, target, label = 'Score', className }) => {
  const improvement = current - previous
  const targetDiff = target ? current - target : null

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{Math.round(current)}%</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          
          <div className="text-right space-y-1">
            <div className={cn(
              "flex items-center gap-1 text-sm",
              improvement > 0 ? "text-green-600" : 
              improvement < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              {improvement > 0 ? <TrendingUp className="h-3 w-3" /> :
               improvement < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              <span>{improvement > 0 ? '+' : ''}{Math.round(improvement)}%</span>
            </div>
            
            {target && targetDiff !== null && (
              <div className="text-xs text-muted-foreground">
                {targetDiff >= 0 ? 'Target met' : `${Math.abs(Math.round(targetDiff))}% to target`}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default QAScoreDisplay 