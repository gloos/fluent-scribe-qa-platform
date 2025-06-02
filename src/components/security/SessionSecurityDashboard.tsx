import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Lock, 
  Unlock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Eye,
  Settings
} from 'lucide-react'
import { useEnhancedSession } from '@/hooks/useEnhancedSession'
import { formatDistanceToNow } from 'date-fns'

export const SessionSecurityDashboard: React.FC = () => {
  const {
    sessionInfo,
    validationResult,
    isValidating,
    complexityAnalysis,
    patternAnalysis,
    isAnalyzing,
    validateSession,
    analyzeComplexity,
    analyzePatterns,
    secureLogout,
    markReauthRequired,
    markReauthCompleted,
    getSecurityAnalysis,
    cleanupSessions
  } = useEnhancedSession()

  const [showDetails, setShowDetails] = useState(false)
  const [globalAnalysis, setGlobalAnalysis] = useState<any>(null)

  // Load global security analysis
  useEffect(() => {
    const analysis = getSecurityAnalysis()
    setGlobalAnalysis(analysis)
  }, [getSecurityAnalysis])

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'default'
      case 'medium': return 'secondary'
      case 'high': return 'destructive'
      case 'critical': return 'destructive'
      default: return 'default'
    }
  }

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return <CheckCircle className="h-4 w-4" />
      case 'medium': return <Eye className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <AlertTriangle className="h-4 w-4" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  const getSecurityScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Session Security Dashboard</h2>
          <p className="text-gray-600">Monitor and manage your session security</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={validateSession}
            disabled={isValidating}
          >
            {isValidating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Validate Session
          </Button>
          <Button 
            variant="outline" 
            onClick={analyzeComplexity}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            Analyze Security
          </Button>
        </div>
      </div>

      {/* Session Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current Session Status
          </CardTitle>
          <CardDescription>
            Real-time security status of your current session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionInfo ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Security Score</p>
                  <p className={`text-2xl font-bold ${getSecurityScoreColor(sessionInfo.securityScore || 0)}`}>
                    {sessionInfo.securityScore || 0}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Risk Level</p>
                  <Badge variant={getRiskBadgeVariant(sessionInfo.riskLevel || 'low')}>
                    {getRiskIcon(sessionInfo.riskLevel || 'low')}
                    <span className="ml-1 capitalize">{sessionInfo.riskLevel || 'Unknown'}</span>
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Session Age</p>
                  <p className="text-sm">
                    {sessionInfo.timeUntilExpiry 
                      ? `${Math.floor(sessionInfo.timeUntilExpiry / 60)}m remaining`
                      : 'N/A'
                    }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Last Activity</p>
                  <p className="text-sm">
                    {sessionInfo.lastActivity 
                      ? formatDistanceToNow(sessionInfo.lastActivity, { addSuffix: true })
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>

              {sessionInfo.securityScore && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Security Score</span>
                    <span>{sessionInfo.securityScore}%</span>
                  </div>
                  <Progress value={sessionInfo.securityScore} className="h-2" />
                </div>
              )}

              {showDetails && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                  <p><strong>Session ID:</strong> {sessionInfo.sessionId}</p>
                  <p><strong>Device Fingerprint:</strong> {sessionInfo.deviceFingerprint}</p>
                  <p><strong>IP Address:</strong> {sessionInfo.ipAddress}</p>
                  <p><strong>User Agent:</strong> {sessionInfo.userAgent?.substring(0, 50)}...</p>
                  <p><strong>Concurrent Sessions:</strong> {sessionInfo.concurrentSessions}</p>
                </div>
              )}

              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No session information available. Please validate your session.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              Session Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={validationResult.valid ? 'default' : 'destructive'}>
                {validationResult.valid ? 'Valid' : 'Invalid'}
              </Badge>
              <Badge variant={getRiskBadgeVariant(validationResult.riskLevel)}>
                Risk: {validationResult.riskLevel}
              </Badge>
            </div>

            {validationResult.violations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Security Violations:</h4>
                <ul className="space-y-1">
                  {validationResult.violations.map((violation, index) => (
                    <li key={index} className="text-sm text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" />
                      {violation.replace(/_/g, ' ').toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.actions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Recommended Actions:</h4>
                <ul className="space-y-1">
                  {validationResult.actions.map((action, index) => (
                    <li key={index} className="text-sm text-blue-600">
                      • {action.replace(/_/g, ' ').toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complexity Analysis */}
      {complexityAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Security Complexity Analysis
            </CardTitle>
            <CardDescription>
              Analysis of security interdependencies and potential vulnerabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{complexityAnalysis.complexityScore}</p>
                <p className="text-sm text-gray-600">Complexity Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{complexityAnalysis.vulnerabilities.length}</p>
                <p className="text-sm text-gray-600">Vulnerabilities</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{complexityAnalysis.criticalPaths.length}</p>
                <p className="text-sm text-gray-600">Critical Paths</p>
              </div>
            </div>

            {complexityAnalysis.vulnerabilities.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Detected Vulnerabilities:</h4>
                {complexityAnalysis.vulnerabilities.map((vuln, index) => (
                  <Alert key={index} variant={vuln.severity === 'critical' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{vuln.type.replace(/_/g, ' ')}</strong> ({vuln.severity}): {vuln.description}
                      <br />
                      <em>Recommendation: {vuln.recommendation}</em>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {complexityAnalysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Security Recommendations:</h4>
                <ul className="space-y-1">
                  {complexityAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-green-600">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Global Analysis */}
      {globalAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Global Session Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{globalAnalysis.totalSessions}</p>
                <p className="text-sm text-gray-600">Total Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{Math.round(globalAnalysis.averageSecurityScore)}</p>
                <p className="text-sm text-gray-600">Avg Security Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{globalAnalysis.riskDistribution.high + globalAnalysis.riskDistribution.critical}</p>
                <p className="text-sm text-gray-600">High Risk Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{globalAnalysis.riskDistribution.low}</p>
                <p className="text-sm text-gray-600">Low Risk Sessions</p>
              </div>
            </div>

            {globalAnalysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">System Recommendations:</h4>
                <ul className="space-y-1">
                  {globalAnalysis.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-blue-600">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Security Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={markReauthRequired}>
              <Lock className="h-4 w-4 mr-2" />
              Force Re-auth
            </Button>
            <Button variant="outline" onClick={markReauthCompleted}>
              <Unlock className="h-4 w-4 mr-2" />
              Mark Re-auth Complete
            </Button>
            <Button variant="outline" onClick={cleanupSessions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Cleanup Sessions
            </Button>
            <Button variant="outline" onClick={analyzePatterns}>
              <Activity className="h-4 w-4 mr-2" />
              Analyze Patterns
            </Button>
            <Button variant="destructive" onClick={() => secureLogout('ADMIN_LOGOUT')}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Force Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 