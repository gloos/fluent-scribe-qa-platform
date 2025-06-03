import type { AssessmentFramework, ErrorSeverity } from './assessment';

/**
 * Custom Scoring Model Types
 * 
 * These types extend the existing assessment infrastructure to support
 * user-defined custom scoring models for quality assessment.
 */

export interface ScoringModelDimension {
  id: string;
  name: string;
  weight: number;
  description?: string;
  subcriteria: ScoringModelSubcriteria[];
  formula?: ScoringFormula;
}

export interface ScoringModelSubcriteria {
  id: string;
  name: string;
  weight: number;
  description?: string;
  formula?: ScoringFormula;
}

export interface ScoringModelErrorType {
  id: string;
  type: string;
  severity: ErrorSeverity;
  weight: number;
  description?: string;
  formula?: ScoringFormula;
}

export interface ScoringModelConfig {
  // Scoring configuration
  scoringUnit: 'words' | 'segments' | 'characters';
  unitCount: number;
  wordCountBased: boolean;
  segmentLevelScoring: boolean;
  
  // Dimensions configuration
  dimensions: ScoringModelDimension[];
  
  // Error types configuration
  errorTypes: ScoringModelErrorType[];
  
  // Model-level formulas
  overallScoringFormula?: ScoringFormula;
  qualityLevelFormula?: ScoringFormula;
}

export interface CustomScoringModel {
  id: string;
  name: string;
  description?: string;
  framework: AssessmentFramework;
  version: string;
  
  // Ownership and scope
  organizationId?: string;
  projectId?: string;
  isGlobal: boolean;
  isActive: boolean;
  
  // Scoring configuration
  maxScore: number;
  passingThreshold: number;
  config: ScoringModelConfig;
  
  // Metadata
  tags: string[];
  metadata: Record<string, any>;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomScoringModelData {
  name: string;
  description?: string;
  framework?: AssessmentFramework;
  version?: string;
  organizationId?: string;
  projectId?: string;
  isGlobal?: boolean;
  config: ScoringModelConfig;
  maxScore?: number;
  passingThreshold?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateCustomScoringModelData extends Partial<CreateCustomScoringModelData> {
  isActive?: boolean;
}

/**
 * Scoring Model Calculation Results
 */
export interface ScoringModelResult {
  modelId: string;
  modelName: string;
  
  // Overall scoring
  totalScore: number;
  percentageScore: number;
  passesThreshold: boolean;
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';
  
  // Dimension breakdown
  dimensionScores: {
    [dimensionId: string]: {
      name: string;
      score: number;
      weight: number;
      weightedScore: number;
      subcriteriaScores?: {
        [subcriteriaId: string]: {
          name: string;
          score: number;
          weight: number;
        };
      };
    };
  };
  
  // Error type breakdown
  errorTypeScores: {
    [errorTypeId: string]: {
      name: string;
      severity: ErrorSeverity;
      count: number;
      penalty: number;
      weight: number;
    };
  };
  
  // Statistical data
  totalErrors: number;
  totalPenalty: number;
  errorRate: number; // errors per unit
  confidenceInterval?: {
    lower: number;
    upper: number;
    confidenceLevel: number;
  };
  
  // Assessment metadata
  assessmentDate: string;
  assessorId?: string;
  unitCount: number;
  scoringUnit: string;
}

/**
 * Model validation and preview
 */
export interface ScoringModelValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionPercentage: number;
  recommendations: string[];
}

export interface ScoringModelPreview {
  model: CustomScoringModel;
  validation: ScoringModelValidation;
  sampleCalculation?: {
    sampleErrors: Array<{
      type: string;
      severity: ErrorSeverity;
      dimension?: string;
    }>;
    expectedResult: ScoringModelResult;
  };
}

/**
 * Model templates and presets
 */
export interface ScoringModelTemplate {
  id: string;
  name: string;
  description: string;
  category: 'translation' | 'content' | 'technical' | 'general';
  framework: AssessmentFramework;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  config: ScoringModelConfig;
  tags: string[];
  createdBy?: string;
  createdAt: string;
}

/**
 * Model comparison utilities
 */
export interface ScoringModelComparison {
  models: CustomScoringModel[];
  comparisonMetrics: {
    [modelId: string]: {
      averageScore: number;
      passRate: number;
      errorDistribution: Record<string, number>;
      dimensionCorrelation: Record<string, number>;
    };
  };
  recommendations: string[];
  generatedAt: string;
}

/**
 * Utility types for form handling
 */
export type ScoringModelFormData = Omit<CreateCustomScoringModelData, 'organizationId' | 'projectId'> & {
  dimensions: ScoringModelDimension[];
  errorTypes: ScoringModelErrorType[];
};

export type ScoringModelFormValidation = {
  dimensionWeightTotal: number;
  errorTypeWeightTotal: number;
  hasRequiredFields: boolean;
  isValidForSave: boolean;
};

/**
 * Formula Builder Types
 */
export interface ScoringFormula {
  id: string;
  name: string;
  description?: string;
  expression: string;
  variables: FormulaVariable[];
  functions: FormulaFunction[];
  isValid: boolean;
  validationErrors: string[];
  category: FormulaCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FormulaVariable {
  name: string;
  type: 'dimension' | 'errorType' | 'constant' | 'reference';
  description?: string;
  defaultValue?: number;
  referenceId?: string;
}

export interface FormulaFunction {
  name: string;
  parameters: FormulaPameter[];
  returnType: 'number' | 'boolean' | 'string';
  description?: string;
}

export interface FormulaPameter {
  name: string;
  type: 'number' | 'boolean' | 'string' | 'any';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export type FormulaCategory = 
  | 'dimension_scoring'
  | 'error_penalty'
  | 'overall_scoring'
  | 'quality_level'
  | 'conditional_logic'
  | 'statistical'
  | 'custom';

/**
 * Formula evaluation context
 */
export interface FormulaContext {
  dimensions: Record<string, number>;
  errorTypes: Record<string, number>;
  weights: Record<string, number>;
  
