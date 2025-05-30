/**
 * MQM Severity Classification System
 * Provides standardized rules and guidelines for consistent severity assignment
 */

import {
  MQMDimension,
  MQMSeverity,
  MQMErrorCategory,
  MQMErrorInstance,
  MQMTerminologyCategory,
  MQMAccuracyCategory,
  MQLinguisticConventionsCategory,
  MQMStyleCategory,
  MQMLocaleConventionsCategory,
  MQMAudienceAppropriatenessCategory,
  MQMDesignAndMarkupCategory
} from '../types/assessment';

/**
 * Severity Classification Criteria
 * Defines the impact levels and assessment guidelines for each severity
 */
export interface SeverityClassificationCriteria {
  severity: MQMSeverity;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  user_experience_impact: string;
  functional_impact: string;
  business_impact: string;
  assessment_guidelines: string[];
  typical_examples: string[];
}

/**
 * Comprehensive severity classification rules
 */
export const SEVERITY_CLASSIFICATION_RULES: Record<MQMSeverity, SeverityClassificationCriteria> = {
  [MQMSeverity.NEUTRAL]: {
    severity: MQMSeverity.NEUTRAL,
    impact_level: 'low',
    user_experience_impact: 'No negative impact; may even improve user experience',
    functional_impact: 'No functional impact; content remains fully usable',
    business_impact: 'No business impact; may add positive value',
    assessment_guidelines: [
      'Use for positive annotations or improvements over source',
      'Apply when translation is better than literal source content',
      'Mark when localization adds appropriate cultural context',
      'Use for creative adaptations that enhance target audience appeal'
    ],
    typical_examples: [
      'Creative adaptation that improves clarity',
      'Cultural localization that enhances user understanding',
      'Style improvements over awkward source text',
      'Appropriate additions for target market context'
    ]
  },

  [MQMSeverity.MINOR]: {
    severity: MQMSeverity.MINOR,
    impact_level: 'low',
    user_experience_impact: 'Slightly reduces quality but does not impede understanding',
    functional_impact: 'Content remains fully functional and comprehensible',
    business_impact: 'Minimal business impact; affects perception but not functionality',
    assessment_guidelines: [
      'Content meaning is preserved and clear',
      'Users can complete intended tasks without confusion',
      'Error does not mislead or create ambiguity',
      'Localization conventions may be suboptimal but acceptable',
      'Style preferences rather than critical requirements'
    ],
    typical_examples: [
      'Minor spelling or punctuation errors',
      'Slightly awkward but understandable phrasing',
      'Minor inconsistencies in terminology that don\'t affect meaning',
      'Formatting issues that don\'t impact readability',
      'Minor locale convention deviations (e.g., date format preferences)'
    ]
  },

  [MQMSeverity.MAJOR]: {
    severity: MQMSeverity.MAJOR,
    impact_level: 'medium',
    user_experience_impact: 'Significantly reduces quality and may cause confusion',
    functional_impact: 'Content may be misleading or difficult to understand',
    business_impact: 'Notable business impact; affects user trust and task completion',
    assessment_guidelines: [
      'Error affects comprehension or creates ambiguity',
      'Users may struggle to complete intended tasks',
      'Content could mislead users about important information',
      'Terminology violations affect domain understanding',
      'Inconsistencies that create user confusion'
    ],
    typical_examples: [
      'Incorrect terminology in specialized domains',
      'Mistranslations that change meaning but don\'t cause harm',
      'Grammar errors that affect comprehension',
      'Inconsistent translations of key terms',
      'Inappropriate style for target audience'
    ]
  },

  [MQMSeverity.CRITICAL]: {
    severity: MQMSeverity.CRITICAL,
    impact_level: 'critical',
    user_experience_impact: 'Severely compromises user experience and understanding',
    functional_impact: 'Content is misleading, harmful, or completely unusable',
    business_impact: 'Serious business impact; potential legal, safety, or financial consequences',
    assessment_guidelines: [
      'Error creates safety risks or legal liability',
      'Content is completely incomprehensible or misleading',
      'Users cannot complete critical tasks',
      'Information is factually incorrect in harmful ways',
      'Essential content is missing or untranslated'
    ],
    typical_examples: [
      'Safety instructions that are incorrect or missing',
      'Financial information that is wrong or misleading',
      'Legal text that changes obligations or rights',
      'Medical information that could cause harm',
      'Essential UI elements that are untranslated or unusable'
    ]
  }
};

