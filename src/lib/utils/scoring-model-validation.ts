/**
 * Scoring Model Validation Engine
 * 
 * Comprehensive validation framework for scoring models that ensures data integrity,
 * prevents calculation errors, and provides user-friendly error messaging.
 */

import type {
  CustomScoringModel,
  ScoringModelValidationConfig,
  ValidationContext,
  ValidationResult,
  ValidationRule,
  ValidationRuleSet,
  ValidationViolation,
  ValidationCondition,
  ValidationOperator,
  ValidationSeverity,
  ValidationRuleResult,
  FieldValidationResult,
  ScoringFormula
} from '@/lib/types/scoring-models';

/**
 * Main validation engine class
 */
export class ScoringModelValidationEngine {
  private config: ScoringModelValidationConfig;
  private context: ValidationContext;
  private violations: ValidationViolation[] = [];
  private ruleResults: Record<string, ValidationRuleResult> = {};
  private fieldResults: Record<string, FieldValidationResult> = {};

  constructor(config: ScoringModelValidationConfig, context: ValidationContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Main validation method
   */
  async validate(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Reset state
      this.violations = [];
      this.ruleResults = {};
      this.fieldResults = {};

      // Run validation phases
      await this.validateBasicStructure();
      await this.validateWeightThresholds();
      await this.validateScoreRanges();
      await this.validateRequiredFields();
      await this.validateBusinessRules();
      await this.validateFormulas();
      await this.validateCustomRules();

      // Generate field-level results
      this.generateFieldResults();

      // Build final result
      return this.buildValidationResult(Date.now() - startTime);
      
    } catch (error) {
      return this.buildErrorResult(error as Error, Date.now() - startTime);
    }
  }

  /**
   * Validate basic model structure
   */
  private async validateBasicStructure(): Promise<void> {
    const model = this.context.model;

    // Required basic fields
    const basicRequiredFields = this.config.requiredFields.basic;
    for (const field of basicRequiredFields) {
      if (!this.hasValue(model, field)) {
        this.addViolation({
          ruleId: `basic_required_${field}`,
          ruleName: `Required Field: ${field}`,
          field,
          severity: 'error',
          message: `${this.humanizeFieldName(field)} is required`,
          suggestedFix: `Please provide a value for ${this.humanizeFieldName(field)}`,
          path: field
        });
      }
    }

    // Name length validation
    if (model.name && model.name.length > 100) {
      this.addViolation({
        ruleId: 'basic_name_length',
        ruleName: 'Name Length Limit',
        field: 'name',
        severity: 'error',
        message: 'Model name must be 100 characters or less',
        suggestedFix: 'Shorten the model name to 100 characters or fewer',
        actualValue: model.name.length,
        expectedValue: '≤ 100 characters'
      });
    }

    // Version format validation
    if (model.version && !/^\d+\.\d+(\.\d+)?$/.test(model.version)) {
      this.addViolation({
        ruleId: 'basic_version_format',
        ruleName: 'Version Format',
        field: 'version',
        severity: 'warning',
        message: 'Version should follow semantic versioning format (e.g., 1.0.0)',
        suggestedFix: 'Use format: major.minor.patch (e.g., 1.0.0)',
        helpText: 'Semantic versioning helps track changes and compatibility'
      });
    }
  }