  totalErrors: number;
  unitCount: number;
  errorRate: number;
  
  constants: Record<string, number>;
  variables: Record<string, any>;
  
  maxScore: number;
  passingThreshold: number;
}

/**
 * Formula validation and execution results
 */
export interface FormulaValidationResult {
  isValid: boolean;
  errors: FormulaValidationError[];
  warnings: string[];
  suggestedFixes: string[];
  parseTime: number;
}

export interface FormulaValidationError {
  type: 'syntax' | 'semantic' | 'reference' | 'type' | 'security';
  message: string;
  position?: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  severity: 'error' | 'warning';
}

export interface FormulaExecutionResult {
  success: boolean;
  result?: number | boolean | string;
  executionTime: number;
  error?: string;
  context: FormulaContext;
}

/**
 * Formula templates and presets
 */
export interface FormulaTemplate {
  id: string;
  name: string;
  description: string;
  expression: string;
  category: FormulaCategory;
  variables: FormulaVariable[];
  functions: FormulaFunction[];
  tags: string[];
  usageCount: number;
  rating?: number;
  isPublic: boolean;
  examples: FormulaExample[];
  createdBy?: string;
  createdAt: string;
}

export interface FormulaExample {
  name: string;
  description: string;
  context: Partial<FormulaContext>;
  expectedResult: number | boolean | string;
  explanation?: string;
}

/**
 * Formula builder state and configuration
 */
export interface FormulaBuilderState {
  currentFormula: ScoringFormula;
  activeTemplate?: FormulaTemplate;
  validationResult: FormulaValidationResult;
  testResults: FormulaExecutionResult[];
  availableVariables: FormulaVariable[];
  availableFunctions: FormulaFunction[];
  isTestMode: boolean;
  testContext: FormulaContext;
}

export interface FormulaTestResult {
  id: string;
  timestamp: string;
  expression: string;
  context: FormulaContext;
  result: FormulaExecutionResult;
  success: boolean;
}

/**
 * Validation Rules System Types
 * 
 * Comprehensive validation framework for scoring models to ensure data integrity
 * and prevent calculation errors with customizable rules and user-friendly messaging.
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationRuleType = 
  | 'threshold'
  | 'range'
  | 'required'
  | 'format'
  | 'business'
  | 'dependency'
  | 'custom';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: ValidationRuleType;
  severity: ValidationSeverity;
  enabled: boolean;
  
  // Rule conditions
  field?: string;
  condition: ValidationCondition;
  
  // Error messaging
  errorMessage: string;
  suggestedFix?: string;
  helpText?: string;
  
  // Rule metadata
  category: string;
  tags: string[];
  priority: number; // 1-10, higher = more important
  createdAt: string;
  updatedAt: string;
}

export interface ValidationCondition {
  operator: ValidationOperator;
  value?: any;
  values?: any[]; // For 'in', 'not_in' operators
  pattern?: string; // For regex validation
  customFn?: string; // Serialized custom function
  
  // Threshold and range specifics
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  
  // Dependency validation
  dependsOn?: string[]; // Field names this validation depends on
  conditionalLogic?: ValidationConditionalLogic;
}

export type ValidationOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_equal'
  | 'less_than'
  | 'less_than_equal'
  | 'between'
  | 'not_between'
  | 'in'
  | 'not_in'
  | 'matches'
  | 'not_matches'
  | 'required'
  | 'optional'
  | 'length_between'
  | 'sum_equals'
  | 'sum_between'
  | 'percentage_sum'
  | 'custom';

export interface ValidationConditionalLogic {
  if: ValidationCondition;
  then: ValidationCondition;
  else?: ValidationCondition;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100, overall validation health score
  
  errors: ValidationViolation[];
  warnings: ValidationViolation[];
  info: ValidationViolation[];
  
  summary: {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    skippedRules: number;
    
    errorCount: number;
    warningCount: number;
    infoCount: number;
    
    completionPercentage: number;
    recommendations: string[];
  };
  
  fieldValidation: Record<string, FieldValidationResult>;
  ruleResults: Record<string, ValidationRuleResult>;
  
  validatedAt: string;
  validationDuration: number; // milliseconds
}

export interface ValidationViolation {
  ruleId: string;
  ruleName: string;
  field?: string;
  severity: ValidationSeverity;
  message: string;
  suggestedFix?: string;
  helpText?: string;
  
  // Location information for UI highlighting
  path?: string; // JSONPath to the problematic field
  position?: {
    line?: number;
    column?: number;
    start?: number;
    end?: number;
  };
  
  // Context data
  actualValue?: any;
  expectedValue?: any;
  context?: Record<string, any>;
}

export interface FieldValidationResult {
  field: string;
  isValid: boolean;
  severity: ValidationSeverity;
  messages: string[];
  suggestedFixes: string[];
  rules: string[]; // Rule IDs that were applied
}

export interface ValidationRuleResult {
  ruleId: string;
  passed: boolean;
  severity: ValidationSeverity;
  message?: string;
  executionTime: number;
  skipped: boolean;
  skipReason?: string;
}

export interface ValidationRuleSet {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Organization and scope
  organizationId?: string;
  projectId?: string;
  isGlobal: boolean;
  isDefault: boolean;
  
  // Rules configuration
  rules: ValidationRule[];
  ruleGroups: ValidationRuleGroup[];
  
  // Execution settings
  stopOnFirstError: boolean;
  maxErrors: number;
  timeout: number; // milliseconds
  
  // Metadata
  tags: string[];
  metadata: Record<string, any>;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRuleGroup {
  id: string;
  name: string;
  description?: string;
  rules: string[]; // Rule IDs
  enabled: boolean;
  
  // Execution order and dependencies
  priority: number;
  dependsOn: string[]; // Other group IDs
  
  // Conditional execution
  condition?: ValidationCondition;
  
  // Error handling
  continueOnError: boolean;
  requiredPassRate?: number; // 0-1, minimum pass rate for group to be considered valid
}

export interface ScoringModelValidationConfig {
  ruleSetId?: string;
  customRules: ValidationRule[];
  
  // Threshold configurations
  weightThresholds: {
    dimensionWeightSum: { min: number; max: number; exact?: number };
    errorTypeWeightSum: { min: number; max: number; exact?: number };
    individualWeightMin: number;
    individualWeightMax: number;
  };
  
  // Range configurations
  scoreRanges: {
    maxScore: { min: number; max: number };
    passingThreshold: { min: number; max: number };
    qualityLevels: { min: number; max: number };
  };
  
  // Field requirements
  requiredFields: {
    basic: string[];
    dimensions: string[];
    errorTypes: string[];
    formulas: string[];
  };
  
  // Business rules
  businessRules: {
    maxDimensions: number;
    maxErrorTypes: number;
    maxSubcriteria: number;
    maxFormulasPerElement: number;
    
    allowEmptyDimensions: boolean;
    allowEmptyErrorTypes: boolean;
    requireFormulaValidation: boolean;
    enforceUniqueNames: boolean;
  };
  
  // Formula validation settings
  formulaValidation: {
    allowCustomFunctions: boolean;
    maxComplexity: number;
    requireTestCoverage: boolean;
    bannedOperators: string[];
    requiredVariables: string[];
  };
}

export interface ValidationContext {
  model: CustomScoringModel | Partial<CustomScoringModel>;
  mode: 'create' | 'edit' | 'validate' | 'test';
  
  // User and organization context
  userId?: string;
  organizationId?: string;
  projectId?: string;
  
  // Validation settings
  validationConfig: ScoringModelValidationConfig;
  strictMode: boolean;
  
  // Additional context data
  existingModels?: CustomScoringModel[];
  templateData?: ScoringModelTemplate;
  dependencies?: Record<string, any>;
  
  // Runtime data
  timestamp: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ValidationRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: ValidationRuleType;
  
  // Template configuration
  template: Omit<ValidationRule, 'id' | 'createdAt' | 'updatedAt'>;
  
  // Template metadata
  isBuiltIn: boolean;
  usageCount: number;
  rating?: number;
  examples: ValidationRuleExample[];
  
  // Customization options
  customizable: string[]; // Fields that can be customized
  presets: Record<string, Partial<ValidationRule>>;
  
  tags: string[];
  createdBy?: string;
  createdAt: string;
}

export interface ValidationRuleExample {
  name: string;
  description: string;
  modelData: Partial<CustomScoringModel>;
  expectedResult: {
    shouldPass: boolean;
    expectedViolations?: string[];
  };
  explanation?: string;
}

export interface ValidationDashboard {
  overallHealth: {
    score: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    lastValidation: string;
  };
  
  ruleCompliance: {
    totalRules: number;
    passingRules: number;
    failingRules: number;
    byCategory: Record<ValidationRuleType, { total: number; passing: number }>;
    bySeverity: Record<ValidationSeverity, number>;
  };
  
  topIssues: Array<{
    ruleId: string;
    ruleName: string;
    frequency: number;
    impact: ValidationSeverity;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    actionItems: string[];
    estimatedImpact: string;
  }>;
  
  historicalData: Array<{
    date: string;
    score: number;
    issueCount: number;
    ruleCount: number;
  }>;
}

/**
 * Documentation System Types
 * 
 * Comprehensive documentation framework for scoring models, providing
 * annotation capabilities, change tracking, and multi-format export options.
 */

export interface ScoringModelDocumentation {
  id: string;
  modelId: string;
  modelName: string;
  version: string;
  