/**
 * Dimension-specific severity guidelines
 * Provides specific criteria for severity assignment by error dimension
 */
export const DIMENSION_SEVERITY_GUIDELINES: Record<MQMDimension, {
  critical_triggers: string[];
  major_triggers: string[];
  minor_triggers: string[];
  neutral_opportunities: string[];
}> = {
  [MQMDimension.TERMINOLOGY]: {
    critical_triggers: [
      'Safety-critical terminology is incorrect',
      'Legal terminology changes legal meaning',
      'Medical terminology could cause harm',
      'Technical terminology in safety contexts'
    ],
    major_triggers: [
      'Domain-specific terms are consistently wrong',
      'Key product terminology is incorrect',
      'Technical terms affect functionality understanding',
      'Brand terminology is misrepresented'
    ],
    minor_triggers: [
      'Minor inconsistencies in non-critical terms',
      'Preference-based terminology choices',
      'Style variations in equivalent terms'
    ],
    neutral_opportunities: [
      'Improvements over source terminology',
      'Better localization of brand terms',
      'Enhanced clarity through term choices'
    ]
  },

  [MQMDimension.ACCURACY]: {
    critical_triggers: [
      'Information is factually wrong with harmful consequences',
      'Essential content is completely missing',
      'Instructions could cause safety risks',
      'Financial or legal information is incorrect'
    ],
    major_triggers: [
      'Content meaning is significantly changed',
      'Important information is omitted',
      'Instructions are unclear or wrong',
      'Context changes task completion ability'
    ],
    minor_triggers: [
      'Minor details are omitted without impact',
      'Slight meaning shifts that don\'t affect function',
      'Non-essential additions that don\'t mislead'
    ],
    neutral_opportunities: [
      'Clarifications that improve understanding',
      'Cultural adaptations that enhance meaning',
      'Contextual improvements for target audience'
    ]
  },

  [MQMDimension.LINGUISTIC_CONVENTIONS]: {
    critical_triggers: [
      'Grammar errors make content incomprehensible',
      'Spelling errors in safety or legal contexts',
      'Punctuation changes meaning dangerously'
    ],
    major_triggers: [
      'Grammar significantly affects comprehension',
      'Spelling errors in professional contexts',
      'Punctuation changes intended meaning'
    ],
    minor_triggers: [
      'Minor grammar issues that don\'t affect meaning',
      'Spelling variations or typos in non-critical content',
      'Minor punctuation preferences'
    ],
    neutral_opportunities: [
      'Grammar improvements over source',
      'Style enhancements that improve flow',
      'Regional preference adaptations'
    ]
  },

  [MQMDimension.STYLE]: {
    critical_triggers: [
      'Style makes content offensive or harmful',
      'Register completely inappropriate for critical context',
      'Tone could cause legal or business harm'
    ],
    major_triggers: [
      'Style significantly inappropriate for audience',
      'Register mismatch affects user trust',
      'Tone affects brand perception negatively'
    ],
    minor_triggers: [
      'Slightly awkward but acceptable phrasing',
      'Minor style inconsistencies',
      'Preference-based style choices'
    ],
    neutral_opportunities: [
      'Style improvements that enhance appeal',
      'Better audience targeting through style',
      'Enhanced brand voice representation'
    ]
  },

  [MQMDimension.LOCALE_CONVENTIONS]: {
    critical_triggers: [
      'Date/time format errors in time-sensitive contexts',
      'Currency errors in financial transactions',
      'Address format errors affecting delivery'
    ],
    major_triggers: [
      'Format errors that confuse users significantly',
      'Measurement errors affecting understanding',
      'Cultural conventions that affect usability'
    ],
    minor_triggers: [
      'Minor format preference deviations',
      'Non-critical measurement variations',
      'Style preference variations'
    ],
    neutral_opportunities: [
      'Better localization than source requires',
      'Enhanced cultural adaptation',
      'Improved user experience through localization'
    ]
  },

  [MQMDimension.AUDIENCE_APPROPRIATENESS]: {
    critical_triggers: [
      'Content inappropriate for protected audiences (children)',
      'Register causes offense or legal issues',
      'Cultural inappropriateness causes harm'
    ],
    major_triggers: [
      'Audience mismatch affects task completion',
      'Register significantly inappropriate',
      'Cultural issues affect user acceptance'
    ],
    minor_triggers: [
      'Minor audience preference variations',
      'Slight register inconsistencies',
      'Minor cultural adaptation opportunities'
    ],
    neutral_opportunities: [
      'Better audience targeting than source',
      'Enhanced cultural sensitivity',
      'Improved accessibility for target users'
    ]
  },

  [MQMDimension.DESIGN_AND_MARKUP]: {
    critical_triggers: [
      'Markup errors break functionality',
      'Text truncation hides critical information',
      'Encoding issues make content unreadable'
    ],
    major_triggers: [
      'Markup errors affect display significantly',
      'Formatting issues impede usability',
      'Truncation affects important content'
    ],
    minor_triggers: [
      'Minor formatting inconsistencies',
      'Non-critical whitespace issues',
      'Minor display variations'
    ],
    neutral_opportunities: [
      'Markup improvements for better display',
      'Enhanced formatting for readability',
      'Better responsive design adaptation'
    ]
  }
};

