import { 
  ReportTemplate, 
  ReportConfiguration, 
  ReportType, 
  ReportSection,
  OutputFormat 
} from '../types/reporting';

/**
 * Predefined Report Templates
 * 
 * Standard report configurations for different stakeholder types and use cases.
 */
export class ReportTemplates {
  /**
   * Comprehensive Scorecard Template
   * Detailed report with all MQM dimensions, suitable for quality managers
   */
  static readonly COMPREHENSIVE_SCORECARD: ReportTemplate = {
    id: 'comprehensive-scorecard',
    name: 'Comprehensive MQM Scorecard',
    description: 'Detailed analysis covering all MQM dimensions with statistical breakdowns and visual charts',
    type: 'comprehensive-scorecard',
    sections: [
      'overview',
      'quality-metrics',
      'error-breakdown',
      'severity-analysis',
      'dimension-analysis',
      'category-analysis',
      'weighting-analysis',
      'statistical-summary',
      'recommendations'
    ],
    defaultConfiguration: {
      type: 'comprehensive-scorecard',
      sections: [
        'overview',
        'quality-metrics', 
        'error-breakdown',
        'severity-analysis',
        'dimension-analysis',
        'category-analysis',
        'weighting-analysis',
        'statistical-summary',
        'recommendations'
      ],
      outputFormat: 'html',
      customization: {
        includeCharts: true,
        includeExamples: true,
        includeRecommendations: true,
        includeStatistics: true,
        detailLevel: 'detailed'
      }
    },
    requiredFields: ['overview', 'summary', 'details'],
    customFields: {
      includeConfidenceIntervals: true,
      showNeutralAnnotations: true,
      chartTheme: 'default'
    }
  };

  /**
   * Executive Dashboard Template
   * High-level summary for executives and stakeholders
   */
  static readonly EXECUTIVE_DASHBOARD: ReportTemplate = {
    id: 'executive-dashboard',
    name: 'Executive Quality Dashboard',
    description: 'High-level quality metrics and KPIs for executive review',
    type: 'executive-dashboard',
    sections: [
      'overview',
      'quality-metrics',
      'recommendations',
      'trends'
    ],
    defaultConfiguration: {
      type: 'executive-dashboard',
      sections: ['overview', 'quality-metrics', 'recommendations', 'trends'],
      outputFormat: 'pdf',
      customization: {
        includeCharts: true,
        includeExamples: false,
        includeRecommendations: true,
        includeStatistics: false,
        detailLevel: 'summary'
      }
    },
    requiredFields: ['overview', 'summary'],
    customFields: {
      executiveSummary: true,
      trendAnalysis: true,
      complianceStatus: true
    }
  };

  /**
   * Project Manager Template
   * Focus on resource allocation and issue prioritization
   */
  static readonly PROJECT_MANAGER: ReportTemplate = {
    id: 'project-manager',
    name: 'Project Manager Report',
    description: 'Issue prioritization, resource allocation guidance, and progress tracking',
    type: 'project-manager',
    sections: [
      'overview',
      'quality-metrics',
      'error-breakdown',
      'recommendations'
    ],
    defaultConfiguration: {
      type: 'project-manager',
      sections: ['overview', 'quality-metrics', 'error-breakdown', 'recommendations'],
      outputFormat: 'html',
      stakeholderView: 'projectManager',
      customization: {
        includeCharts: true,
        includeExamples: false,
        includeRecommendations: true,
        includeStatistics: false,
        detailLevel: 'standard'
      }
    },
    requiredFields: ['overview', 'summary', 'stakeholderViews.projectManager'],
    customFields: {
      resourcePlanning: true,
      timelineEstimates: true,
      priorityMatrix: true
    }
  };

  /**
   * Quality Analyst Template
   * Deep dive into error patterns and linguistic analysis
   */
  static readonly QUALITY_ANALYST: ReportTemplate = {
    id: 'quality-analyst',
    name: 'Quality Analyst Deep Dive',
    description: 'Detailed error pattern analysis and recurring issue identification',
    type: 'quality-analyst',
    sections: [
      'overview',
      'error-breakdown',
      'severity-analysis',
      'dimension-analysis',
      'category-analysis',
      'statistical-summary'
    ],
    defaultConfiguration: {
      type: 'quality-analyst',
      sections: [
        'overview',
        'error-breakdown',
        'severity-analysis',
        'dimension-analysis',
        'category-analysis',
        'statistical-summary'
      ],
      outputFormat: 'html',
      stakeholderView: 'qualityAnalyst',
      customization: {
        includeCharts: true,
        includeExamples: true,
        includeRecommendations: true,
        includeStatistics: true,
        detailLevel: 'detailed'
      }
    },
    requiredFields: ['overview', 'details', 'stakeholderViews.qualityAnalyst'],
    customFields: {
      patternAnalysis: true,
      statisticalTests: true,
      errorCorrelation: true
    }
  };

  /**
   * Linguistic Review Template
   * Focus on language-specific issues and terminology
   */
  static readonly LINGUISTIC_REVIEW: ReportTemplate = {
    id: 'linguistic-review',
    name: 'Linguistic Review Report',
    description: 'Language-specific error analysis and terminology consistency review',
    type: 'linguistic-review',
    sections: [
      'overview',
      'error-breakdown',
      'dimension-analysis',
      'recommendations'
    ],
    defaultConfiguration: {
      type: 'linguistic-review',
      sections: ['overview', 'error-breakdown', 'dimension-analysis', 'recommendations'],
      outputFormat: 'html',
      stakeholderView: 'linguisticReview',
      customization: {
        includeCharts: false,
        includeExamples: true,
        includeRecommendations: true,
        includeStatistics: false,
        detailLevel: 'detailed'
      }
    },
    requiredFields: ['overview', 'details', 'stakeholderViews.linguisticReview'],
    customFields: {
      terminologyCheck: true,
      styleguideCompliance: true,
      languageVarieties: true
    }
  };