  // Core documentation sections
  overview: ModelDocumentationOverview;
  specifications: ModelSpecificationDoc;
  implementation: ModelImplementationDoc;
  usage: ModelUsageDoc;
  
  // Interactive features
  annotations: ModelAnnotation[];
  changeHistory: ModelChangeRecord[];
  
  // Metadata
  tags: string[];
  categories: string[];
  language: string;
  
  // Access control
  isPublic: boolean;
  organizationId?: string;
  projectId?: string;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  lastExportedAt?: string;
}

export interface ModelDocumentationOverview {
  purpose: string;
  scope: string;
  targetAudience: string[];
  keyFeatures: string[];
  limitations: string[];
  prerequisites: string[];
  relatedModels: string[];
  recommendedUseCases: string[];
  notRecommendedUseCases: string[];
}

export interface ModelSpecificationDoc {
  // Model structure
  dimensions: DimensionDocumentation[];
  errorTypes: ErrorTypeDocumentation[];
  formulas: FormulaDocumentation[];
  validation: ValidationDocumentation;
  
  // Configuration details
  scoringConfiguration: {
    maxScore: number;
    passingThreshold: number;
    scoringUnit: string;
    unitCount: number;
    explanation: string;
  };
  
  // Performance characteristics
  performance: {
    averageExecutionTime: string;
    memoryRequirements: string;
    scalabilityNotes: string;
  };
}

export interface DimensionDocumentation {
  id: string;
  name: string;
  weight: number;
  
