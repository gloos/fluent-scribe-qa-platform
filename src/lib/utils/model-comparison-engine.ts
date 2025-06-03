import type { 
  CustomScoringModel, 
  ScoringModelResult, 
  ScoringModelComparison,
  FormulaContext,
  ScoringModelDimension,
  ScoringModelErrorType
} from '../types/scoring-models';
import { ErrorSeverity } from '../types/assessment';
import { FormulaParser } from './formula-parser';

/**
 * Model Comparison Engine
 * 
 * Provides comprehensive comparison capabilities for custom scoring models,
 * including side-by-side analysis, sensitivity testing, and scenario evaluation.
 */

export interface ModelComparisonOptions {
  includeWeightAnalysis: boolean;
  includeFormulaAnalysis: boolean;
  includeSensitivityAnalysis: boolean;
  sensitivityRange: number; // Percentage range for sensitivity testing (e.g., 10 = ±10%)
  testScenarios: TestScenario[];
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  errorPattern: ScenarioErrorPattern[];
  unitCount: number;
  expectedOutcomes?: string[];
}

export interface ScenarioErrorPattern {
  errorType: string;
  dimension?: string;
  severity: ErrorSeverity;
  count: number;
  percentage?: number; // Percentage of total units
}

export interface ModelDifference {
  field: string;
  fieldType: 'weight' | 'formula' | 'threshold' | 'configuration';
  modelA: any;
  modelB: any;
  difference: number | string;
  significance: 'high' | 'medium' | 'low';
  impact: string;
}

export interface SensitivityAnalysisResult {
  parameter: string;
  parameterType: 'weight' | 'threshold' | 'formula_variable';
  originalValue: number;
  testValues: number[];
  resultVariation: {
    value: number;
    scoreChange: number;
    percentageChange: number;
  }[];
  maxVariation: number;
  minVariation: number;
  sensitivity: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface ScenarioComparisonResult {
  scenario: TestScenario;
  modelResults: {
    modelId: string;
    modelName: string;
    score: number;
    percentageScore: number;
    qualityLevel: string;
    breakdown: {
      dimensionScores: Record<string, number>;
      errorPenalties: Record<string, number>;
      totalPenalty: number;
    };
  }[];
  analysis: {
    scoreSpread: number;
    avgScore: number;
    bestPerforming: string;
    worstPerforming: string;
    consistencyScore: number; // 0-100, how consistent models are
    recommendations: string[];
  };
}

export interface ComprehensiveComparisonResult {
  models: CustomScoringModel[];
  differences: ModelDifference[];
  sensitivityAnalysis: SensitivityAnalysisResult[];
  scenarioResults: ScenarioComparisonResult[];
  overallAnalysis: {
    mostSimilarPair: [string, string];
    mostDifferentPair: [string, string];
    recommendedModel: string;
    riskFactors: string[];
    usageRecommendations: string[];
  };
  generatedAt: string;
}

export class ModelComparisonEngine {
  private static instance: ModelComparisonEngine;
  private formulaParser: FormulaParser;

  private constructor() {
    this.formulaParser = new FormulaParser();
  }

  public static getInstance(): ModelComparisonEngine {
    if (!ModelComparisonEngine.instance) {
      ModelComparisonEngine.instance = new ModelComparisonEngine();
    }
    return ModelComparisonEngine.instance;
  }