  /**
   * Validate weight thresholds
   */
  private async validateWeightThresholds(): Promise<void> {
    const model = this.context.model;
    const thresholds = this.config.weightThresholds;

    // Dimension weights validation
    if (model.config?.dimensions) {
      const dimensionWeightSum = model.config.dimensions.reduce((sum, dim) => sum + dim.weight, 0);
      
      if (thresholds.dimensionWeightSum.exact !== undefined) {
        if (dimensionWeightSum !== thresholds.dimensionWeightSum.exact) {
          this.addViolation({
            ruleId: 'weight_dimension_sum_exact',
            ruleName: 'Dimension Weight Sum',
            field: 'dimensions',
            severity: 'error',
            message: `Dimension weights must sum to exactly ${thresholds.dimensionWeightSum.exact}%`,
            suggestedFix: 'Use the auto-balance feature to distribute weights evenly',
            actualValue: dimensionWeightSum,
            expectedValue: thresholds.dimensionWeightSum.exact
          });
        }
      } else {
        if (dimensionWeightSum < thresholds.dimensionWeightSum.min || 
            dimensionWeightSum > thresholds.dimensionWeightSum.max) {
          this.addViolation({
            ruleId: 'weight_dimension_sum_range',
            ruleName: 'Dimension Weight Sum Range',
            field: 'dimensions',
            severity: 'error',
            message: `Dimension weights must sum between ${thresholds.dimensionWeightSum.min}% and ${thresholds.dimensionWeightSum.max}%`,
            suggestedFix: 'Adjust dimension weights to fall within the acceptable range',
            actualValue: dimensionWeightSum,
            expectedValue: `${thresholds.dimensionWeightSum.min}-${thresholds.dimensionWeightSum.max}`
          });
        }
      }

      // Individual dimension weight validation
      model.config.dimensions.forEach((dimension, index) => {
        if (dimension.weight < thresholds.individualWeightMin) {
          this.addViolation({
            ruleId: `weight_dimension_min_${index}`,
            ruleName: 'Minimum Dimension Weight',
            field: `dimensions[${index}].weight`,
            severity: 'warning',
            message: `Dimension "${dimension.name}" weight is below minimum threshold of ${thresholds.individualWeightMin}%`,
            suggestedFix: `Increase weight to at least ${thresholds.individualWeightMin}%`,
            actualValue: dimension.weight,
            expectedValue: `≥ ${thresholds.individualWeightMin}`
          });
        }

        if (dimension.weight > thresholds.individualWeightMax) {
          this.addViolation({
            ruleId: `weight_dimension_max_${index}`,
            ruleName: 'Maximum Dimension Weight',
            field: `dimensions[${index}].weight`,
            severity: 'warning',
            message: `Dimension "${dimension.name}" weight exceeds maximum threshold of ${thresholds.individualWeightMax}%`,
            suggestedFix: `Reduce weight to ${thresholds.individualWeightMax}% or below`,
            actualValue: dimension.weight,
            expectedValue: `≤ ${thresholds.individualWeightMax}`
          });
        }
      });
    }

    // Error type weights validation (similar logic)
    if (model.config?.errorTypes) {
      const errorWeightSum = model.config.errorTypes.reduce((sum, error) => sum + error.weight, 0);
      
      if (thresholds.errorTypeWeightSum.exact !== undefined) {
        if (errorWeightSum !== thresholds.errorTypeWeightSum.exact) {
          this.addViolation({
            ruleId: 'weight_error_sum_exact',
            ruleName: 'Error Type Weight Sum',
            field: 'errorTypes',
            severity: 'error',
            message: `Error type weights must sum to exactly ${thresholds.errorTypeWeightSum.exact}%`,
            suggestedFix: 'Use the auto-balance feature to distribute weights evenly',
            actualValue: errorWeightSum,
            expectedValue: thresholds.errorTypeWeightSum.exact
          });
        }
      }
    }
  }