  // Documentation content
  description: string;
  purpose: string;
  scoringCriteria: string;
  examples: string[];
  
  // Implementation details
  subcriteria: SubcriteriaDocumentation[];
  formula?: FormulaDocumentation;
  
  // Usage guidance
  bestPractices: string[];
  commonMistakes: string[];
  troubleshooting: string[];
  
  // Annotations and notes
  annotations: ModelAnnotation[];
}

export interface SubcriteriaDocumentation {
  id: string;
  name: string;
  weight: number;
  description: string;
  evaluationGuidelines: string;
  examples: string[];
  formula?: FormulaDocumentation;
  annotations: ModelAnnotation[];
}

export interface ErrorTypeDocumentation {
  id: string;
  type: string;
  severity: string;
  weight: number;
  
  // Documentation content
  description: string;
  detectionCriteria: string;
  penaltyCalculation: string;
  examples: ErrorExample[];
  
  // Implementation details
  formula?: FormulaDocumentation;
  
  // Usage guidance
  identificationTips: string[];
  resolutionStrategies: string[];
  
  // Annotations and notes
  annotations: ModelAnnotation[];
}

export interface ErrorExample {
  title: string;
  description: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  severity: string;
  impact: string;
}

export interface FormulaDocumentation {
  id: string;
  name: string;
  expression: string;
  category: string;
  