  /**
   * Compare multiple scoring models comprehensively
   */
  public async compareModels(
    models: CustomScoringModel[],
    options: ModelComparisonOptions
  ): Promise<ComprehensiveComparisonResult> {
    if (models.length < 2) {
      throw new Error('At least 2 models are required for comparison');
    }

    // Perform different types of analysis
    const differences = this.calculateModelDifferences(models);
    const sensitivityAnalysis = options.includeSensitivityAnalysis 
      ? await this.performSensitivityAnalysis(models, options.sensitivityRange)
      : [];
    const scenarioResults = options.testScenarios.length > 0
      ? await this.evaluateScenarios(models, options.testScenarios)
      : [];

    // Generate overall analysis
    const overallAnalysis = this.generateOverallAnalysis(models, differences, sensitivityAnalysis, scenarioResults);

    return {
      models,
      differences,
      sensitivityAnalysis,
      scenarioResults,
      overallAnalysis,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate key differences between models
   */
  private calculateModelDifferences(models: CustomScoringModel[]): ModelDifference[] {
    const differences: ModelDifference[] = [];

    // Compare each pair of models
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const modelA = models[i];
        const modelB = models[j];

        // Compare thresholds
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Max Score`,
          fieldType: 'threshold',
          modelA: modelA.maxScore,
          modelB: modelB.maxScore,
          difference: Math.abs(modelA.maxScore - modelB.maxScore),
          significance: this.assessDifferenceSignificance(
            Math.abs(modelA.maxScore - modelB.maxScore) / Math.max(modelA.maxScore, modelB.maxScore)
          ),
          impact: 'Affects overall scoring scale and comparison baselines'
        });

        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Passing Threshold`,
          fieldType: 'threshold',
          modelA: modelA.passingThreshold,
          modelB: modelB.passingThreshold,
          difference: Math.abs(modelA.passingThreshold - modelB.passingThreshold),
          significance: this.assessDifferenceSignificance(
            Math.abs(modelA.passingThreshold - modelB.passingThreshold) / 100
          ),
          impact: 'Determines pass/fail decisions and quality classifications'
        });

        // Compare dimension weights
        this.compareDimensionWeights(modelA, modelB, differences);

        // Compare error type weights
        this.compareErrorTypeWeights(modelA, modelB, differences);

        // Compare formulas
        this.compareFormulas(modelA, modelB, differences);
      }
    }