  /**
   * Validate score ranges
   */
  private async validateScoreRanges(): Promise<void> {
    const model = this.context.model;
    const ranges = this.config.scoreRanges;

    // Max score validation
    if (model.maxScore !== undefined) {
      if (model.maxScore < ranges.maxScore.min || model.maxScore > ranges.maxScore.max) {
        this.addViolation({
          ruleId: 'range_max_score',
          ruleName: 'Maximum Score Range',
          field: 'maxScore',
          severity: 'error',
          message: `Maximum score must be between ${ranges.maxScore.min} and ${ranges.maxScore.max}`,
          suggestedFix: `Set maximum score to a value between ${ranges.maxScore.min} and ${ranges.maxScore.max}`,
          actualValue: model.maxScore,
          expectedValue: `${ranges.maxScore.min}-${ranges.maxScore.max}`
        });
      }
    }

    // Passing threshold validation
    if (model.passingThreshold !== undefined && model.maxScore !== undefined) {
      const thresholdPercentage = (model.passingThreshold / model.maxScore) * 100;
      
      if (thresholdPercentage < ranges.passingThreshold.min || 
          thresholdPercentage > ranges.passingThreshold.max) {
        this.addViolation({
          ruleId: 'range_passing_threshold',
          ruleName: 'Passing Threshold Range',
          field: 'passingThreshold',
          severity: 'warning',
          message: `Passing threshold percentage should be between ${ranges.passingThreshold.min}% and ${ranges.passingThreshold.max}%`,
          suggestedFix: `Adjust passing threshold to ${Math.round(model.maxScore * ranges.passingThreshold.min / 100)}-${Math.round(model.maxScore * ranges.passingThreshold.max / 100)}`,
          actualValue: Math.round(thresholdPercentage),
          expectedValue: `${ranges.passingThreshold.min}-${ranges.passingThreshold.max}%`
        });
      }

      // Logical validation: passing threshold should not exceed max score
      if (model.passingThreshold > model.maxScore) {
        this.addViolation({
          ruleId: 'logic_threshold_exceeds_max',
          ruleName: 'Logical Threshold Check',
          field: 'passingThreshold',
          severity: 'error',
          message: 'Passing threshold cannot exceed maximum score',
          suggestedFix: `Set passing threshold to ${model.maxScore} or lower`,
          actualValue: model.passingThreshold,
          expectedValue: `≤ ${model.maxScore}`
        });
      }
    }
  }