  // Documentation content
  description: string;
  purpose: string;
  logic: string;
  
  // Technical details
  variables: VariableDocumentation[];
  functions: FunctionDocumentation[];
  dependencies: string[];
  
  // Examples and testing
  examples: FormulaExample[];
  testCases: FormulaTestCase[];
  
  // Performance and limitations
  complexity: 'low' | 'medium' | 'high';
  performanceNotes: string[];
  limitations: string[];
  
  // Annotations and notes
  annotations: ModelAnnotation[];
}

export interface VariableDocumentation {
  name: string;
  type: string;
  description: string;
  expectedRange: string;
  defaultValue?: any;
  examples: any[];
}

export interface FunctionDocumentation {
  name: string;
  parameters: string[];
  returnType: string;
  description: string;
  usage: string;
  examples: string[];
}

export interface FormulaTestCase {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput: any;
  actualOutput?: any;
  passed?: boolean;
  notes?: string;
}

export interface ValidationDocumentation {
  overview: string;
  rules: ValidationRuleDocumentation[];
  businessRules: BusinessRuleDocumentation[];
  dataQuality: DataQualityDocumentation;
}

export interface ValidationRuleDocumentation {
  id: string;
  name: string;
  type: string;
  severity: string;
  
  // Documentation content
  description: string;
  rationale: string;
  implementation: string;
  
  // Examples
  passingExamples: ValidationExample[];
  failingExamples: ValidationExample[];
  
  // Troubleshooting
  commonViolations: string[];
  resolutionSteps: string[];
  