    return differences.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.significance] - severityOrder[a.significance];
    });
  }

  /**
   * Compare dimension weights between two models
   */
  private compareDimensionWeights(
    modelA: CustomScoringModel, 
    modelB: CustomScoringModel, 
    differences: ModelDifference[]
  ): void {
    const dimensionsA = new Map(modelA.config.dimensions.map(d => [d.name, d.weight]));
    const dimensionsB = new Map(modelB.config.dimensions.map(d => [d.name, d.weight]));

    // Check dimensions in model A
    dimensionsA.forEach((weightA, dimensionName) => {
      const weightB = dimensionsB.get(dimensionName);
      if (weightB !== undefined) {
        const weightDiff = Math.abs(weightA - weightB);
        if (weightDiff > 0.01) { // Only report meaningful differences
          differences.push({
            field: `${modelA.name} vs ${modelB.name} - Dimension: ${dimensionName}`,
            fieldType: 'weight',
            modelA: weightA,
            modelB: weightB,
            difference: weightDiff,
            significance: this.assessDifferenceSignificance(weightDiff / 100),
            impact: `Weight difference affects ${dimensionName} contribution to overall score`
          });
        }
      } else {
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Dimension: ${dimensionName}`,
          fieldType: 'weight',
          modelA: weightA,
          modelB: 'Not present',
          difference: 'Model structure difference',
          significance: 'high',
          impact: `${dimensionName} dimension is only present in ${modelA.name}`
        });
      }
    });

    // Check for dimensions only in model B
    dimensionsB.forEach((weightB, dimensionName) => {
      if (!dimensionsA.has(dimensionName)) {
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Dimension: ${dimensionName}`,
          fieldType: 'weight',
          modelA: 'Not present',
          modelB: weightB,
          difference: 'Model structure difference',
          significance: 'high',
          impact: `${dimensionName} dimension is only present in ${modelB.name}`
        });
      }
    });
  }

  /**
   * Compare error type weights between two models
   */
  private compareErrorTypeWeights(
    modelA: CustomScoringModel, 
    modelB: CustomScoringModel, 
    differences: ModelDifference[]
  ): void {
    const errorTypesA = new Map(modelA.config.errorTypes.map(e => [e.type, e.weight]));
    const errorTypesB = new Map(modelB.config.errorTypes.map(e => [e.type, e.weight]));

    errorTypesA.forEach((weightA, errorType) => {
      const weightB = errorTypesB.get(errorType);
      if (weightB !== undefined) {
        const weightDiff = Math.abs(weightA - weightB);
        if (weightDiff > 0.01) {
          differences.push({
            field: `${modelA.name} vs ${modelB.name} - Error Type: ${errorType}`,
            fieldType: 'weight',
            modelA: weightA,
            modelB: weightB,
            difference: weightDiff,
            significance: this.assessDifferenceSignificance(weightDiff / 100),
            impact: `Weight difference affects ${errorType} penalty calculation`
          });
        }
      } else {
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Error Type: ${errorType}`,
          fieldType: 'weight',
          modelA: weightA,
          modelB: 'Not present',
          difference: 'Model structure difference',
          significance: 'high',
          impact: `${errorType} error type is only present in ${modelA.name}`
        });
      }
    });
  }

  /**
   * Compare formulas between two models
   */
  private compareFormulas(
    modelA: CustomScoringModel, 
    modelB: CustomScoringModel, 
    differences: ModelDifference[]
  ): void {
    // Compare overall scoring formulas
    if (modelA.config.overallScoringFormula && modelB.config.overallScoringFormula) {
      if (modelA.config.overallScoringFormula.expression !== modelB.config.overallScoringFormula.expression) {
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Overall Scoring Formula`,
          fieldType: 'formula',
          modelA: modelA.config.overallScoringFormula.expression,
          modelB: modelB.config.overallScoringFormula.expression,
          difference: 'Formula expressions differ',
          significance: 'high',
          impact: 'Different calculation methods may produce significantly different scores'
        });
      }
    } else if (modelA.config.overallScoringFormula || modelB.config.overallScoringFormula) {
      differences.push({
        field: `${modelA.name} vs ${modelB.name} - Overall Scoring Formula`,
        fieldType: 'formula',
        modelA: modelA.config.overallScoringFormula?.expression || 'None',
        modelB: modelB.config.overallScoringFormula?.expression || 'None',
        difference: 'Formula presence differs',
        significance: 'high',
        impact: 'One model uses custom formula while the other uses default calculation'
      });
    }

    // Compare quality level formulas
    if (modelA.config.qualityLevelFormula && modelB.config.qualityLevelFormula) {
      if (modelA.config.qualityLevelFormula.expression !== modelB.config.qualityLevelFormula.expression) {
        differences.push({
          field: `${modelA.name} vs ${modelB.name} - Quality Level Formula`,
          fieldType: 'formula',
          modelA: modelA.config.qualityLevelFormula.expression,
          modelB: modelB.config.qualityLevelFormula.expression,
          difference: 'Formula expressions differ',
          significance: 'medium',
          impact: 'Different quality level calculations may affect grade assignments'
        });
      }
    }
  }

  /**
   * Perform sensitivity analysis on model parameters
   */
  private async performSensitivityAnalysis(
    models: CustomScoringModel[],
    sensitivityRange: number
  ): Promise<SensitivityAnalysisResult[]> {
    const results: SensitivityAnalysisResult[] = [];

    for (const model of models) {
      // Test dimension weight sensitivity
      for (const dimension of model.config.dimensions) {
        const result = await this.testWeightSensitivity(
          model,
          'dimension',
          dimension.name,
          dimension.weight,
          sensitivityRange
        );
        results.push(result);
      }

      // Test error type weight sensitivity
      for (const errorType of model.config.errorTypes) {
        const result = await this.testWeightSensitivity(
          model,
          'errorType',
          errorType.type,
          errorType.weight,
          sensitivityRange
        );
        results.push(result);
      }

      // Test threshold sensitivity
      const thresholdResult = await this.testThresholdSensitivity(
        model,
        model.passingThreshold,
        sensitivityRange
      );
      results.push(thresholdResult);
    }

    return results;
  }

  /**
   * Test sensitivity of weight parameters
   */
  private async testWeightSensitivity(
    model: CustomScoringModel,
    type: 'dimension' | 'errorType',
    name: string,
    originalWeight: number,
    sensitivityRange: number
  ): Promise<SensitivityAnalysisResult> {
    const testValues: number[] = [];
    const resultVariation: { value: number; scoreChange: number; percentageChange: number }[] = [];

    // Generate test values within sensitivity range
    for (let i = -sensitivityRange; i <= sensitivityRange; i += sensitivityRange / 5) {
      const testValue = Math.max(0, Math.min(100, originalWeight + i));
      testValues.push(testValue);
    }

    // Create a standard test scenario for comparison
    const testScenario = this.createStandardTestScenario();

    // Test each weight variation
    for (const testValue of testValues) {
      const modifiedModel = this.createModelWithModifiedWeight(model, type, name, testValue);
      const result = await this.calculateModelScore(modifiedModel, testScenario);
      const scoreChange = result.totalScore - (await this.calculateModelScore(model, testScenario)).totalScore;
      const percentageChange = result.percentageScore - (await this.calculateModelScore(model, testScenario)).percentageScore;

      resultVariation.push({
        value: testValue,
        scoreChange,
        percentageChange
      });
    }

    const maxVariation = Math.max(...resultVariation.map(r => Math.abs(r.percentageChange)));
    const minVariation = Math.min(...resultVariation.map(r => Math.abs(r.percentageChange)));

    return {
      parameter: `${model.name} - ${type}: ${name}`,
      parameterType: 'weight',
      originalValue: originalWeight,
      testValues,
      resultVariation,
      maxVariation,
      minVariation,
      sensitivity: this.assessSensitivity(maxVariation),
      recommendations: this.generateSensitivityRecommendations(name, type, maxVariation)
    };
  }

  /**
   * Test threshold sensitivity
   */
  private async testThresholdSensitivity(
    model: CustomScoringModel,
    originalThreshold: number,
    sensitivityRange: number
  ): Promise<SensitivityAnalysisResult> {
    const testValues: number[] = [];
    const resultVariation: { value: number; scoreChange: number; percentageChange: number }[] = [];

    // Generate test values for threshold
    for (let i = -sensitivityRange; i <= sensitivityRange; i += sensitivityRange / 5) {
      const testValue = Math.max(0, Math.min(100, originalThreshold + i));
      testValues.push(testValue);
    }

    const testScenario = this.createStandardTestScenario();

    for (const testValue of testValues) {
      const modifiedModel = { ...model, passingThreshold: testValue };
      const result = await this.calculateModelScore(modifiedModel, testScenario);
      
      // For thresholds, we're mainly interested in pass/fail boundary changes
      const originalResult = await this.calculateModelScore(model, testScenario);
      const scoreChange = result.totalScore - originalResult.totalScore;
      const percentageChange = result.percentageScore - originalResult.percentageScore;

      resultVariation.push({
        value: testValue,
        scoreChange,
        percentageChange
      });
    }

    const maxVariation = Math.max(...resultVariation.map(r => Math.abs(r.percentageChange)));
    const minVariation = Math.min(...resultVariation.map(r => Math.abs(r.percentageChange)));

    return {
      parameter: `${model.name} - Passing Threshold`,
      parameterType: 'threshold',
      originalValue: originalThreshold,
      testValues,
      resultVariation,
      maxVariation,
      minVariation,
      sensitivity: this.assessSensitivity(maxVariation),
      recommendations: this.generateThresholdRecommendations(originalThreshold, maxVariation)
    };
  }

  /**
   * Evaluate models against test scenarios
   */
  private async evaluateScenarios(
    models: CustomScoringModel[],
    scenarios: TestScenario[]
  ): Promise<ScenarioComparisonResult[]> {
    const results: ScenarioComparisonResult[] = [];

    for (const scenario of scenarios) {
      const modelResults = [];

      for (const model of models) {
        const scoreResult = await this.calculateModelScore(model, scenario);
        
        modelResults.push({
          modelId: model.id,
          modelName: model.name,
          score: scoreResult.totalScore,
          percentageScore: scoreResult.percentageScore,
          qualityLevel: scoreResult.qualityLevel,
          breakdown: {
            dimensionScores: scoreResult.dimensionScores ? 
              Object.fromEntries(Object.entries(scoreResult.dimensionScores).map(([k, v]) => [k, v.weightedScore])) : {},
            errorPenalties: scoreResult.errorTypeScores ?
              Object.fromEntries(Object.entries(scoreResult.errorTypeScores).map(([k, v]) => [k, v.penalty])) : {},
            totalPenalty: scoreResult.totalPenalty
          }
        });
      }

      // Calculate analysis
      const scores = modelResults.map(r => r.percentageScore);
      const scoreSpread = Math.max(...scores) - Math.min(...scores);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const bestPerforming = modelResults.find(r => r.percentageScore === Math.max(...scores))?.modelName || '';
      const worstPerforming = modelResults.find(r => r.percentageScore === Math.min(...scores))?.modelName || '';
      
      // Calculate consistency (lower spread = higher consistency)
      const consistencyScore = Math.max(0, 100 - (scoreSpread / avgScore) * 100);

      results.push({
        scenario,
        modelResults,
        analysis: {
          scoreSpread,
          avgScore,
          bestPerforming,
          worstPerforming,
          consistencyScore,
          recommendations: this.generateScenarioRecommendations(scenario, modelResults, scoreSpread)
        }
      });
    }

    return results;
  }

  /**
   * Calculate model score for a given scenario
   */
  private async calculateModelScore(
    model: CustomScoringModel,
    scenario: TestScenario
  ): Promise<ScoringModelResult> {
    // Create formula context from scenario
    const context = this.createFormulaContext(model, scenario);
    
    // Calculate dimension scores
    const dimensionScores: Record<string, any> = {};
    for (const dimension of model.config.dimensions) {
      const baseScore = model.maxScore * (dimension.weight / 100);
      const penalties = this.calculateDimensionPenalties(dimension, scenario);
      const finalScore = Math.max(0, baseScore - penalties);
      
      dimensionScores[dimension.id] = {
        name: dimension.name,
        score: finalScore,
        weight: dimension.weight,
        weightedScore: finalScore * (dimension.weight / 100)
      };
    }

    // Calculate error type scores
    const errorTypeScores: Record<string, any> = {};
    let totalPenalty = 0;

    for (const errorType of model.config.errorTypes) {
      const errorCount = scenario.errorPattern
        .filter(p => p.errorType === errorType.type)
        .reduce((sum, p) => sum + p.count, 0);
      
      const penalty = errorCount * (errorType.weight || 1);
      totalPenalty += penalty;

      errorTypeScores[errorType.id] = {
        name: errorType.type,
        severity: errorType.severity,
        count: errorCount,
        penalty,
        weight: errorType.weight
      };
    }

    // Calculate total score
    const totalDimensionScore = Object.values(dimensionScores).reduce((sum, d: any) => sum + d.weightedScore, 0);
    const totalScore = Math.max(0, totalDimensionScore - totalPenalty);
    const percentageScore = (totalScore / model.maxScore) * 100;

    // Determine quality level
    const qualityLevel = this.determineQualityLevel(percentageScore, model.passingThreshold);

    return {
      modelId: model.id,
      modelName: model.name,
      totalScore,
      percentageScore,
      passesThreshold: percentageScore >= model.passingThreshold,
      qualityLevel,
      dimensionScores,
      errorTypeScores,
      totalErrors: scenario.errorPattern.reduce((sum, p) => sum + p.count, 0),
      totalPenalty,
      errorRate: scenario.errorPattern.reduce((sum, p) => sum + p.count, 0) / scenario.unitCount,
      assessmentDate: new Date().toISOString(),
      unitCount: scenario.unitCount,
      scoringUnit: model.config.scoringUnit
    };
  }

  // Helper methods
  private assessDifferenceSignificance(percentage: number): 'high' | 'medium' | 'low' {
    if (percentage > 0.2) return 'high';
    if (percentage > 0.1) return 'medium';
    return 'low';
  }

  private assessSensitivity(maxVariation: number): 'high' | 'medium' | 'low' {
    if (maxVariation > 15) return 'high';
    if (maxVariation > 5) return 'medium';
    return 'low';
  }

  private createStandardTestScenario(): TestScenario {
    return {
      id: 'standard-test',
      name: 'Standard Test Scenario',
      description: 'Standard scenario for sensitivity testing',
      errorPattern: [
        { errorType: 'accuracy', severity: ErrorSeverity.MAJOR, count: 3 },
        { errorType: 'fluency', severity: ErrorSeverity.MINOR, count: 5 },
        { errorType: 'style', severity: ErrorSeverity.MAJOR, count: 2 },
        { errorType: 'terminology', severity: ErrorSeverity.CRITICAL, count: 1 }
      ],
      unitCount: 1000
    };
  }

  private createModelWithModifiedWeight(
    model: CustomScoringModel,
    type: 'dimension' | 'errorType',
    name: string,
    newWeight: number
  ): CustomScoringModel {
    const modifiedModel = JSON.parse(JSON.stringify(model));

    if (type === 'dimension') {
      const dimension = modifiedModel.config.dimensions.find((d: ScoringModelDimension) => d.name === name);
      if (dimension) dimension.weight = newWeight;
    } else if (type === 'errorType') {
      const errorType = modifiedModel.config.errorTypes.find((e: ScoringModelErrorType) => e.type === name);
      if (errorType) errorType.weight = newWeight;
    }

    return modifiedModel;
  }

  private createFormulaContext(model: CustomScoringModel, scenario: TestScenario): FormulaContext {
    const dimensions = Object.fromEntries(
      model.config.dimensions.map(d => [d.name, d.weight])
    );
    
    const errorTypes = Object.fromEntries(
      model.config.errorTypes.map(e => [e.type, e.weight])
    );

    const weights = { ...dimensions, ...errorTypes };
    
    const totalErrors = scenario.errorPattern.reduce((sum, p) => sum + p.count, 0);

    return {
      dimensions,
      errorTypes,
      weights,
      totalErrors,
      unitCount: scenario.unitCount,
      errorRate: totalErrors / scenario.unitCount,
      constants: {},
      variables: {},
      maxScore: model.maxScore,
      passingThreshold: model.passingThreshold
    };
  }

  private calculateDimensionPenalties(dimension: ScoringModelDimension, scenario: TestScenario): number {
    return scenario.errorPattern
      .filter(p => p.dimension === dimension.name)
      .reduce((sum, p) => sum + p.count * (dimension.weight / 100), 0);
  }

  private determineQualityLevel(percentageScore: number, passingThreshold: number): 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable' {
    if (percentageScore >= 95) return 'excellent';
    if (percentageScore >= 85) return 'good';
    if (percentageScore >= passingThreshold) return 'fair';
    if (percentageScore >= 50) return 'poor';
    return 'unacceptable';
  }

  private generateSensitivityRecommendations(name: string, type: string, maxVariation: number): string[] {
    const recommendations = [];
    
    if (maxVariation > 15) {
      recommendations.push(`${name} weight has high sensitivity - small changes cause significant score variations`);
      recommendations.push(`Consider more conservative weighting or additional validation for ${name}`);
    } else if (maxVariation > 5) {
      recommendations.push(`${name} weight has moderate impact on scores - review weighting carefully`);
    } else {
      recommendations.push(`${name} weight has low sensitivity - changes have minimal score impact`);
    }

    return recommendations;
  }

  private generateThresholdRecommendations(threshold: number, maxVariation: number): string[] {
    const recommendations = [];
    
    if (maxVariation > 10) {
      recommendations.push('Passing threshold is highly sensitive - consider impact on pass/fail rates');
    }
    
    if (threshold < 60) {
      recommendations.push('Low passing threshold may result in accepting lower quality');
    } else if (threshold > 85) {
      recommendations.push('High passing threshold may be too restrictive');
    }

    return recommendations;
  }

  private generateScenarioRecommendations(
    scenario: TestScenario, 
    modelResults: any[], 
    scoreSpread: number
  ): string[] {
    const recommendations = [];
    
    if (scoreSpread > 20) {
      recommendations.push(`High score variation (${scoreSpread.toFixed(1)}%) suggests models handle this scenario very differently`);
      recommendations.push('Consider reviewing model configurations for consistency');
    } else if (scoreSpread < 5) {
      recommendations.push('Models show consistent behavior for this scenario');
    }

    const avgScore = modelResults.reduce((sum, r) => sum + r.percentageScore, 0) / modelResults.length;
    if (avgScore < 70) {
      recommendations.push('Low average scores suggest this is a challenging scenario for all models');
    }

    return recommendations;
  }

  private generateOverallAnalysis(
    models: CustomScoringModel[],
    differences: ModelDifference[],
    sensitivityAnalysis: SensitivityAnalysisResult[],
    scenarioResults: ScenarioComparisonResult[]
  ): ComprehensiveComparisonResult['overallAnalysis'] {
    // Find most similar and different pairs
    const highSignificanceDiffs = differences.filter(d => d.significance === 'high');
    const pairDifferences = new Map<string, number>();

    // Count high-significance differences between pairs
    highSignificanceDiffs.forEach(diff => {
      const key = diff.field.split(' - ')[0]; // Extract model pair
      pairDifferences.set(key, (pairDifferences.get(key) || 0) + 1);
    });

    const sortedPairs = Array.from(pairDifferences.entries()).sort((a, b) => a[1] - b[1]);
    const mostSimilarPair = sortedPairs[0]?.[0].split(' vs ') as [string, string] || [models[0]?.name || '', models[1]?.name || ''];
    const mostDifferentPair = sortedPairs[sortedPairs.length - 1]?.[0].split(' vs ') as [string, string] || [models[0]?.name || '', models[1]?.name || ''];

    // Determine recommended model based on consistency and performance
    let recommendedModel = models[0]?.name || '';
    if (scenarioResults.length > 0) {
      const modelPerformance = new Map<string, number>();
      scenarioResults.forEach(result => {
        result.modelResults.forEach(model => {
          const current = modelPerformance.get(model.modelName) || 0;
          modelPerformance.set(model.modelName, current + model.percentageScore);
        });
      });

      const avgPerformance = Array.from(modelPerformance.entries())
        .map(([name, total]) => ({ name, avg: total / scenarioResults.length }))
        .sort((a, b) => b.avg - a.avg);
      
      recommendedModel = avgPerformance[0]?.name || models[0]?.name || '';
    }

    // Generate risk factors
    const riskFactors = [];
    const highSensitivityParams = sensitivityAnalysis.filter(s => s.sensitivity === 'high');
    if (highSensitivityParams.length > 0) {
      riskFactors.push(`${highSensitivityParams.length} parameters show high sensitivity to changes`);
    }

    const majorDifferences = differences.filter(d => d.significance === 'high').length;
    if (majorDifferences > 5) {
      riskFactors.push('Significant structural differences between models');
    }

    // Generate usage recommendations
    const usageRecommendations = [];
    if (scenarioResults.length > 0) {
      const avgConsistency = scenarioResults.reduce((sum, r) => sum + r.analysis.consistencyScore, 0) / scenarioResults.length;
      if (avgConsistency < 70) {
        usageRecommendations.push('Models show inconsistent behavior - consider scenario-specific model selection');
      } else {
        usageRecommendations.push('Models show consistent behavior across scenarios');
      }
    }

    if (highSensitivityParams.length > 0) {
      usageRecommendations.push('Monitor sensitive parameters closely during implementation');
    }

    usageRecommendations.push(`Based on analysis, ${recommendedModel} shows the best overall performance`);

    return {
      mostSimilarPair,
      mostDifferentPair,
      recommendedModel,
      riskFactors,
      usageRecommendations
    };
  }
}

export default ModelComparisonEngine; 