  /**
   * Validate required fields
   */
  private async validateRequiredFields(): Promise<void> {
    const model = this.context.model;
    const required = this.config.requiredFields;

    // Dimension required fields
    if (model.config?.dimensions) {
      model.config.dimensions.forEach((dimension, index) => {
        required.dimensions.forEach(field => {
          if (!this.hasValue(dimension, field)) {
            this.addViolation({
              ruleId: `required_dimension_${field}_${index}`,
              ruleName: `Required Dimension Field: ${field}`,
              field: `dimensions[${index}].${field}`,
              severity: 'error',
              message: `Dimension "${dimension.name || 'Unnamed'}" requires ${this.humanizeFieldName(field)}`,
              suggestedFix: `Provide ${this.humanizeFieldName(field)} for dimension "${dimension.name || 'Unnamed'}"`,
              path: `dimensions[${index}].${field}`
            });
          }
        });
      });
    }

    // Error type required fields
    if (model.config?.errorTypes) {
      model.config.errorTypes.forEach((errorType, index) => {
        required.errorTypes.forEach(field => {
          if (!this.hasValue(errorType, field)) {
            this.addViolation({
              ruleId: `required_error_type_${field}_${index}`,
              ruleName: `Required Error Type Field: ${field}`,
              field: `errorTypes[${index}].${field}`,
              severity: 'error',
              message: `Error type "${errorType.type || 'Unnamed'}" requires ${this.humanizeFieldName(field)}`,
              suggestedFix: `Provide ${this.humanizeFieldName(field)} for error type "${errorType.type || 'Unnamed'}"`,
              path: `errorTypes[${index}].${field}`
            });
          }
        });
      });
    }
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(): Promise<void> {
    const model = this.context.model;
    const rules = this.config.businessRules;

    // Maximum counts validation
    if (model.config?.dimensions && model.config.dimensions.length > rules.maxDimensions) {
      this.addViolation({
        ruleId: 'business_max_dimensions',
        ruleName: 'Maximum Dimensions Limit',
        field: 'dimensions',
        severity: 'error',
        message: `Model cannot have more than ${rules.maxDimensions} dimensions`,
        suggestedFix: `Remove ${model.config.dimensions.length - rules.maxDimensions} dimension(s) or combine similar dimensions`,
        actualValue: model.config.dimensions.length,
        expectedValue: `≤ ${rules.maxDimensions}`
      });
    }

    if (model.config?.errorTypes && model.config.errorTypes.length > rules.maxErrorTypes) {
      this.addViolation({
        ruleId: 'business_max_error_types',
        ruleName: 'Maximum Error Types Limit',
        field: 'errorTypes',
        severity: 'error',
        message: `Model cannot have more than ${rules.maxErrorTypes} error types`,
        suggestedFix: `Remove ${model.config.errorTypes.length - rules.maxErrorTypes} error type(s) or consolidate similar types`,
        actualValue: model.config.errorTypes.length,
        expectedValue: `≤ ${rules.maxErrorTypes}`
      });
    }

    // Empty collections validation
    if (!rules.allowEmptyDimensions && (!model.config?.dimensions || model.config.dimensions.length === 0)) {
      this.addViolation({
        ruleId: 'business_empty_dimensions',
        ruleName: 'Empty Dimensions Not Allowed',
        field: 'dimensions',
        severity: 'error',
        message: 'Model must have at least one dimension defined',
        suggestedFix: 'Add at least one scoring dimension to the model',
        helpText: 'Dimensions define the criteria used to evaluate quality'
      });
    }

    if (!rules.allowEmptyErrorTypes && (!model.config?.errorTypes || model.config.errorTypes.length === 0)) {
      this.addViolation({
        ruleId: 'business_empty_error_types',
        ruleName: 'Empty Error Types Not Allowed',
        field: 'errorTypes',
        severity: 'error',
        message: 'Model must have at least one error type defined',
        suggestedFix: 'Add at least one error type to the model',
        helpText: 'Error types define the categories of issues that can be identified'
      });
    }

    // Unique names validation
    if (rules.enforceUniqueNames) {
      this.validateUniqueNames(model);
    }
  }

  /**
   * Validate unique names
   */
  private validateUniqueNames(model: CustomScoringModel | Partial<CustomScoringModel>): void {
    // Check dimension names
    if (model.config?.dimensions) {
      const dimensionNames = model.config.dimensions.map(d => d.name?.toLowerCase()).filter(Boolean);
      const duplicateDimensions = this.findDuplicates(dimensionNames);
      
      duplicateDimensions.forEach(name => {
        this.addViolation({
          ruleId: `unique_dimension_name_${name}`,
          ruleName: 'Unique Dimension Names',
          field: 'dimensions',
          severity: 'error',
          message: `Duplicate dimension name: "${name}"`,
          suggestedFix: 'Rename one of the dimensions to make names unique',
          helpText: 'Each dimension must have a unique name for clarity'
        });
      });
    }

    // Check error type names
    if (model.config?.errorTypes) {
      const errorTypeNames = model.config.errorTypes.map(e => e.type?.toLowerCase()).filter(Boolean);
      const duplicateErrorTypes = this.findDuplicates(errorTypeNames);
      
      duplicateErrorTypes.forEach(name => {
        this.addViolation({
          ruleId: `unique_error_type_name_${name}`,
          ruleName: 'Unique Error Type Names',
          field: 'errorTypes',
          severity: 'error',
          message: `Duplicate error type name: "${name}"`,
          suggestedFix: 'Rename one of the error types to make names unique',
          helpText: 'Each error type must have a unique name for clarity'
        });
      });
    }
  }

  /**
   * Validate formulas
   */
  private async validateFormulas(): Promise<void> {
    const model = this.context.model;
    const formulaConfig = this.config.formulaValidation;

    // Validate dimension formulas
    if (model.config?.dimensions) {
      for (const [index, dimension] of model.config.dimensions.entries()) {
        if (dimension.formula) {
          await this.validateFormula(dimension.formula, `dimensions[${index}].formula`, formulaConfig);
        }
      }
    }

    // Validate error type formulas
    if (model.config?.errorTypes) {
      for (const [index, errorType] of model.config.errorTypes.entries()) {
        if (errorType.formula) {
          await this.validateFormula(errorType.formula, `errorTypes[${index}].formula`, formulaConfig);
        }
      }
    }

    // Validate model-level formulas
    if (model.config?.overallScoringFormula) {
      await this.validateFormula(model.config.overallScoringFormula, 'overallScoringFormula', formulaConfig);
    }

    if (model.config?.qualityLevelFormula) {
      await this.validateFormula(model.config.qualityLevelFormula, 'qualityLevelFormula', formulaConfig);
    }
  }

  /**
   * Validate individual formula
   */
  private async validateFormula(
    formula: ScoringFormula, 
    fieldPath: string, 
    config: any
  ): Promise<void> {
    if (!formula.isValid) {
      this.addViolation({
        ruleId: `formula_invalid_${fieldPath.replace(/[\[\].]/g, '_')}`,
        ruleName: 'Formula Validation',
        field: fieldPath,
        severity: 'error',
        message: `Formula "${formula.name}" contains validation errors`,
        suggestedFix: 'Fix the formula syntax errors using the formula editor',
        helpText: 'Formulas must pass validation before the model can be saved'
      });
    }

    // Check for banned operators
    if (config.bannedOperators && config.bannedOperators.length > 0) {
      const bannedFound = config.bannedOperators.find(op => formula.expression.includes(op));
      if (bannedFound) {
        this.addViolation({
          ruleId: `formula_banned_operator_${fieldPath.replace(/[\[\].]/g, '_')}`,
          ruleName: 'Banned Formula Operator',
          field: fieldPath,
          severity: 'error',
          message: `Formula contains banned operator: "${bannedFound}"`,
          suggestedFix: `Remove or replace the "${bannedFound}" operator`,
          helpText: 'Some operators are restricted for security or compatibility reasons'
        });
      }
    }
  }

  /**
   * Validate custom rules
   */
  private async validateCustomRules(): Promise<void> {
    for (const rule of this.config.customRules) {
      if (!rule.enabled) continue;

      try {
        const ruleStartTime = Date.now();
        const passed = await this.evaluateCustomRule(rule);
        
        this.ruleResults[rule.id] = {
          ruleId: rule.id,
          passed,
          severity: rule.severity,
          message: passed ? undefined : rule.errorMessage,
          executionTime: Date.now() - ruleStartTime,
          skipped: false
        };

        if (!passed) {
          this.addViolation({
            ruleId: rule.id,
            ruleName: rule.name,
            field: rule.field,
            severity: rule.severity,
            message: rule.errorMessage,
            suggestedFix: rule.suggestedFix,
            helpText: rule.helpText
          });
        }
      } catch (error) {
        this.ruleResults[rule.id] = {
          ruleId: rule.id,
          passed: false,
          severity: 'error',
          message: `Rule execution failed: ${error}`,
          executionTime: 0,
          skipped: true,
          skipReason: 'Execution error'
        };
      }
    }
  }

  /**
   * Evaluate custom rule condition
   */
  private async evaluateCustomRule(rule: ValidationRule): Promise<boolean> {
    return this.evaluateCondition(rule.condition, rule.field);
  }

  /**
   * Evaluate validation condition
   */
  private evaluateCondition(condition: ValidationCondition, field?: string): boolean {
    const value = field ? this.getFieldValue(field) : null;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'not_equals':
        return value !== condition.value;
      
      case 'greater_than':
        return typeof value === 'number' && value > (condition.value as number);
      
      case 'greater_than_equal':
        return typeof value === 'number' && value >= (condition.value as number);
      
      case 'less_than':
        return typeof value === 'number' && value < (condition.value as number);
      
      case 'less_than_equal':
        return typeof value === 'number' && value <= (condition.value as number);
      
      case 'between':
        return typeof value === 'number' && 
               condition.min !== undefined && 
               condition.max !== undefined &&
               value >= condition.min && 
               value <= condition.max;
      
      case 'required':
        return this.hasValue(this.context.model, field || '');
      
      case 'sum_equals':
        return this.evaluateSumCondition(condition, field, 'equals');
      
      case 'sum_between':
        return this.evaluateSumCondition(condition, field, 'between');
      
      case 'percentage_sum':
        return this.evaluatePercentageSumCondition(condition, field);
      
      default:
        return false;
    }
  }