/**
 * Context-based severity modifiers
 * Adjusts severity based on content context and criticality
 */
export interface ContextSeverityModifier {
  context_type: string;
  description: string;
  severity_adjustment: 'upgrade' | 'downgrade' | 'maintain';
  conditions: string[];
}

export const CONTEXT_SEVERITY_MODIFIERS: ContextSeverityModifier[] = [
  {
    context_type: 'safety_critical',
    description: 'Content related to safety, health, or potential harm',
    severity_adjustment: 'upgrade',
    conditions: [
      'Medical instructions or information',
      'Safety warnings or procedures',
      'Emergency response content',
      'Chemical or product safety data'
    ]
  },
  {
    context_type: 'legal_regulatory',
    description: 'Content with legal or regulatory implications',
    severity_adjustment: 'upgrade',
    conditions: [
      'Terms of service or legal agreements',
      'Regulatory compliance information',
      'Privacy policies',
      'Financial regulatory content'
    ]
  },
  {
    context_type: 'financial_transactional',
    description: 'Content involving financial transactions or data',
    severity_adjustment: 'upgrade',
    conditions: [
      'Payment processing information',
      'Financial calculations or data',
      'Investment or financial advice',
      'Pricing or cost information'
    ]
  },
  {
    context_type: 'ui_critical_path',
    description: 'Content in critical user interface elements',
    severity_adjustment: 'upgrade',
    conditions: [
      'Primary navigation elements',
      'Call-to-action buttons',
      'Form labels and instructions',
      'Error messages and notifications'
    ]
  },
  {
    context_type: 'marketing_promotional',
    description: 'Marketing or promotional content',
    severity_adjustment: 'downgrade',
    conditions: [
      'Marketing copy and slogans',
      'Promotional descriptions',
      'Social media content',
      'General marketing materials'
    ]
  },
  {
    context_type: 'decorative_supplementary',
    description: 'Decorative or supplementary content',
    severity_adjustment: 'downgrade',
    conditions: [
      'Image alt text for decorative images',
      'Supplementary explanations',
      'Optional additional information',
      'Aesthetic or decorative text'
    ]
  }
];

/**
 * Severity Classification Engine
 * Main class for automated and assisted severity classification
 */