  annotations: ModelAnnotation[];
}

export interface ValidationExample {
  scenario: string;
  data: Record<string, any>;
  result: 'pass' | 'fail' | 'warning';
  explanation: string;
}

export interface BusinessRuleDocumentation {
  category: string;
  rules: string[];
  rationale: string;
  implications: string[];
  exceptions: string[];
}

export interface DataQualityDocumentation {
  requirements: string[];
  constraints: string[];
  dataPreparation: string[];
  qualityChecks: string[];
}

export interface ModelImplementationDoc {
  architecture: ArchitectureDocumentation;
  algorithms: AlgorithmDocumentation[];
  integrations: IntegrationDocumentation[];
  deployment: DeploymentDocumentation;
  maintenance: MaintenanceDocumentation;
}

export interface ArchitectureDocumentation {
  overview: string;
  components: ComponentDocumentation[];
  dataFlow: string;
  dependencies: DependencyDocumentation[];
  designDecisions: DesignDecision[];
}

export interface ComponentDocumentation {
  name: string;
  purpose: string;
  interface: string;
  implementation: string;
  testingStrategy: string;
}

export interface DependencyDocumentation {
  name: string;
  type: 'internal' | 'external';
  version?: string;
  purpose: string;
  criticality: 'high' | 'medium' | 'low';
}

export interface DesignDecision {
  title: string;
  context: string;
  decision: string;
  rationale: string;
  consequences: string[];
  alternatives: string[];
  date: string;
}

export interface AlgorithmDocumentation {
  name: string;
  purpose: string;
  description: string;
  pseudocode: string;
  complexity: {
    time: string;
    space: string;
  };
  tradeoffs: string[];
  references: string[];
}

export interface IntegrationDocumentation {
  system: string;
  type: 'incoming' | 'outgoing' | 'bidirectional';
  protocol: string;
  dataFormat: string;
  authentication: string;
  errorHandling: string;
  examples: IntegrationExample[];
}

export interface IntegrationExample {
  scenario: string;
  request: any;
  response: any;
  notes: string;
}

export interface DeploymentDocumentation {
  environments: EnvironmentDocumentation[];
  requirements: string[];
  installation: string[];
  configuration: ConfigurationDocumentation[];
  verification: string[];
  rollback: string[];
}

export interface EnvironmentDocumentation {
  name: string;
  purpose: string;
  url?: string;
  configuration: Record<string, any>;
  notes: string[];
}

export interface ConfigurationDocumentation {
  parameter: string;
  description: string;
  type: string;
  defaultValue: any;
  required: boolean;
  examples: any[];
}

export interface MaintenanceDocumentation {
  monitoring: MonitoringDocumentation;
  troubleshooting: TroubleshootingDocumentation;
  updates: UpdateDocumentation;
  backup: BackupDocumentation;
}

export interface MonitoringDocumentation {
  metrics: MetricDocumentation[];
  alerts: AlertDocumentation[];
  dashboards: DashboardDocumentation[];
  logs: LogDocumentation[];
}

export interface MetricDocumentation {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  unit: string;
  threshold: {
    warning?: number;
    critical?: number;
  };
}

export interface AlertDocumentation {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  notification: string[];
  runbook: string;
}

export interface DashboardDocumentation {
  name: string;
  purpose: string;
  url?: string;
  panels: string[];
  audience: string[];
}

export interface LogDocumentation {
  source: string;
  level: string;
  format: string;
  retention: string;
  location: string;
}

export interface TroubleshootingDocumentation {
  commonIssues: IssueDocumentation[];
  diagnostics: DiagnosticDocumentation[];
  escalation: EscalationDocumentation;
}

export interface IssueDocumentation {
  problem: string;
  symptoms: string[];
  causes: string[];
  solutions: string[];
  prevention: string[];
}

export interface DiagnosticDocumentation {
  tool: string;
  purpose: string;
  usage: string;
  interpretation: string;
}

export interface EscalationDocumentation {
  levels: EscalationLevel[];
  contacts: ContactDocumentation[];
  procedures: string[];
}

export interface EscalationLevel {
  level: number;
  description: string;
  criteria: string[];
  timeframe: string;
  contacts: string[];
}

export interface ContactDocumentation {
  role: string;
  name?: string;
  email?: string;
  phone?: string;
  availability: string;
}

export interface UpdateDocumentation {
  versioning: VersioningDocumentation;
  changelog: ChangelogDocumentation[];
  migration: MigrationDocumentation[];
  testing: TestingDocumentation;
}

export interface VersioningDocumentation {
  scheme: string;
  strategy: string;
  compatibility: string;
  lifecycle: string;
}

export interface ChangelogDocumentation {
  version: string;
  date: string;
  changes: ChangeDocumentation[];
  migration?: string;
  breaking?: boolean;
}

export interface ChangeDocumentation {
  type: 'feature' | 'bugfix' | 'enhancement' | 'breaking' | 'deprecated';
  description: string;
  impact: string;
  reference?: string;
}

export interface MigrationDocumentation {
  fromVersion: string;
  toVersion: string;
  steps: string[];
  validation: string[];
  rollback: string[];
  duration: string;
}

export interface TestingDocumentation {
  strategy: string;
  types: TestTypeDocumentation[];
  coverage: CoverageDocumentation;
  automation: AutomationDocumentation;
}

export interface TestTypeDocumentation {
  type: string;
  purpose: string;
  scope: string;
  tools: string[];
  frequency: string;
}

export interface CoverageDocumentation {
  target: number;
  current: number;
  exclusions: string[];
  reporting: string;
}

export interface AutomationDocumentation {
  framework: string;
  pipeline: string;
  triggers: string[];
  reporting: string;
}

export interface BackupDocumentation {
  strategy: string;
  frequency: string;
  retention: string;
  storage: string;
  recovery: RecoveryDocumentation;
}

export interface RecoveryDocumentation {
  procedures: string[];
  timeframe: string;
  testing: string;
  contacts: string[];
}

export interface ModelUsageDoc {
  quickStart: QuickStartDocumentation;
  tutorials: TutorialDocumentation[];
  apiReference: ApiReferenceDocumentation;
  bestPractices: BestPracticesDocumentation;
  faq: FaqDocumentation[];
}

export interface QuickStartDocumentation {
  overview: string;
  prerequisites: string[];
  installation: string[];
  basicUsage: string[];
  examples: UsageExample[];
  nextSteps: string[];
}

export interface UsageExample {
  title: string;
  description: string;
  code: string;
  explanation: string;
  expectedOutput: string;
  variations?: string[];
}

export interface TutorialDocumentation {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  prerequisites: string[];
  objectives: string[];
  steps: TutorialStep[];
  resources: string[];
}

export interface TutorialStep {
  stepNumber: number;
  title: string;
  description: string;
  code?: string;
  explanation: string;
  expectedResult: string;
  troubleshooting?: string[];
}

export interface ApiReferenceDocumentation {
  endpoints: ApiEndpointDocumentation[];
  authentication: AuthenticationDocumentation;
  errorCodes: ErrorCodeDocumentation[];
  rateLimit: RateLimitDocumentation;
  sdks: SdkDocumentation[];
}

export interface ApiEndpointDocumentation {
  path: string;
  method: string;
  description: string;
  parameters: ParameterDocumentation[];
  requestBody?: RequestBodyDocumentation;
  responses: ResponseDocumentation[];
  examples: ApiExample[];
}

export interface ParameterDocumentation {
  name: string;
  type: string;
  location: 'path' | 'query' | 'header';
  required: boolean;
  description: string;
  format?: string;
  example: any;
}

export interface RequestBodyDocumentation {
  contentType: string;
  schema: string;
  description: string;
  examples: any[];
}

export interface ResponseDocumentation {
  statusCode: number;
  description: string;
  schema?: string;
  examples: any[];
}

export interface ApiExample {
  title: string;
  description: string;
  request: any;
  response: any;
  notes?: string;
}

export interface AuthenticationDocumentation {
  methods: string[];
  description: string;
  examples: any[];
  security: string[];
}

export interface ErrorCodeDocumentation {
  code: string;
  message: string;
  description: string;
  resolution: string[];
  examples: any[];
}

export interface RateLimitDocumentation {
  limits: RateLimitSpec[];
  headers: string[];
  handling: string[];
}

export interface RateLimitSpec {
  endpoint: string;
  limit: number;
  window: string;
  reset: string;
}

export interface SdkDocumentation {
  language: string;
  version: string;
  installation: string;
  usage: string;
  examples: string[];
  repository: string;
}

export interface BestPracticesDocumentation {
  performance: PerformancePractice[];
  security: SecurityPractice[];
  reliability: ReliabilityPractice[];
  maintenance: MaintenancePractice[];
  integration: IntegrationPractice[];
}

export interface PerformancePractice {
  title: string;
  description: string;
  rationale: string;
  implementation: string[];
  metrics: string[];
}

export interface SecurityPractice {
  title: string;
  description: string;
  threats: string[];
  mitigation: string[];
  compliance: string[];
}

export interface ReliabilityPractice {
  title: string;
  description: string;
  risks: string[];
  mitigation: string[];
  monitoring: string[];
}

export interface MaintenancePractice {
  title: string;
  description: string;
  frequency: string;
  procedures: string[];
  automation: string[];
}

export interface IntegrationPractice {
  title: string;
  description: string;
  patterns: string[];
  antipatterns: string[];
  examples: string[];
}

export interface FaqDocumentation {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  relatedQuestions: string[];
  lastUpdated: string;
}

export interface ModelAnnotation {
  id: string;
  type: 'comment' | 'warning' | 'tip' | 'note' | 'todo' | 'review';
  content: string;
  context: {
    section: string;
    elementId?: string;
    elementType?: 'dimension' | 'errorType' | 'formula' | 'validation' | 'general';
    path?: string; // JSONPath to the annotated element
  };
  
