import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Target, 
  Layers, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle2,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';

import type { ScoringModelDimension, ScoringModelErrorType } from '@/lib/types/scoring-models';

interface ModelStructureVisualizationProps {
  dimensions: ScoringModelDimension[];
  errorTypes: ScoringModelErrorType[];
  maxScore: number;
  passingThreshold: number;
  scoringUnit: string;
  unitCount: number;
  className?: string;
}

export const ModelStructureVisualization: React.FC<ModelStructureVisualizationProps> = ({
  dimensions,
  errorTypes,
  maxScore,
  passingThreshold,
  scoringUnit,
  unitCount,
  className = ''
}) => {
  // Calculate totals and validation
  const totalDimensionWeight = dimensions.reduce((sum, dim) => sum + dim.weight, 0);
  const totalErrorWeight = errorTypes.reduce((sum, error) => sum + error.weight, 0);
  
  const isBalanced = totalDimensionWeight === 100 && totalErrorWeight === 100;
  const hasContent = dimensions.length > 0 || errorTypes.length > 0;
  
  // Severity distribution
  const severityDistribution = errorTypes.reduce((acc, error) => {
    acc[error.severity] = (acc[error.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'major': return 'bg-orange-500';
      case 'minor': return 'bg-yellow-500';
      case 'neutral': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-3 w-3" />;
      case 'major': return <AlertCircle className="h-3 w-3" />;
      case 'minor': return <Info className="h-3 w-3" />;
      case 'neutral': return <CheckCircle2 className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  if (!hasContent) {
    return (
      <Card className={`border-dashed ${className}`}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-gray-500">No model structure defined yet</p>
            <p className="text-sm text-gray-400">Add dimensions and error types to see the visualization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Model Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Model Overview
          </CardTitle>
          <CardDescription>
            Summary of your scoring model configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{maxScore}</div>
              <div className="text-sm text-gray-600">Max Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{passingThreshold}%</div>
              <div className="text-sm text-gray-600">Passing Threshold</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{unitCount}</div>
              <div className="text-sm text-gray-600">Per {unitCount} {scoringUnit}</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {isBalanced ? <CheckCircle2 className="h-8 w-8 mx-auto" /> : <AlertTriangle className="h-8 w-8 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600">
                {isBalanced ? 'Balanced' : 'Needs Balance'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Quality Dimensions ({dimensions.length})
            </CardTitle>
            <CardDescription>
              Weight distribution across quality dimensions
            </CardDescription>
            
            {/* Weight validation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Total Weight</span>
                <span className={
                  totalDimensionWeight === 100 ? 'text-green-600 font-medium' : 
                  totalDimensionWeight > 100 ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'
                }>
                  {totalDimensionWeight}%
                </span>
              </div>
              <Progress 
                value={Math.min(totalDimensionWeight, 100)} 
                className={`h-2 ${totalDimensionWeight > 100 ? 'bg-red-100' : ''}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            {dimensions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No dimensions defined</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dimensions.map((dimension) => (
                  <div key={dimension.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{dimension.name || 'Unnamed Dimension'}</h4>
                      <Badge variant="outline">{dimension.weight}%</Badge>
                    </div>
                    
                    {dimension.description && (
                      <p className="text-sm text-gray-600 mb-2">{dimension.description}</p>
                    )}
                    
                    {dimension.subcriteria.length > 0 && (
                      <div className="space-y-1 pl-4 border-l-2 border-gray-200">
                        <p className="text-xs font-medium text-gray-500">Subcriteria ({dimension.subcriteria.length})</p>
                        {dimension.subcriteria.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between text-sm">
                            <span>{sub.name || 'Unnamed'}</span>
                            <Badge variant="secondary" className="text-xs">{sub.weight}%</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Weight visualization */}
                    <div className="mt-2">
                      <Progress value={dimension.weight} className="h-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Types ({errorTypes.length})
            </CardTitle>
            <CardDescription>
              Error severity levels and penalty weights
            </CardDescription>
            
            {/* Weight validation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Total Weight</span>
                <span className={
                  totalErrorWeight === 100 ? 'text-green-600 font-medium' : 
                  totalErrorWeight > 100 ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'
                }>
                  {totalErrorWeight}%
                </span>
              </div>
              <Progress 
                value={Math.min(totalErrorWeight, 100)} 
                className={`h-2 ${totalErrorWeight > 100 ? 'bg-red-100' : ''}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            {errorTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No error types defined</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorTypes.map((errorType) => (
                  <div key={errorType.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${getSeverityColor(errorType.severity)} text-white`}>
                          {getSeverityIcon(errorType.severity)}
                        </div>
                        <h4 className="font-medium">{errorType.type || 'Unnamed Error Type'}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {errorType.severity}
                        </Badge>
                        <Badge variant="outline">{errorType.weight}%</Badge>
                      </div>
                    </div>
                    
                    {errorType.description && (
                      <p className="text-sm text-gray-600 mb-2">{errorType.description}</p>
                    )}
                    
                    {/* Weight visualization */}
                    <div className="mt-2">
                      <Progress value={errorType.weight} className="h-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution */}
      {errorTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Severity Distribution
            </CardTitle>
            <CardDescription>
              Overview of error severity levels in your model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(severityDistribution).map(([severity, count]) => (
                <div key={severity} className="text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getSeverityColor(severity)} text-white mb-2`}>
                    {getSeverityIcon(severity)}
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-gray-600 capitalize">{severity}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model Health Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Model Health Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className={`flex items-center gap-2 ${totalDimensionWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
              {totalDimensionWeight === 100 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span className="text-sm">
                Dimension weights {totalDimensionWeight === 100 ? 'are balanced' : `total ${totalDimensionWeight}% (should be 100%)`}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 ${totalErrorWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
              {totalErrorWeight === 100 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span className="text-sm">
                Error type weights {totalErrorWeight === 100 ? 'are balanced' : `total ${totalErrorWeight}% (should be 100%)`}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 ${dimensions.length > 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {dimensions.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              <span className="text-sm">
                {dimensions.length > 0 ? `${dimensions.length} quality dimension(s) defined` : 'No quality dimensions defined'}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 ${errorTypes.length > 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {errorTypes.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              <span className="text-sm">
                {errorTypes.length > 0 ? `${errorTypes.length} error type(s) defined` : 'No error types defined'}
              </span>
            </div>

            <Separator />
            
            <div className="text-center">
              <Badge variant={isBalanced && hasContent ? 'default' : 'secondary'} className="px-4 py-2">
                {isBalanced && hasContent ? 'Ready for Use' : 'Configuration Incomplete'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModelStructureVisualization; 