  /**
   * Helper methods
   */
  private addViolation(violation: Omit<ValidationViolation, 'context'>): void {
    this.violations.push({
      ...violation,
      context: {
        mode: this.context.mode,
        timestamp: new Date().toISOString()
      }
    });
  }

  private hasValue(obj: any, path: string): boolean {
    return this.getFieldValue(path, obj) !== null && 
           this.getFieldValue(path, obj) !== undefined && 
           this.getFieldValue(path, obj) !== '';
  }

  private getFieldValue(path: string, obj = this.context.model): any {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        // Handle array notation like "dimensions[0]"
        const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayName, index] = arrayMatch;
          return current[arrayName]?.[parseInt(index)];
        }
        return current[key];
      }
      return undefined;
    }, obj);
  }

  private humanizeFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private findDuplicates<T>(array: T[]): T[] {
    const seen = new Set<T>();
    const duplicates = new Set<T>();
    
    for (const item of array) {
      if (seen.has(item)) {
        duplicates.add(item);
      } else {
        seen.add(item);
      }
    }
    
    return Array.from(duplicates);
  }

  private evaluateSumCondition(condition: ValidationCondition, field?: string, type: 'equals' | 'between' = 'equals'): boolean {
    const arrayPath = field?.replace(/\[\d+\]\.weight$/, '') || '';
    const array = this.getFieldValue(arrayPath);
    
    if (!Array.isArray(array)) return false;
    
    const sum = array.reduce((total, item) => total + (item.weight || 0), 0);
    
    if (type === 'equals') {
      return sum === condition.value;
    } else {
      return condition.min !== undefined && 
             condition.max !== undefined &&
             sum >= condition.min && 
             sum <= condition.max;
    }
  }

  private evaluatePercentageSumCondition(condition: ValidationCondition, field?: string): boolean {
    return this.evaluateSumCondition({
      ...condition,
      operator: 'sum_equals',
      value: 100
    }, field, 'equals');
  }

  private generateFieldResults(): void {
    // Group violations by field
    const fieldViolations: Record<string, ValidationViolation[]> = {};
    
    this.violations.forEach(violation => {
      if (violation.field) {
        if (!fieldViolations[violation.field]) {
          fieldViolations[violation.field] = [];
        }
        fieldViolations[violation.field].push(violation);
      }
    });

    // Create field results
    Object.entries(fieldViolations).forEach(([field, violations]) => {
      const hasErrors = violations.some(v => v.severity === 'error');
      const maxSeverity = violations.reduce((max, v) => {
        if (v.severity === 'error') return 'error';
        if (max === 'error') return max;
        if (v.severity === 'warning') return 'warning';
        return max === 'warning' ? max : 'info';
      }, 'info' as ValidationSeverity);

      this.fieldResults[field] = {
        field,
        isValid: !hasErrors,
        severity: maxSeverity,
        messages: violations.map(v => v.message),
        suggestedFixes: violations.map(v => v.suggestedFix).filter(Boolean) as string[],
        rules: violations.map(v => v.ruleId)
      };
    });
  }

  private buildValidationResult(duration: number): ValidationResult {
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');
    const info = this.violations.filter(v => v.severity === 'info');

    const totalRules = Object.keys(this.ruleResults).length;
    const passedRules = Object.values(this.ruleResults).filter(r => r.passed).length;
    const failedRules = totalRules - passedRules;

    const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      info,
      summary: {
        totalRules,
        passedRules,
        failedRules,
        skippedRules: Object.values(this.ruleResults).filter(r => r.skipped).length,
        errorCount: errors.length,
        warningCount: warnings.length,
        infoCount: info.length,
        completionPercentage: this.calculateCompletionPercentage(),
        recommendations: this.generateRecommendations()
      },
      fieldValidation: this.fieldResults,
      ruleResults: this.ruleResults,
      validatedAt: new Date().toISOString(),
      validationDuration: duration
    };
  }

  private buildErrorResult(error: Error, duration: number): ValidationResult {
    return {
      isValid: false,
      score: 0,
      errors: [{
        ruleId: 'validation_engine_error',
        ruleName: 'Validation Engine Error',
        severity: 'error',
        message: `Validation failed: ${error.message}`,
        suggestedFix: 'Please try again or contact support if the issue persists'
      }],
      warnings: [],
      info: [],
      summary: {
        totalRules: 0,
        passedRules: 0,
        failedRules: 1,
        skippedRules: 0,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        completionPercentage: 0,
        recommendations: ['Fix validation engine error before proceeding']
      },
      fieldValidation: {},
      ruleResults: {},
      validatedAt: new Date().toISOString(),
      validationDuration: duration
    };
  }

  private calculateCompletionPercentage(): number {
    const model = this.context.model;
    let completed = 0;
    let total = 0;

    // Basic fields
    const basicFields = ['name', 'description', 'framework', 'maxScore', 'passingThreshold'];
    basicFields.forEach(field => {
      total++;
      if (this.hasValue(model, field)) completed++;
    });

    // Dimensions
    if (model.config?.dimensions && model.config.dimensions.length > 0) {
      total++;
      completed++;
      
      // Check dimension completeness
      model.config.dimensions.forEach(dimension => {
        total += 2; // name and weight
        if (dimension.name) completed++;
        if (dimension.weight > 0) completed++;
      });
    }

    // Error types
    if (model.config?.errorTypes && model.config.errorTypes.length > 0) {
      total++;
      completed++;
      
      // Check error type completeness
      model.config.errorTypes.forEach(errorType => {
        total += 2; // type and weight
        if (errorType.type) completed++;
        if (errorType.weight > 0) completed++;
      });
    }

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');

    if (errors.length > 0) {
      recommendations.push(`Fix ${errors.length} critical error${errors.length === 1 ? '' : 's'} before saving`);
    }

    if (warnings.length > 0) {
      recommendations.push(`Review ${warnings.length} warning${warnings.length === 1 ? '' : 's'} for best practices`);
    }

    if (errors.length === 0 && warnings.length === 0) {
      recommendations.push('Model validation passed - ready to save');
    }

    // Add specific recommendations based on violation patterns
    const weightIssues = this.violations.filter(v => v.ruleId.includes('weight'));
    if (weightIssues.length > 0) {
      recommendations.push('Use auto-balance features to ensure proper weight distribution');
    }

    const formulaIssues = this.violations.filter(v => v.ruleId.includes('formula'));
    if (formulaIssues.length > 0) {
      recommendations.push('Test formulas thoroughly using the formula tester before finalizing');
    }

    return recommendations;
  }
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ScoringModelValidationConfig = {
  customRules: [],
  
  weightThresholds: {
    dimensionWeightSum: { min: 95, max: 105, exact: 100 },
    errorTypeWeightSum: { min: 95, max: 105, exact: 100 },
    individualWeightMin: 0,
    individualWeightMax: 100
  },
  
  scoreRanges: {
    maxScore: { min: 1, max: 1000 },
    passingThreshold: { min: 50, max: 95 },
    qualityLevels: { min: 0, max: 100 }
  },
  
  requiredFields: {
    basic: ['name', 'framework'],
    dimensions: ['name', 'weight'],
    errorTypes: ['type', 'severity', 'weight'],
    formulas: ['name', 'expression']
  },
  
  businessRules: {
    maxDimensions: 20,
    maxErrorTypes: 50,
    maxSubcriteria: 10,
    maxFormulasPerElement: 5,
    
    allowEmptyDimensions: false,
    allowEmptyErrorTypes: false,
    requireFormulaValidation: true,
    enforceUniqueNames: true
  },
  
  formulaValidation: {
    allowCustomFunctions: true,
    maxComplexity: 100,
    requireTestCoverage: false,
    bannedOperators: [],
    requiredVariables: []
  }
};

/**
 * Utility functions
 */
export const ValidationUtils = {
  /**
   * Create validation context
   */
  createContext(
    model: CustomScoringModel | Partial<CustomScoringModel>,
    mode: 'create' | 'edit' | 'validate' | 'test' = 'validate',
    config: Partial<ScoringModelValidationConfig> = {}
  ): ValidationContext {
    return {
      model,
      mode,
      validationConfig: { ...DEFAULT_VALIDATION_CONFIG, ...config },
      strictMode: false,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Quick validation for forms
   */
  async quickValidate(
    model: CustomScoringModel | Partial<CustomScoringModel>,
    config?: Partial<ScoringModelValidationConfig>
  ): Promise<ValidationResult> {
    const context = ValidationUtils.createContext(model, 'validate', config);
    const engine = new ScoringModelValidationEngine(context.validationConfig, context);
    return await engine.validate();
  }
}; 