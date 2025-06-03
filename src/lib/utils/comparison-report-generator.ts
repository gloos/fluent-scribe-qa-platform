import { ReportGenerator } from './report-generator';
import type { 
  ComprehensiveComparisonResult,
  ModelDifference,
  SensitivityAnalysisResult,
  ScenarioComparisonResult
} from './model-comparison-engine';
import type { CustomScoringModel } from '../types/scoring-models';

/**
 * Comparison Report Generator
 * 
 * Creates comprehensive comparison reports for scoring model analysis
 * with visualizations and actionable insights. Uses composition to leverage
 * the existing ReportGenerator capabilities.
 */

export interface ComparisonReportConfig {
  title: string;
  includeExecutiveSummary: boolean;
  includeDetailedAnalysis: boolean;
  includeSensitivityCharts: boolean;
  includeScenarioBreakdowns: boolean;
  includeRecommendations: boolean;
  format: 'html' | 'pdf' | 'json' | 'csv';
  customBranding?: {
    companyName: string;
    logoUrl?: string;
    colorScheme?: string;
  };
}

export interface ComparisonReportData {
  config: ComparisonReportConfig;
  comparisonResult: ComprehensiveComparisonResult;
  generatedAt: string;
  reportId: string;
  version: string;
}

export interface ComparisonExecutiveSummary {
  keyFindings: {
    mostSimilarModels: string;
    mostDifferentModels: string;
    recommendedModel: string;
    criticalRiskFactors: number;
    highSensitivityParameters: number;
  };
  performanceHighlights: {
    bestPerformingModel: string;
    consistencyLeader: string;
    mostStableModel: string;
    riskiestConfiguration: string;
  };
  actionableInsights: string[];
  implementationRecommendations: string[];
}

export interface ComparisonVisualizationData {
  modelSpecificationsChart: {
    models: string[];
    maxScores: number[];
    thresholds: number[];
    dimensionCounts: number[];
    errorTypeCounts: number[];
  };
  differenceSignificanceChart: {
    categories: string[];
    highImpact: number[];
    mediumImpact: number[];
    lowImpact: number[];
  };
  sensitivityHeatmap: {
    parameters: string[];
    models: string[];
    sensitivityMatrix: number[][]; // 2D array for heatmap
  };
  scenarioPerformanceChart: {
    scenarios: string[];
    modelPerformance: {
      [modelName: string]: number[];
    };
  };
}

export class ComparisonReportGenerator {
  private static instance: ComparisonReportGenerator;
  private baseReportGenerator: ReportGenerator;

  private constructor() {
    this.baseReportGenerator = ReportGenerator.getInstance();
  }

  public static getInstance(): ComparisonReportGenerator {
    if (!ComparisonReportGenerator.instance) {
      ComparisonReportGenerator.instance = new ComparisonReportGenerator();
    }
    return ComparisonReportGenerator.instance;
  }

