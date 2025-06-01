import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CircularProgress } from '@/components/feedback/Progress'
import { 
  Clock, 
  FileText, 
  TrendingUp, 
  Activity, 
  CheckCircle, 
  AlertTriangle,
  Pause,
  Play,
  BarChart3,
  Download
} from 'lucide-react'
import { 
  useProgress,
  useBatchProgress,
  useRealTimeProgress,
  useProgressAnalytics,
  batchAPI
} from '@/lib/batch'

interface BatchProgressDashboardProps {
  className?: string
  refreshInterval?: number
}

export const BatchProgressDashboard: React.FC<BatchProgressDashboardProps> = ({
  className,
  refreshInterval = 1000
}) => {
  const [isTracking, setIsTracking] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  // Real-time progress data
  const realtimeData = useRealTimeProgress({ 
    updateInterval: refreshInterval,
    maxUpdatesPerSecond: 10 
  })

  // Overall progress data
  const { 
    jobs: jobProgress,
    batches: batchProgresses,
    insights,
    isLoading: progressLoading 
  } = useProgress({ refreshInterval })

  // Batch-specific progress
  const { 
    progress: batchProgress,
    timeline: batchTimeline
  } = useBatchProgress(selectedBatch || '')

  // Analytics data
  const { 
    report: analytics,
    isLoading: analyticsLoading 
  } = useProgressAnalytics()

  // Get active batches
  const [activeBatches, setActiveBatches] = useState<any[]>([])

  useEffect(() => {
    const updateBatches = () => {
      const batches = batchAPI.getBatches()
      setActiveBatches(batches)
      
      // Auto-select first active batch if none selected
      if (!selectedBatch && batches.length > 0) {
        setSelectedBatch(batches[0].id)
      }
    }

    updateBatches()
    const interval = setInterval(updateBatches, refreshInterval)
    return () => clearInterval(interval)
  }, [selectedBatch, refreshInterval])

  const handleStartTracking = () => {
    batchAPI.startProgressTracking()
    setIsTracking(true)
  }

  const handleStopTracking = () => {
    batchAPI.stopProgressTracking()
    setIsTracking(false)
  }

  const handleExportData = () => {
    const data = batchAPI.exportProgressData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `progress-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-yellow-500'
    }
  }

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'processing': return <Activity className="h-4 w-4 text-blue-600" />
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  // Calculate overview stats
  const activeJobsCount = realtimeData.activeJobs.length
  const completedJobsCount = jobProgress.filter(job => 
    job.progress.percentage === 100
  ).length

  return (
    <div className={className}>
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Batch Progress Dashboard</h2>
          <p className="text-muted-foreground">Real-time monitoring of batch file processing</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button
            variant={isTracking ? "secondary" : "default"}
            size="sm"
            onClick={isTracking ? handleStopTracking : handleStartTracking}
          >
            {isTracking ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Tracking
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Overall Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Active Jobs</p>
                <p className="text-2xl font-bold">
                  {activeJobsCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold">
                  {completedJobsCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Throughput</p>
                <p className="text-2xl font-bold">
                  {analytics?.summary?.overallThroughput?.toFixed(1) || '0'} 
                  <span className="text-sm text-muted-foreground ml-1">jobs/min</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {analytics?.summary?.averageProcessingTime ? 
                    formatDuration(analytics.summary.averageProcessingTime) : 
                    '0s'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Batches */}
        <Card>
          <CardHeader>
            <CardTitle>Active Batches</CardTitle>
            <CardDescription>Current batch processing operations</CardDescription>
          </CardHeader>
          <CardContent>
            {activeBatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active batches</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBatch === batch.id 
                        ? 'border-blue-200 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedBatch(batch.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{batch.name}</h4>
                      <Badge variant="outline">
                        {batch.jobs?.length || 0} jobs
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>{formatDuration(Date.now() - batch.createdAt)}</span>
                      <span>•</span>
                      <span>{Math.round((batch.progress?.percentage || 0))}% complete</span>
                    </div>
                    <Progress 
                      value={batch.progress?.percentage || 0} 
                      className="h-2 mt-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Batch Details */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
            <CardDescription>
              {selectedBatch ? `Jobs in batch: ${selectedBatch}` : 'Select a batch to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedBatch && batchProgress ? (
              <div className="space-y-4">
                {/* Batch Progress */}
                <div className="flex items-center space-x-4">
                  <CircularProgress
                    value={batchProgress.progress?.percentage || 0}
                    size={80}
                    showValue={true}
                    variant={batchProgress.progress?.percentage === 100 ? 'success' : 'default'}
                  />
                  <div>
                    <p className="font-medium">{batchProgress.progress?.stage || 'Processing'}</p>
                    <p className="text-sm text-muted-foreground">
                      {batchProgress.progress?.message || 'Batch processing in progress...'}
                    </p>
                    {batchProgress.progress?.estimatedTimeRemaining && (
                      <p className="text-xs text-muted-foreground">
                        ETA: {formatDuration(batchProgress.progress.estimatedTimeRemaining)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Job List */}
                {realtimeData.activeJobs && realtimeData.activeJobs.length > 0 && (
                  <div>
                    <h5 className="font-medium mb-2">Jobs ({realtimeData.activeJobs.length})</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {realtimeData.activeJobs.map((job) => (
                        <div key={job.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                          {getJobStatusIcon(job.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.progress?.stage || job.status} • {Math.round(job.progress?.percentage || 0)}%
                            </p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${getJobStatusColor(job.status)}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Select a batch to view details</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Analytics */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>Historical performance trends and insights</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>Loading analytics...</p>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round((1 - (analytics.summary?.errorRate || 0)) * 100)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {analytics.summary?.totalJobs || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {analytics.summary?.averageProcessingTime ? 
                      formatDuration(analytics.summary.averageProcessingTime) : 
                      '0s'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No analytics data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default BatchProgressDashboard 