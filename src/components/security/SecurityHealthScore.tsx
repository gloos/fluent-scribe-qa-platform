import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SecurityStats } from '@/lib/security/types';

interface SecurityHealthScoreProps {
  stats: SecurityStats;
}

interface HealthScoreCalculation {
  score: number;
  successRate: number;
  suspiciousActivityRate: number;
}

export const SecurityHealthScore: React.FC<SecurityHealthScoreProps> = ({ stats }) => {
  const calculateHealthScore = (): HealthScoreCalculation => {
    const totalActivity = stats.successfulLogins + stats.failedLogins;
    const successRate = totalActivity > 0 ? (stats.successfulLogins / totalActivity) * 100 : 100;
    const suspiciousActivityRate = totalActivity > 0 ? ((stats.suspiciousActivity + stats.accountLockouts) / totalActivity) * 100 : 0;
    
    // Calculate health score (0-100)
    const score = Math.max(0, Math.min(100, 
      successRate - (suspiciousActivityRate * 2) - (stats.failedLogins > stats.successfulLogins ? 20 : 0)
    ));
    
    return { score, successRate, suspiciousActivityRate };
  };

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const { score: healthScore, successRate } = calculateHealthScore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Security Health Score
        </CardTitle>
        <CardDescription>
          Overall security posture based on recent authentication activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Health Score Display */}
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Overall Score</span>
            <span className={cn("text-2xl font-bold", getHealthColor(healthScore))}>
              {Math.round(healthScore)}/100
            </span>
          </div>
          
          {/* Progress Bar */}
          <Progress 
            value={healthScore} 
            className="h-3"
          />
          
          {/* Health Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Status: </span>
              <span className={getHealthColor(healthScore)}>
                {getHealthLabel(healthScore)}
              </span>
            </div>
            <div>
              <span className="font-medium">Success Rate: </span>
              <span className={successRate >= 80 ? 'text-green-600' : successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                {Math.round(successRate)}%
              </span>
            </div>
          </div>
          
          {/* Security Alert */}
          {healthScore < 60 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Alert:</strong> Your security score is below optimal. 
                Consider reviewing recent login attempts and enabling additional security measures.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 