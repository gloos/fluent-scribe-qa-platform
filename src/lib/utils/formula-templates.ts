/**
 * Formula Templates Library
 * 
 * Provides a collection of common formula templates for scoring calculations,
 * organized by category and use case.
 */

import type {
  FormulaTemplate,
  FormulaCategory,
  FormulaVariable,
  FormulaFunction,
  FormulaExample
} from '@/lib/types/scoring-models';

/**
 * Basic weighted scoring formulas
 */
const DIMENSION_SCORING_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'weighted-average',
    name: 'Weighted Average Score',
    description: 'Calculate a weighted average of dimension scores',
    expression: 'dimension("fluency") * weight("fluency") / 100 + dimension("adequacy") * weight("adequacy") / 100',
    category: 'dimension_scoring',
    variables: [
      { name: 'fluency', type: 'dimension', description: 'Fluency dimension score' },
      { name: 'adequacy', type: 'dimension', description: 'Adequacy dimension score' }
    ],
    functions: [
      { name: 'dimension', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get dimension score by ID' },
      { name: 'weight', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get weight by ID' }
    ],
    tags: ['basic', 'weighted', 'average'],
    usageCount: 156,
    rating: 4.8,
    isPublic: true,
    examples: [
      {
        name: 'Basic Usage',
        description: 'Calculate weighted score for fluency and adequacy',
        context: {
          dimensions: { fluency: 85, adequacy: 90 },
          weights: { fluency: 40, adequacy: 60 }
        },
        expectedResult: 88,
        explanation: '(85 * 40/100) + (90 * 60/100) = 34 + 54 = 88'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'multi-dimension-weighted',
    name: 'Multi-Dimension Weighted Score',
    description: 'Calculate weighted score across all dimensions',
    expression: 'dimension("fluency") * weight("fluency") / 100 + dimension("adequacy") * weight("adequacy") / 100 + dimension("style") * weight("style") / 100 + dimension("terminology") * weight("terminology") / 100',
    category: 'dimension_scoring',
    variables: [
      { name: 'fluency', type: 'dimension', description: 'Fluency dimension score' },
      { name: 'adequacy', type: 'dimension', description: 'Adequacy dimension score' },
      { name: 'style', type: 'dimension', description: 'Style dimension score' },
      { name: 'terminology', type: 'dimension', description: 'Terminology dimension score' }
    ],
    functions: [
      { name: 'dimension', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get dimension score' },
      { name: 'weight', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get weight' }
    ],
    tags: ['multi-dimension', 'weighted', 'comprehensive'],
    usageCount: 89,
    rating: 4.6,
    isPublic: true,
    examples: [
      {
        name: 'Four Dimensions',
        description: 'Calculate weighted score across four quality dimensions',
        context: {
          dimensions: { fluency: 85, adequacy: 90, style: 80, terminology: 95 },
          weights: { fluency: 30, adequacy: 40, style: 20, terminology: 10 }
        },
        expectedResult: 87,
        explanation: '(85*30 + 90*40 + 80*20 + 95*10) / 100 = 8700/100 = 87'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * Error penalty calculation formulas
 */
const ERROR_PENALTY_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'linear-error-penalty',
    name: 'Linear Error Penalty',
    description: 'Apply linear penalty based on error count and severity',
    expression: 'errorType("minor") * 1 + errorType("major") * 5 + errorType("critical") * 25',
    category: 'error_penalty',
    variables: [
      { name: 'minor', type: 'errorType', description: 'Count of minor errors' },
      { name: 'major', type: 'errorType', description: 'Count of major errors' },
      { name: 'critical', type: 'errorType', description: 'Count of critical errors' }
    ],
    functions: [
      { name: 'errorType', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get error count by type' }
    ],
    tags: ['linear', 'penalty', 'severity'],
    usageCount: 203,
    rating: 4.7,
    isPublic: true,
    examples: [
      {
        name: 'Mixed Errors',
        description: 'Calculate penalty for mixed error types',
        context: {
          errorTypes: { minor: 3, major: 1, critical: 0 }
        },
        expectedResult: 8,
        explanation: '3*1 + 1*5 + 0*25 = 3 + 5 + 0 = 8 penalty points'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'percentage-error-penalty',
    name: 'Percentage-based Error Penalty',
    description: 'Calculate error penalty as percentage of total score',
    expression: 'maxScore() * (errorType("minor") * 0.02 + errorType("major") * 0.1 + errorType("critical") * 0.5)',
    category: 'error_penalty',
    variables: [
      { name: 'minor', type: 'errorType', description: 'Count of minor errors' },
      { name: 'major', type: 'errorType', description: 'Count of major errors' },
      { name: 'critical', type: 'errorType', description: 'Count of critical errors' }
    ],
    functions: [
      { name: 'errorType', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get error count by type' },
      { name: 'maxScore', parameters: [], returnType: 'number', description: 'Get maximum possible score' }
    ],
    tags: ['percentage', 'penalty', 'proportional'],
    usageCount: 134,
    rating: 4.5,
    isPublic: true,
    examples: [
      {
        name: 'Percentage Penalty',
        description: 'Calculate penalty as percentage of max score',
        context: {
          errorTypes: { minor: 2, major: 1, critical: 0 },
          maxScore: 100
        },
        expectedResult: 14,
        explanation: '100 * (2*0.02 + 1*0.1 + 0*0.5) = 100 * 0.14 = 14 penalty points'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * Overall scoring calculation formulas
 */
const OVERALL_SCORING_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'score-minus-penalty',
    name: 'Score Minus Penalty',
    description: 'Calculate final score by subtracting penalty from weighted dimension scores',
    expression: 'max(0, (dimension("fluency") * weight("fluency") + dimension("adequacy") * weight("adequacy")) / 100 - (errorType("minor") * 1 + errorType("major") * 5 + errorType("critical") * 25))',
    category: 'overall_scoring',
    variables: [
      { name: 'fluency', type: 'dimension', description: 'Fluency dimension score' },
      { name: 'adequacy', type: 'dimension', description: 'Adequacy dimension score' },
      { name: 'minor', type: 'errorType', description: 'Count of minor errors' },
      { name: 'major', type: 'errorType', description: 'Count of major errors' },
      { name: 'critical', type: 'errorType', description: 'Count of critical errors' }
    ],
    functions: [
      { name: 'max', parameters: [{ name: 'values', type: 'number', required: true }], returnType: 'number', description: 'Return maximum value' },
      { name: 'dimension', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get dimension score' },
      { name: 'weight', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get weight' },
      { name: 'errorType', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get error count' }
    ],
    tags: ['overall', 'penalty', 'comprehensive'],
    usageCount: 278,
    rating: 4.9,
    isPublic: true,
    examples: [
      {
        name: 'Complete Calculation',
        description: 'Calculate final score with penalty subtraction',
        context: {
          dimensions: { fluency: 85, adequacy: 90 },
          weights: { fluency: 50, adequacy: 50 },
          errorTypes: { minor: 2, major: 1, critical: 0 }
        },
        expectedResult: 80.5,
        explanation: 'max(0, (85*50 + 90*50)/100 - (2*1 + 1*5 + 0*25)) = max(0, 87.5 - 7) = 80.5'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mqm-scoring',
    name: 'MQM-Style Scoring',
    description: 'Calculate score using MQM methodology with error rate normalization',
    expression: 'max(0, maxScore() - (maxScore() * (totalErrors() / unitCount()) * 100))',
    category: 'overall_scoring',
    variables: [],
    functions: [
      { name: 'max', parameters: [{ name: 'values', type: 'number', required: true }], returnType: 'number', description: 'Return maximum value' },
      { name: 'maxScore', parameters: [], returnType: 'number', description: 'Get maximum possible score' },
      { name: 'totalErrors', parameters: [], returnType: 'number', description: 'Get total error count' },
      { name: 'unitCount', parameters: [], returnType: 'number', description: 'Get unit count for normalization' }
    ],
    tags: ['mqm', 'normalized', 'error-rate'],
    usageCount: 89,
    rating: 4.4,
    isPublic: true,
    examples: [
      {
        name: 'MQM Calculation',
        description: 'Calculate MQM-style score with error rate normalization',
        context: {
          maxScore: 100,
          totalErrors: 5,
          unitCount: 200
        },
        expectedResult: 97.5,
        explanation: 'max(0, 100 - (100 * (5/200) * 100)) = max(0, 100 - 2.5) = 97.5'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * Quality level determination formulas
 */
const QUALITY_LEVEL_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'threshold-quality-levels',
    name: 'Threshold-based Quality Levels',
    description: 'Determine quality level based on score thresholds',
    expression: 'if(dimension("overall") >= 95, "excellent", if(dimension("overall") >= 85, "good", if(dimension("overall") >= 70, "fair", if(dimension("overall") >= 50, "poor", "unacceptable"))))',
    category: 'quality_level',
    variables: [
      { name: 'overall', type: 'dimension', description: 'Overall calculated score' }
    ],
    functions: [
      { name: 'if', parameters: [
        { name: 'condition', type: 'boolean', required: true },
        { name: 'trueValue', type: 'any', required: true },
        { name: 'falseValue', type: 'any', required: true }
      ], returnType: 'string', description: 'Conditional logic' },
      { name: 'dimension', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get dimension score' }
    ],
    tags: ['quality-level', 'threshold', 'categorical'],
    usageCount: 167,
    rating: 4.6,
    isPublic: true,
    examples: [
      {
        name: 'Quality Classification',
        description: 'Classify score into quality levels',
        context: {
          dimensions: { overall: 87 }
        },
        expectedResult: 'good',
        explanation: 'Score 87 falls between 85-94 range, classified as "good"'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * Conditional logic formulas
 */
const CONDITIONAL_LOGIC_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'error-threshold-penalty',
    name: 'Error Threshold Penalty',
    description: 'Apply different penalty calculations based on error thresholds',
    expression: 'if(totalErrors() > 10, maxScore() * 0.5, if(totalErrors() > 5, errorType("major") * 10 + errorType("critical") * 30, errorType("minor") * 2 + errorType("major") * 5))',
    category: 'conditional_logic',
    variables: [
      { name: 'minor', type: 'errorType', description: 'Count of minor errors' },
      { name: 'major', type: 'errorType', description: 'Count of major errors' },
      { name: 'critical', type: 'errorType', description: 'Count of critical errors' }
    ],
    functions: [
      { name: 'if', parameters: [
        { name: 'condition', type: 'boolean', required: true },
        { name: 'trueValue', type: 'any', required: true },
        { name: 'falseValue', type: 'any', required: true }
      ], returnType: 'number', description: 'Conditional logic' },
      { name: 'totalErrors', parameters: [], returnType: 'number', description: 'Get total error count' },
      { name: 'maxScore', parameters: [], returnType: 'number', description: 'Get maximum possible score' },
      { name: 'errorType', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get error count by type' }
    ],
    tags: ['conditional', 'threshold', 'penalty'],
    usageCount: 78,
    rating: 4.3,
    isPublic: true,
    examples: [
      {
        name: 'Tiered Penalty',
        description: 'Apply different penalty based on total error count',
        context: {
          totalErrors: 3,
          errorTypes: { minor: 2, major: 1, critical: 0 },
          maxScore: 100
        },
        expectedResult: 9,
        explanation: 'totalErrors=3 <= 5, so use third condition: 2*2 + 1*5 = 9'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * Statistical calculation formulas
 */
const STATISTICAL_TEMPLATES: FormulaTemplate[] = [
  {
    id: 'normalized-score',
    name: 'Normalized Score',
    description: 'Normalize score to 0-100 range using min-max normalization',
    expression: '((dimension("overall") - min(dimension("fluency"), dimension("adequacy"), dimension("style"))) / (max(dimension("fluency"), dimension("adequacy"), dimension("style")) - min(dimension("fluency"), dimension("adequacy"), dimension("style")))) * 100',
    category: 'statistical',
    variables: [
      { name: 'overall', type: 'dimension', description: 'Overall score to normalize' },
      { name: 'fluency', type: 'dimension', description: 'Fluency dimension score' },
      { name: 'adequacy', type: 'dimension', description: 'Adequacy dimension score' },
      { name: 'style', type: 'dimension', description: 'Style dimension score' }
    ],
    functions: [
      { name: 'dimension', parameters: [{ name: 'id', type: 'string', required: true }], returnType: 'number', description: 'Get dimension score' },
      { name: 'min', parameters: [{ name: 'values', type: 'number', required: true }], returnType: 'number', description: 'Return minimum value' },
      { name: 'max', parameters: [{ name: 'values', type: 'number', required: true }], returnType: 'number', description: 'Return maximum value' }
    ],
    tags: ['normalization', 'statistical', 'range'],
    usageCount: 45,
    rating: 4.1,
    isPublic: true,
    examples: [
      {
        name: 'Min-Max Normalization',
        description: 'Normalize overall score to 0-100 range',
        context: {
          dimensions: { overall: 85, fluency: 75, adequacy: 95, style: 80 }
        },
        expectedResult: 50,
        explanation: '((85-75)/(95-75))*100 = (10/20)*100 = 50'
      }
    ],
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

/**
 * All formula templates organized by category
 */
export const FORMULA_TEMPLATES: Record<FormulaCategory, FormulaTemplate[]> = {
  dimension_scoring: DIMENSION_SCORING_TEMPLATES,
  error_penalty: ERROR_PENALTY_TEMPLATES,
  overall_scoring: OVERALL_SCORING_TEMPLATES,
  quality_level: QUALITY_LEVEL_TEMPLATES,
  conditional_logic: CONDITIONAL_LOGIC_TEMPLATES,
  statistical: STATISTICAL_TEMPLATES,
  custom: [] // User-defined templates will be added here
};

/**
 * Get all templates as a flat array
 */
export function getAllFormulaTemplates(): FormulaTemplate[] {
  return Object.values(FORMULA_TEMPLATES).flat();
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: FormulaCategory): FormulaTemplate[] {
  return FORMULA_TEMPLATES[category] || [];
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): FormulaTemplate[] {
  return getAllFormulaTemplates().filter(template => 
    template.tags.includes(tag)
  );
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): FormulaTemplate[] {
  const lowerQuery = query.toLowerCase();
  return getAllFormulaTemplates().filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get popular templates (sorted by usage count)
 */
export function getPopularTemplates(limit: number = 10): FormulaTemplate[] {
  return getAllFormulaTemplates()
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

/**
 * Get highly rated templates
 */
export function getHighlyRatedTemplates(minRating: number = 4.5, limit: number = 10): FormulaTemplate[] {
  return getAllFormulaTemplates()
    .filter(template => (template.rating || 0) >= minRating)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, limit);
}

/**
 * Create a new custom template
 */
export function createCustomTemplate(
  name: string,
  description: string,
  expression: string,
  category: FormulaCategory = 'custom',
  tags: string[] = []
): FormulaTemplate {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    expression,
    category,
    variables: [], // Would be extracted from expression
    functions: [], // Would be extracted from expression
    tags,
    usageCount: 0,
    isPublic: false,
    examples: [],
    createdAt: new Date().toISOString()
  };
} 