  /**
   * Developer Template
   * Technical issues and markup errors
   */
  static readonly DEVELOPER: ReportTemplate = {
    id: 'developer',
    name: 'Developer Technical Report',
    description: 'Technical markup errors and integration point analysis',
    type: 'developer',
    sections: [
      'overview',
      'error-breakdown',
      'recommendations'
    ],
    defaultConfiguration: {
      type: 'developer',
      sections: ['overview', 'error-breakdown', 'recommendations'],
      outputFormat: 'json',
      stakeholderView: 'developer',
      customization: {
        includeCharts: false,
        includeExamples: true,
        includeRecommendations: true,
        includeStatistics: false,
        detailLevel: 'standard'
      }
    },
    requiredFields: ['overview', 'details', 'stakeholderViews.developer'],
    customFields: {
      markupValidation: true,
      automationSuggestions: true,
      integrationPoints: true
    }
  };

  /**
   * Detailed Analysis Template
   * Complete analysis for researchers and quality specialists
   */
  static readonly DETAILED_ANALYSIS: ReportTemplate = {
    id: 'detailed-analysis',
    name: 'Detailed Analysis Report',
    description: 'Complete error inventory and statistical analysis for research purposes',
    type: 'detailed-analysis',
    sections: [
      'overview',
      'quality-metrics',
      'error-breakdown',
      'severity-analysis',
      'dimension-analysis',
      'category-analysis',
      'weighting-analysis',
      'statistical-summary',
      'recommendations',
      'benchmarks'
    ],
    defaultConfiguration: {
      type: 'detailed-analysis',
      sections: [
        'overview',
        'quality-metrics',
        'error-breakdown',
        'severity-analysis',
        'dimension-analysis',
        'category-analysis',
        'weighting-analysis',
        'statistical-summary',
        'recommendations',
        'benchmarks'
      ],
      outputFormat: 'html',
      customization: {
        includeCharts: true,
        includeExamples: true,
        includeRecommendations: true,
        includeStatistics: true,
        detailLevel: 'detailed'
      }
    },
    requiredFields: ['overview', 'summary', 'details'],
    customFields: {
      researchMode: true,
      fullErrorInventory: true,
      benchmarkComparison: true
    }
  };

  /**
   * Get all available templates
   */
  static getAllTemplates(): ReportTemplate[] {
    return [
      this.COMPREHENSIVE_SCORECARD,
      this.EXECUTIVE_DASHBOARD,
      this.PROJECT_MANAGER,
      this.QUALITY_ANALYST,
      this.LINGUISTIC_REVIEW,
      this.DEVELOPER,
      this.DETAILED_ANALYSIS
    ];
  }

  /**
   * Get template by ID
   */
  static getTemplate(id: string): ReportTemplate | undefined {
    const templates = this.getAllTemplates();
    return templates.find(template => template.id === id);
  }

  /**
   * Get templates by type
   */
  static getTemplatesByType(type: ReportType): ReportTemplate[] {
    const templates = this.getAllTemplates();
    return templates.filter(template => template.type === type);
  }

  /**
   * Create custom configuration from template
   */
  static createCustomConfiguration(
    templateId: string,
    overrides?: Partial<ReportConfiguration>
  ): ReportConfiguration | undefined {
    const template = this.getTemplate(templateId);
    if (!template) return undefined;

    return {
      ...template.defaultConfiguration,
      ...overrides
    };
  }

  /**
   * Validate configuration against template requirements
   */
  static validateConfiguration(
    templateId: string,
    config: ReportConfiguration
  ): { valid: boolean; errors: string[] } {
    const template = this.getTemplate(templateId);
    if (!template) {
      return { valid: false, errors: ['Template not found'] };
    }

    const errors: string[] = [];

    // Check required sections
    template.requiredFields.forEach(field => {
      if (!config.sections.includes(field as ReportSection)) {
        errors.push(`Required section '${field}' is missing`);
      }
    });

    // Check output format compatibility
    const supportedFormats: OutputFormat[] = ['json', 'html', 'pdf', 'csv'];
    if (!supportedFormats.includes(config.outputFormat)) {
      errors.push(`Unsupported output format '${config.outputFormat}'`);
    }

    // Check stakeholder view compatibility
    if (config.stakeholderView && 
        template.type !== 'comprehensive-scorecard' && 
        template.type !== 'detailed-analysis' && 
        template.type !== config.stakeholderView.replace(/([A-Z])/g, '-$1').toLowerCase()) {
      errors.push(`Stakeholder view '${config.stakeholderView}' is not compatible with template type '${template.type}'`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get recommended templates for specific use cases
   */
  static getRecommendedTemplates(useCase: 'executive' | 'quality' | 'technical' | 'linguistic' | 'research'): ReportTemplate[] {
    switch (useCase) {
      case 'executive':
        return [this.EXECUTIVE_DASHBOARD, this.COMPREHENSIVE_SCORECARD];
      case 'quality':
        return [this.QUALITY_ANALYST, this.COMPREHENSIVE_SCORECARD, this.DETAILED_ANALYSIS];
      case 'technical':
        return [this.DEVELOPER, this.PROJECT_MANAGER];
      case 'linguistic':
        return [this.LINGUISTIC_REVIEW, this.QUALITY_ANALYST];
      case 'research':
        return [this.DETAILED_ANALYSIS, this.COMPREHENSIVE_SCORECARD];
      default:
        return this.getAllTemplates();
    }
  }
} 