  // Metadata
  author?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'deferred';
  tags: string[];
  
  // Linking
  replies: AnnotationReply[];
  relatedAnnotations: string[];
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AnnotationReply {
  id: string;
  content: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelChangeRecord {
  id: string;
  version: string;
  changeType: 'major' | 'minor' | 'patch' | 'documentation';
  
  // Change details
  summary: string;
  description: string;
  impact: 'breaking' | 'non-breaking' | 'enhancement' | 'fix';
  
  // Changed elements
  changes: ElementChange[];
  
  // Migration information
  migration?: MigrationInfo;
  
  // Approval workflow
  approvals: ChangeApproval[];
  status: 'draft' | 'pending' | 'approved' | 'deployed' | 'rolled-back';
  
  // Metadata
  author?: string;
  reviewers: string[];
  tags: string[];
  
  // Audit fields
  createdAt: string;
  approvedAt?: string;
  deployedAt?: string;
}

export interface ElementChange {
  elementType: 'dimension' | 'errorType' | 'formula' | 'validation' | 'config' | 'metadata';
  elementId: string;
  changeOperation: 'create' | 'update' | 'delete' | 'move';
  
  // Change details
  field?: string;
  oldValue?: any;
  newValue?: any;
  
  // Context
  reason: string;
  impact: string;
  testingNotes?: string;
}

export interface MigrationInfo {
  required: boolean;
  description: string;
  steps: string[];
  validation: string[];
  rollback: string[];
  estimatedDuration: string;
  dataBackup: boolean;
}

export interface ChangeApproval {
  approver: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approvedAt?: string;
}

export interface DocumentationExportConfig {
  format: 'html' | 'pdf' | 'markdown' | 'json' | 'docx' | 'confluence' | 'notion';
  sections: DocumentationSection[];
  
  // Formatting options
  includeTableOfContents: boolean;
  includeAnnotations: boolean;
  includeChangeHistory: boolean;
  maxHistoryEntries?: number;
  
  // Export customization
  template?: string;
  styling?: DocumentationStyling;
  metadata?: DocumentationMetadata;
  
  // Access control
  includeInternalNotes: boolean;
  redactSensitiveInfo: boolean;
  
  // Output options
  compression?: 'none' | 'gzip' | 'zip';
  encryption?: boolean;
  watermark?: string;
}

export type DocumentationSection = 
  | 'overview'
  | 'specifications'
  | 'implementation'
  | 'usage'
  | 'annotations'
  | 'changeHistory'
  | 'appendices';

export interface DocumentationStyling {
  theme: 'default' | 'corporate' | 'technical' | 'minimal' | 'custom';
  colorScheme?: string;
  fonts?: {
    heading: string;
    body: string;
    code: string;
  };
  layout?: {
    margins: string;
    pageSize: string;
    orientation: 'portrait' | 'landscape';
  };
  branding?: {
    logo?: string;
    companyName?: string;
    headerText?: string;
    footerText?: string;
  };
}

export interface DocumentationMetadata {
  title?: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  version?: string;
  date?: string;
  classification?: string;
  distribution?: string;
  keywords?: string[];
  abstract?: string;
}

export interface DocumentationExportResult {
  success: boolean;
  format: string;
  size: number;
  url?: string;
  content?: string | Buffer;
  
  // Export metadata
  exportedAt: string;
  sections: DocumentationSection[];
  pageCount?: number;
  wordCount?: number;
  
  // Error information
  errors?: string[];
  warnings?: string[];
  
  // Performance metrics
  generationTime: number;
  compressionRatio?: number;
}

export interface DocumentationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'business' | 'compliance' | 'user' | 'developer';
  
  // Template configuration
  format: string;
  sections: DocumentationSection[];
  styling: DocumentationStyling;
  
  // Content templates
  sectionTemplates: Record<DocumentationSection, string>;
  exampleContent?: Record<string, any>;
  
  // Metadata
  isBuiltIn: boolean;
  usageCount: number;
  rating?: number;
  tags: string[];
  
  // Audit fields
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeManagementIntegration {
  id: string;
  type: 'confluence' | 'notion' | 'sharepoint' | 'wiki' | 'custom';
  name: string;
  
  // Connection details
  endpoint: string;
  authentication: {
    type: 'api_key' | 'oauth' | 'basic' | 'token';
    credentials: Record<string, string>;
  };
  
  // Mapping configuration
  spaceMapping: SpaceMapping[];
  fieldMapping: FieldMapping[];
  
  // Sync settings
  autoSync: boolean;
  syncFrequency?: string;
  syncDirection: 'export_only' | 'import_only' | 'bidirectional';
  
  // Content handling
  conflictResolution: 'overwrite' | 'merge' | 'manual' | 'skip';
  versionHandling: 'create_new' | 'update_existing' | 'branch';
  
  // Audit fields
  lastSync?: string;
  syncStatus: 'active' | 'paused' | 'error' | 'disabled';
  errorLog?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface SpaceMapping {
  localCategory: string;
  remoteSpace: string;
  remoteParent?: string;
  permissions?: string[];
}

export interface FieldMapping {
  localField: string;
  remoteField: string;
  transformation?: string;
  validation?: string;
}

export interface DocumentationAnalytics {
  modelId: string;
  period: {
    start: string;
    end: string;
  };
  
  // Usage metrics
  views: number;
  exports: number;
  annotations: number;
  updates: number;
  
  // Content metrics
  completeness: number; // 0-100
  annotationDensity: number;
  updateFrequency: number;
  
  // Quality metrics
  brokenLinks: number;
  outdatedSections: string[];
  missingContent: string[];
  
  // User engagement
  topSections: Array<{
    section: string;
    views: number;
    duration: number;
  }>;
  
  userActivity: Array<{
    userId: string;
    actions: number;
    lastActive: string;
  }>;
  
  // Trends
  trends: {
    viewsTrend: 'increasing' | 'stable' | 'decreasing';
    qualityTrend: 'improving' | 'stable' | 'declining';
    engagementTrend: 'increasing' | 'stable' | 'decreasing';
  };
  
  // Recommendations
  recommendations: AnalyticsRecommendation[];
}

export interface AnalyticsRecommendation {
  type: 'content' | 'structure' | 'quality' | 'engagement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: string;
} 