export class MQMSeverityClassifier {
  /**
   * Suggests severity level based on error characteristics
   */
  static suggestSeverity(
    dimension: MQMDimension,
    category: MQMErrorCategory,
    context: {
      content_type?: string;
      user_impact?: 'low' | 'medium' | 'high' | 'critical';
      domain?: string;
      criticality?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): {
    suggested_severity: MQMSeverity;
    confidence: number;
    reasoning: string[];
    alternative_severities: MQMSeverity[];
  } {
    const guidelines = DIMENSION_SEVERITY_GUIDELINES[dimension];
    const reasoning: string[] = [];
    let suggested_severity: MQMSeverity = MQMSeverity.MINOR;
    let confidence = 0.7; // Default confidence

    // Check for critical context
    if (this.isCriticalContext(context)) {
      suggested_severity = MQMSeverity.CRITICAL;
      confidence = 0.9;
      reasoning.push('Critical context detected - safety, legal, or financial impact');
    }
    // Check category-specific rules
    else if (this.isCriticalCategory(dimension, category)) {
      suggested_severity = MQMSeverity.CRITICAL;
      confidence = 0.85;
      reasoning.push('Error category typically requires critical severity');
    }
    // Check for major impact indicators
    else if (context.user_impact === 'high' || context.criticality === 'high') {
      suggested_severity = MQMSeverity.MAJOR;
      confidence = 0.8;
      reasoning.push('High user impact or content criticality indicated');
    }
    // Default to minor for most cases
    else {
      suggested_severity = MQMSeverity.MINOR;
      confidence = 0.7;
      reasoning.push('Standard severity assignment for error type');
    }

    // Apply context modifiers
    const modifier = this.getContextModifier(context);
    if (modifier) {
      if (modifier.severity_adjustment === 'upgrade') {
        suggested_severity = this.upgradeSeverity(suggested_severity);
        reasoning.push(`Severity upgraded due to ${modifier.context_type} context`);
      } else if (modifier.severity_adjustment === 'downgrade') {
        suggested_severity = this.downgradeSeverity(suggested_severity);
        reasoning.push(`Severity downgraded due to ${modifier.context_type} context`);
      }
    }

    // Generate alternative severities
    const alternative_severities = this.getAlternativeSeverities(suggested_severity);

    return {
      suggested_severity,
      confidence,
      reasoning,
      alternative_severities
    };
  }

  /**
   * Validates severity assignment based on classification rules
   */
  static validateSeverityAssignment(
    severity: MQMSeverity,
    dimension: MQMDimension,
    category: MQMErrorCategory,
    description: string,
    context: any = {}
  ): {
    is_valid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let is_valid = true;

    const criteria = SEVERITY_CLASSIFICATION_RULES[severity];
    const guidelines = DIMENSION_SEVERITY_GUIDELINES[dimension];

    // Check for severity-context mismatches
    if (severity === MQMSeverity.CRITICAL && !this.isCriticalContext(context)) {
      if (!this.isCriticalCategory(dimension, category)) {
        warnings.push('Critical severity assigned without critical context indicators');
        suggestions.push('Consider if this error truly has critical business or safety impact');
      }
    }

    if (severity === MQMSeverity.MINOR && this.isCriticalContext(context)) {
      warnings.push('Minor severity assigned in critical context');
      suggestions.push('Consider upgrading severity due to critical context');
      is_valid = false;
    }

    // Check for common misclassifications by category
    if (this.isTypicallyMajorCategory(dimension, category) && severity === MQMSeverity.MINOR) {
      warnings.push('Category typically requires higher severity');
      suggestions.push('Review if error significantly affects user understanding');
    }

    return { is_valid, warnings, suggestions };
  }

  /**
   * Gets assessment guidelines for a specific severity level
   */
  static getAssessmentGuidelines(severity: MQMSeverity): SeverityClassificationCriteria {
    return SEVERITY_CLASSIFICATION_RULES[severity];
  }

  /**
   * Gets dimension-specific guidelines
   */
  static getDimensionGuidelines(dimension: MQMDimension) {
    return DIMENSION_SEVERITY_GUIDELINES[dimension];
  }

  // Private helper methods
  private static isCriticalContext(context: any): boolean {
    const criticalTypes = ['safety_critical', 'legal_regulatory', 'financial_transactional'];
    return criticalTypes.includes(context.content_type) ||
           context.criticality === 'critical' ||
           context.user_impact === 'critical';
  }

  private static isCriticalCategory(dimension: MQMDimension, category: MQMErrorCategory): boolean {
    const criticalCategories = [
      'untranslated', 'mistranslation', 'omission', 'markup', 'truncation'
    ];
    return criticalCategories.includes(category as string);
  }

  private static isTypicallyMajorCategory(dimension: MQMDimension, category: MQMErrorCategory): boolean {
    const majorCategories = [
      'wrong_term', 'inappropriate_for_domain', 'mistranslation', 'addition',
      'inappropriate_style', 'markup'
    ];
    return majorCategories.includes(category as string);
  }

  private static getContextModifier(context: any): ContextSeverityModifier | null {
    return CONTEXT_SEVERITY_MODIFIERS.find(modifier => 
      modifier.context_type === context.content_type
    ) || null;
  }

  private static upgradeSeverity(severity: MQMSeverity): MQMSeverity {
    const hierarchy = [MQMSeverity.NEUTRAL, MQMSeverity.MINOR, MQMSeverity.MAJOR, MQMSeverity.CRITICAL];
    const index = hierarchy.indexOf(severity);
    return index < hierarchy.length - 1 ? hierarchy[index + 1] : severity;
  }

  private static downgradeSeverity(severity: MQMSeverity): MQMSeverity {
    const hierarchy = [MQMSeverity.NEUTRAL, MQMSeverity.MINOR, MQMSeverity.MAJOR, MQMSeverity.CRITICAL];
    const index = hierarchy.indexOf(severity);
    return index > 0 ? hierarchy[index - 1] : severity;
  }

  private static getAlternativeSeverities(severity: MQMSeverity): MQMSeverity[] {
    const all = [MQMSeverity.NEUTRAL, MQMSeverity.MINOR, MQMSeverity.MAJOR, MQMSeverity.CRITICAL];
    return all.filter(s => s !== severity);
  }
}

/**
 * Severity Training Data
 * Examples for training evaluators on consistent severity assignment
 */
export const SEVERITY_TRAINING_EXAMPLES = {
  [MQMSeverity.CRITICAL]: [
    {
      error: 'Safety warning "Do not touch" translated as "Touch freely"',
      dimension: MQMDimension.ACCURACY,
      reasoning: 'Reverses safety instruction, creating potential harm'
    },
    {
      error: 'Legal agreement term "optional" translated as "mandatory"',
      dimension: MQMDimension.TERMINOLOGY,
      reasoning: 'Changes legal obligations and rights'
    },
    {
      error: 'Essential navigation button left untranslated',
      dimension: MQMDimension.ACCURACY,
      reasoning: 'Blocks critical user task completion'
    }
  ],
  [MQMSeverity.MAJOR]: [
    {
      error: 'Technical term "memory allocation" translated as "memory distribution"',
      dimension: MQMDimension.TERMINOLOGY,
      reasoning: 'Incorrect technical terminology affects understanding'
    },
    {
      error: 'Product feature description contains significant inaccuracy',
      dimension: MQMDimension.ACCURACY,
      reasoning: 'Misleads users about product capabilities'
    },
    {
      error: 'Formal UI using informal "tu" instead of formal "vous"',
      dimension: MQMDimension.AUDIENCE_APPROPRIATENESS,
      reasoning: 'Inappropriate register for business context'
    }
  ],
  [MQMSeverity.MINOR]: [
    {
      error: 'Minor spelling error in marketing text',
      dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
      reasoning: 'Reduces quality but doesn\'t affect function'
    },
    {
      error: 'Slightly awkward phrasing that remains clear',
      dimension: MQMDimension.STYLE,
      reasoning: 'Suboptimal style but meaning preserved'
    },
    {
      error: 'Inconsistent date format in non-critical context',
      dimension: MQMDimension.LOCALE_CONVENTIONS,
      reasoning: 'Preference deviation without functional impact'
    }
  ],
  [MQMSeverity.NEUTRAL]: [
    {
      error: 'Cultural adaptation improves local appeal',
      dimension: MQMDimension.AUDIENCE_APPROPRIATENESS,
      reasoning: 'Enhancement over literal source translation'
    },
    {
      error: 'Style improvement that enhances readability',
      dimension: MQMDimension.STYLE,
      reasoning: 'Positive deviation that benefits target audience'
    }
  ]
}; 