  /**
   * Generate a comprehensive comparison report
   */
  public generateComparisonReport(
    comparisonResult: ComprehensiveComparisonResult,
    config: ComparisonReportConfig
  ): ComparisonReportData {
    const reportId = `comparison-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    const report: ComparisonReportData = {
      config,
      comparisonResult,
      generatedAt,
      reportId,
      version: '1.0.0'
    };

    return report;
  }

  /**
   * Create executive summary for comparison report
   */
  public createExecutiveSummary(
    comparisonResult: ComprehensiveComparisonResult
  ): ComparisonExecutiveSummary {
    const { differences, sensitivityAnalysis, scenarioResults, overallAnalysis } = comparisonResult;

    // Count high-risk factors
    const criticalRiskFactors = overallAnalysis.riskFactors.length;
    const highSensitivityParameters = sensitivityAnalysis.filter(s => s.sensitivity === 'high').length;

    // Identify performance leaders
    const bestPerformingModel = this.identifyBestPerformingModel(scenarioResults);
    const consistencyLeader = this.identifyConsistencyLeader(scenarioResults);
    const mostStableModel = this.identifyMostStableModel(sensitivityAnalysis);
    const riskiestConfiguration = this.identifyRiskiestConfiguration(differences, sensitivityAnalysis);

    // Generate actionable insights
    const actionableInsights = this.generateActionableInsights(comparisonResult);
    const implementationRecommendations = this.generateImplementationRecommendations(comparisonResult);

    return {
      keyFindings: {
        mostSimilarModels: overallAnalysis.mostSimilarPair.join(' vs '),
        mostDifferentModels: overallAnalysis.mostDifferentPair.join(' vs '),
        recommendedModel: overallAnalysis.recommendedModel,
        criticalRiskFactors,
        highSensitivityParameters
      },
      performanceHighlights: {
        bestPerformingModel,
        consistencyLeader,
        mostStableModel,
        riskiestConfiguration
      },
      actionableInsights,
      implementationRecommendations
    };
  }

  /**
   * Create visualization data for charts and graphs
   */
  public createVisualizationData(
    comparisonResult: ComprehensiveComparisonResult
  ): ComparisonVisualizationData {
    const { models, differences, sensitivityAnalysis, scenarioResults } = comparisonResult;

    // Model specifications chart
    const modelSpecificationsChart = {
      models: models.map(m => m.name),
      maxScores: models.map(m => m.maxScore),
      thresholds: models.map(m => m.passingThreshold),
      dimensionCounts: models.map(m => m.config.dimensions.length),
      errorTypeCounts: models.map(m => m.config.errorTypes.length)
    };

    // Difference significance chart
    const diffCategories = ['weight', 'formula', 'threshold', 'configuration'];
    const differenceSignificanceChart = {
      categories: diffCategories,
      highImpact: diffCategories.map(cat => 
        differences.filter(d => d.fieldType === cat && d.significance === 'high').length
      ),
      mediumImpact: diffCategories.map(cat => 
        differences.filter(d => d.fieldType === cat && d.significance === 'medium').length
      ),
      lowImpact: diffCategories.map(cat => 
        differences.filter(d => d.fieldType === cat && d.significance === 'low').length
      )
    };

    // Sensitivity heatmap
    const uniqueParameters = [...new Set(sensitivityAnalysis.map(s => s.parameter))];
    const uniqueModels = [...new Set(sensitivityAnalysis.map(s => s.parameter.split(' - ')[0]))];
    const sensitivityMatrix = this.createSensitivityMatrix(sensitivityAnalysis, uniqueParameters, uniqueModels);

    const sensitivityHeatmap = {
      parameters: uniqueParameters,
      models: uniqueModels,
      sensitivityMatrix
    };

    // Scenario performance chart
    const scenarioPerformanceChart = {
      scenarios: scenarioResults.map(r => r.scenario.name),
      modelPerformance: this.createScenarioPerformanceData(scenarioResults)
    };

    return {
      modelSpecificationsChart,
      differenceSignificanceChart,
      sensitivityHeatmap,
      scenarioPerformanceChart
    };
  }

  /**
   * Export report to various formats
   */
  public async exportReport(
    reportData: ComparisonReportData,
    format: 'html' | 'pdf' | 'json' | 'csv' = 'json'
  ): Promise<string | Buffer> {
    switch (format) {
      case 'json':
        return this.exportToJSON(reportData);
      case 'html':
        return this.exportToHTML(reportData);
      case 'pdf':
        return this.exportToPDF(reportData);
      case 'csv':
        return this.exportToCSV(reportData);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  private identifyBestPerformingModel(scenarioResults: ScenarioComparisonResult[]): string {
    if (scenarioResults.length === 0) return 'N/A';

    const modelScores = new Map<string, number[]>();
    
    scenarioResults.forEach(result => {
      result.modelResults.forEach(model => {
        if (!modelScores.has(model.modelName)) {
          modelScores.set(model.modelName, []);
        }
        modelScores.get(model.modelName)!.push(model.percentageScore);
      });
    });

    let bestModel = 'N/A';
    let highestAvgScore = 0;

    modelScores.forEach((scores, modelName) => {
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (avgScore > highestAvgScore) {
        highestAvgScore = avgScore;
        bestModel = modelName;
      }
    });

    return bestModel;
  }

  private identifyConsistencyLeader(scenarioResults: ScenarioComparisonResult[]): string {
    if (scenarioResults.length === 0) return 'N/A';

    const avgConsistency = scenarioResults.reduce((sum, r) => sum + r.analysis.consistencyScore, 0) / scenarioResults.length;
    
    // Find model with scores closest to average across scenarios
    const modelConsistency = new Map<string, number>();
    
    scenarioResults.forEach(result => {
      result.modelResults.forEach(model => {
        const deviation = Math.abs(model.percentageScore - result.analysis.avgScore);
        const current = modelConsistency.get(model.modelName) || 0;
        modelConsistency.set(model.modelName, current + deviation);
      });
    });

    let consistentModel = 'N/A';
    let lowestDeviation = Infinity;

    modelConsistency.forEach((totalDeviation, modelName) => {
      const avgDeviation = totalDeviation / scenarioResults.length;
      if (avgDeviation < lowestDeviation) {
        lowestDeviation = avgDeviation;
        consistentModel = modelName;
      }
    });

    return consistentModel;
  }

  private identifyMostStableModel(sensitivityAnalysis: SensitivityAnalysisResult[]): string {
    if (sensitivityAnalysis.length === 0) return 'N/A';

    const modelStability = new Map<string, number>();

    sensitivityAnalysis.forEach(analysis => {
      const modelName = analysis.parameter.split(' - ')[0];
      const stabilityScore = 100 - analysis.maxVariation; // Higher score = more stable
      
      const current = modelStability.get(modelName) || 0;
      const count = Array.from(modelStability.entries()).filter(([name]) => name === modelName).length + 1;
      modelStability.set(modelName, (current + stabilityScore) / count);
    });

    let stableModel = 'N/A';
    let highestStability = 0;

    modelStability.forEach((stability, modelName) => {
      if (stability > highestStability) {
        highestStability = stability;
        stableModel = modelName;
      }
    });

    return stableModel;
  }

  private identifyRiskiestConfiguration(
    differences: ModelDifference[], 
    sensitivityAnalysis: SensitivityAnalysisResult[]
  ): string {
    const highRiskDifferences = differences.filter(d => d.significance === 'high');
    const highSensitivityParams = sensitivityAnalysis.filter(s => s.sensitivity === 'high');

    if (highRiskDifferences.length > 0) {
      return highRiskDifferences[0].field;
    } else if (highSensitivityParams.length > 0) {
      return highSensitivityParams[0].parameter;
    }

    return 'No critical risks identified';
  }

  private generateActionableInsights(comparisonResult: ComprehensiveComparisonResult): string[] {
    const insights = [];
    const { differences, sensitivityAnalysis, scenarioResults, overallAnalysis } = comparisonResult;

    // Analyze differences
    const highImpactDiffs = differences.filter(d => d.significance === 'high');
    if (highImpactDiffs.length > 0) {
      insights.push(`${highImpactDiffs.length} high-impact differences found - review these configurations carefully`);
    }

    // Analyze sensitivity
    const highSensitivityCount = sensitivityAnalysis.filter(s => s.sensitivity === 'high').length;
    if (highSensitivityCount > 0) {
      insights.push(`${highSensitivityCount} parameters show high sensitivity - monitor these closely during implementation`);
    }

    // Analyze scenario consistency
    if (scenarioResults.length > 0) {
      const avgConsistency = scenarioResults.reduce((sum, r) => sum + r.analysis.consistencyScore, 0) / scenarioResults.length;
      if (avgConsistency < 70) {
        insights.push(`Low cross-scenario consistency (${avgConsistency.toFixed(1)}%) - consider context-specific model selection`);
      } else {
        insights.push(`High cross-scenario consistency (${avgConsistency.toFixed(1)}%) - models behave predictably`);
      }
    }

    // Risk factors
    if (overallAnalysis.riskFactors.length > 0) {
      insights.push(`${overallAnalysis.riskFactors.length} risk factors identified - implement gradual rollout strategy`);
    }

    return insights;
  }

  private generateImplementationRecommendations(comparisonResult: ComprehensiveComparisonResult): string[] {
    const recommendations = [];
    const { overallAnalysis, sensitivityAnalysis, scenarioResults } = comparisonResult;

    // Model selection recommendation
    recommendations.push(`Primary recommendation: Deploy ${overallAnalysis.recommendedModel} for optimal performance`);

    // Sensitivity-based recommendations
    const highSensitivityParams = sensitivityAnalysis.filter(s => s.sensitivity === 'high');
    if (highSensitivityParams.length > 0) {
      recommendations.push('Implement parameter validation and monitoring for sensitive configurations');
      recommendations.push('Consider A/B testing for high-sensitivity parameters before full deployment');
    }

    // Scenario-based recommendations
    if (scenarioResults.length > 0) {
      const challengingScenarios = scenarioResults.filter(r => r.analysis.avgScore < 70);
      if (challengingScenarios.length > 0) {
        recommendations.push(`Develop specialized handling for challenging scenarios: ${challengingScenarios.map(s => s.scenario.name).join(', ')}`);
      }
    }

    // Risk mitigation
    if (overallAnalysis.riskFactors.length > 0) {
      recommendations.push('Implement comprehensive monitoring and alerting for identified risk factors');
      recommendations.push('Plan for model fallback strategy in case of unexpected behavior');
    }

    return recommendations;
  }

  private createSensitivityMatrix(
    sensitivityAnalysis: SensitivityAnalysisResult[],
    parameters: string[],
    models: string[]
  ): number[][] {
    const matrix: number[][] = Array(models.length).fill(null).map(() => Array(parameters.length).fill(0));

    sensitivityAnalysis.forEach(analysis => {
      const modelName = analysis.parameter.split(' - ')[0];
      const modelIndex = models.indexOf(modelName);
      const paramIndex = parameters.indexOf(analysis.parameter);

      if (modelIndex !== -1 && paramIndex !== -1) {
        // Convert sensitivity to numeric value (high=3, medium=2, low=1)
        const sensitivityValue = analysis.sensitivity === 'high' ? 3 : analysis.sensitivity === 'medium' ? 2 : 1;
        matrix[modelIndex][paramIndex] = sensitivityValue;
      }
    });

    return matrix;
  }

  private createScenarioPerformanceData(scenarioResults: ScenarioComparisonResult[]): { [modelName: string]: number[] } {
    const performanceData: { [modelName: string]: number[] } = {};

    scenarioResults.forEach(result => {
      result.modelResults.forEach(model => {
        if (!performanceData[model.modelName]) {
          performanceData[model.modelName] = [];
        }
        performanceData[model.modelName].push(model.percentageScore);
      });
    });

    return performanceData;
  }

  private exportToJSON(reportData: ComparisonReportData): string {
    return JSON.stringify(reportData, null, 2);
  }

  private exportToHTML(reportData: ComparisonReportData): string {
    const { comparisonResult, config } = reportData;
    const executiveSummary = this.createExecutiveSummary(comparisonResult);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${config.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .model-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .model-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .high-risk { color: #dc3545; }
        .medium-risk { color: #ffc107; }
        .low-risk { color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${config.title}</h1>
        <p>Generated on ${new Date(reportData.generatedAt).toLocaleDateString()}</p>
        ${config.customBranding?.companyName ? `<p>Prepared for: ${config.customBranding.companyName}</p>` : ''}
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="model-grid">
            <div class="model-card">
                <h3>Key Findings</h3>
                <p><strong>Recommended Model:</strong> ${executiveSummary.keyFindings.recommendedModel}</p>
                <p><strong>Most Similar:</strong> ${executiveSummary.keyFindings.mostSimilarModels}</p>
                <p><strong>Most Different:</strong> ${executiveSummary.keyFindings.mostDifferentModels}</p>
                <p><strong>Risk Factors:</strong> ${executiveSummary.keyFindings.criticalRiskFactors}</p>
            </div>
            <div class="model-card">
                <h3>Performance Highlights</h3>
                <p><strong>Best Performing:</strong> ${executiveSummary.performanceHighlights.bestPerformingModel}</p>
                <p><strong>Most Consistent:</strong> ${executiveSummary.performanceHighlights.consistencyLeader}</p>
                <p><strong>Most Stable:</strong> ${executiveSummary.performanceHighlights.mostStableModel}</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Model Comparison</h2>
        <table>
            <thead>
                <tr>
                    <th>Model</th>
                    <th>Max Score</th>
                    <th>Threshold</th>
                    <th>Dimensions</th>
                    <th>Error Types</th>
                    <th>Framework</th>
                </tr>
            </thead>
            <tbody>
                ${comparisonResult.models.map(model => `
                    <tr>
                        <td><strong>${model.name}</strong></td>
                        <td>${model.maxScore}</td>
                        <td>${model.passingThreshold}%</td>
                        <td>${model.config.dimensions.length}</td>
                        <td>${model.config.errorTypes.length}</td>
                        <td>${model.framework}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Key Differences</h2>
        ${comparisonResult.differences.slice(0, 10).map(diff => `
            <div class="model-card">
                <h4 class="${diff.significance}-risk">${diff.field} (${diff.significance} impact)</h4>
                <p>${diff.impact}</p>
                <p><strong>Model A:</strong> ${diff.modelA} | <strong>Model B:</strong> ${diff.modelB}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${executiveSummary.implementationRecommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }

  private exportToPDF(reportData: ComparisonReportData): Buffer {
    // In a real implementation, you would use a library like puppeteer or jsPDF
    // For now, return a placeholder buffer
    const htmlContent = this.exportToHTML(reportData);
    return Buffer.from(htmlContent, 'utf-8');
  }

  private exportToCSV(reportData: ComparisonReportData): string {
    const { comparisonResult } = reportData;
    const lines = [];

    // Header
    lines.push('Category,Field,Model A,Model B,Difference,Significance,Impact');

    // Model differences
    comparisonResult.differences.forEach(diff => {
      lines.push([
        'Difference',
        `"${diff.field}"`,
        `"${diff.modelA}"`,
        `"${diff.modelB}"`,
        `"${diff.difference}"`,
        diff.significance,
        `"${diff.impact}"`
      ].join(','));
    });

    // Sensitivity analysis
    comparisonResult.sensitivityAnalysis.forEach(analysis => {
      lines.push([
        'Sensitivity',
        `"${analysis.parameter}"`,
        analysis.originalValue,
        analysis.maxVariation.toFixed(2),
        analysis.sensitivity,
        '',
        `"${analysis.recommendations.join('; ')}"`
      ].join(','));
    });

    return lines.join('\n');
  }
}

export default ComparisonReportGenerator; 