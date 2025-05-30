/**
 * MQM Taxonomy Constants and Predefined Error Definitions
 * Based on MQM 2.0 / ISO DIS 5060:2024 standards
 */

import {
  MQMDimension,
  MQMTerminologyCategory,
  MQMAccuracyCategory,
  MQLinguisticConventionsCategory,
  MQMStyleCategory,
  MQMLocaleConventionsCategory,
  MQMAudienceAppropriatenessCategory,
  MQMDesignAndMarkupCategory,
  MQMSeverity,
  MQMErrorDefinition,
  MQMAssessmentConfig,
  MQMErrorCategory
} from '../types/assessment';

/**
 * Default MQM penalty weights following standard scoring
 */
export const DEFAULT_MQM_PENALTIES = {
  [MQMSeverity.MINOR]: 1,
  [MQMSeverity.MAJOR]: 5,
  [MQMSeverity.CRITICAL]: 10,
  [MQMSeverity.NEUTRAL]: 0
} as const;

/**
 * Default dimension weights (equal weighting)
 */
export const DEFAULT_DIMENSION_WEIGHTS = {
  [MQMDimension.TERMINOLOGY]: 1.0,
  [MQMDimension.ACCURACY]: 1.0,
  [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.0,
  [MQMDimension.STYLE]: 1.0,
  [MQMDimension.LOCALE_CONVENTIONS]: 1.0,
  [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.0,
  [MQMDimension.DESIGN_AND_MARKUP]: 1.0
} as const;

/**
 * MQM Quality Level Thresholds (errors per 100 words)
 */
export const MQM_QUALITY_THRESHOLDS = {
  excellent: 0.5,    // <= 0.5 errors per 100 words
  good: 2.0,         // <= 2.0 errors per 100 words  
  fair: 5.0,         // <= 5.0 errors per 100 words
  poor: 10.0,        // <= 10.0 errors per 100 words
  unacceptable: Infinity // > 10.0 errors per 100 words
} as const;

/**
 * Comprehensive MQM Error Definitions with examples and guidelines
 */
export const MQM_ERROR_DEFINITIONS: Record<string, MQMErrorDefinition> = {
  // TERMINOLOGY ERRORS
  'terminology/inconsistent_use': {
    dimension: MQMDimension.TERMINOLOGY,
    category: MQMTerminologyCategory.INCONSISTENT_USE,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'A source term has been translated in multiple ways within the same text',
    examples: [
      {
        source: 'Download the software application',
        target_incorrect: 'Téléchargez l\'application logicielle... plus tard: Téléchargez le programme informatique',
        target_correct: 'Téléchargez l\'application logicielle... plus tard: Téléchargez l\'application logicielle',
        explanation: 'The term "software application" should be translated consistently throughout the text'
      }
    ],
    guidelines: 'All instances of the same source term should use the same target translation unless contextually inappropriate'
  },
  
  'terminology/wrong_term': {
    dimension: MQMDimension.TERMINOLOGY,
    category: MQMTerminologyCategory.WRONG_TERM,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'A term that violates domain or organization-specific terminology',
    examples: [
      {
        source: 'Click the Save button',
        target_incorrect: 'Cliquez sur le bouton Enregistrer',
        target_correct: 'Cliquez sur le bouton Sauvegarder',
        explanation: 'Organization glossary specifies "Sauvegarder" for "Save" in UI contexts'
      }
    ],
    guidelines: 'Use approved terminology from client glossaries and domain-specific term bases'
  },

  'terminology/inappropriate_for_domain': {
    dimension: MQMDimension.TERMINOLOGY,
    category: MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'A term that is not appropriate for the specific domain or technical field',
    examples: [
      {
        source: 'Memory allocation error',
        target_incorrect: 'Erreur de distribution de mémoire',
        target_correct: 'Erreur d\'allocation mémoire',
        explanation: 'Technical programming terms require precise domain-specific translations'
      }
    ],
    guidelines: 'Use terminology appropriate for the specific domain, field, or technical context'
  },

  // ACCURACY ERRORS
  'accuracy/mistranslation': {
    dimension: MQMDimension.ACCURACY,
    category: MQMAccuracyCategory.MISTRANSLATION,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'The target content does not accurately represent the source content',
    examples: [
      {
        source: 'The meeting is scheduled for next Tuesday',
        target_incorrect: 'La réunion est programmée pour mardi prochain',
        target_correct: 'La réunion est programmée pour mardi prochain',
        explanation: 'This example shows semantic mistranslation of temporal reference'
      }
    ],
    guidelines: 'Ensure target text conveys the same meaning and information as the source'
  },

  'accuracy/omission': {
    dimension: MQMDimension.ACCURACY,
    category: MQMAccuracyCategory.OMISSION,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'Content from the source text is missing in the target text',
    examples: [
      {
        source: 'Please save your work before closing the application',
        target_incorrect: 'Veuillez fermer l\'application',
        target_correct: 'Veuillez sauvegarder votre travail avant de fermer l\'application',
        explanation: 'Critical instruction about saving work was omitted'
      }
    ],
    guidelines: 'All source content must be represented in the target unless marked as "do not translate"'
  },

  'accuracy/addition': {
    dimension: MQMDimension.ACCURACY,
    category: MQMAccuracyCategory.ADDITION,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'Content that is not present in the source text appears in the target text',
    examples: [
      {
        source: 'Welcome to our website',
        target_incorrect: 'Bienvenue sur notre site web officiel',
        target_correct: 'Bienvenue sur notre site web',
        explanation: 'The word "officiel" (official) was added without source justification'
      }
    ],
    guidelines: 'Do not add content that is not present in or implied by the source text'
  },

  'accuracy/untranslated': {
    dimension: MQMDimension.ACCURACY,
    category: MQMAccuracyCategory.UNTRANSLATED,
    severity: MQMSeverity.CRITICAL,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.CRITICAL],
    description: 'Content that should have been translated has been left in the source language',
    examples: [
      {
        source: 'Please enter your password',
        target_incorrect: 'Please enter votre mot de passe',
        target_correct: 'Veuillez saisir votre mot de passe',
        explanation: 'The phrase "Please enter" was left untranslated'
      }
    ],
    guidelines: 'All translatable content must be translated unless specifically marked otherwise'
  },

  // LINGUISTIC CONVENTIONS ERRORS
  'linguistic_conventions/grammar': {
    dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
    category: MQLinguisticConventionsCategory.GRAMMAR,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'Issues related to the grammar of the target language',
    examples: [
      {
        source: 'The users are active',
        target_incorrect: 'Les utilisateur sont actifs',
        target_correct: 'Les utilisateurs sont actifs',
        explanation: 'Missing plural form agreement between article and noun'
      }
    ],
    guidelines: 'Follow target language grammar rules including agreement, tense, mood, and aspect'
  },

  'linguistic_conventions/spelling': {
    dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
    category: MQLinguisticConventionsCategory.SPELLING,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'Issues related to spelling in the target language',
    examples: [
      {
        source: 'Configuration settings',
        target_incorrect: 'Paramètres de configuation',
        target_correct: 'Paramètres de configuration',
        explanation: 'Misspelling of "configuration" with missing "r"'
      }
    ],
    guidelines: 'Use correct spelling according to target language standards and locale preferences'
  },

  'linguistic_conventions/punctuation': {
    dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
    category: MQLinguisticConventionsCategory.PUNCTUATION,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'Issues related to punctuation in the target language',
    examples: [
      {
        source: 'Hello, how are you?',
        target_incorrect: 'Bonjour,comment allez-vous?',
        target_correct: 'Bonjour, comment allez-vous ?',
        explanation: 'Missing space after comma and incorrect spacing before question mark in French'
      }
    ],
    guidelines: 'Follow target language and locale-specific punctuation conventions'
  },

  // STYLE ERRORS
  'style/awkward': {
    dimension: MQMDimension.STYLE,
    category: MQMStyleCategory.AWKWARD,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'The target text sounds unnatural or awkward, though technically correct',
    examples: [
      {
        source: 'User-friendly interface',
        target_incorrect: 'Interface amicale pour utilisateur',
        target_correct: 'Interface conviviale',
        explanation: 'The literal translation sounds awkward in French'
      }
    ],
    guidelines: 'Ensure target text sounds natural and fluent to native speakers'
  },

  'style/unnatural': {
    dimension: MQMDimension.STYLE,
    category: MQMStyleCategory.UNNATURAL,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'The target text does not conform to natural patterns of the target language',
    examples: [
      {
        source: 'Download completed successfully',
        target_incorrect: 'Téléchargement complété avec succès',
        target_correct: 'Téléchargement terminé avec succès',
        explanation: 'Anglicism - "complété" is not natural French for "completed"'
      }
    ],
    guidelines: 'Use natural target language expressions rather than literal translations'
  },

  // LOCALE CONVENTIONS ERRORS  
  'locale_conventions/date_time': {
    dimension: MQMDimension.LOCALE_CONVENTIONS,
    category: MQMLocaleConventionsCategory.DATE_TIME,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'Issues with date, time, or timezone formatting according to target locale',
    examples: [
      {
        source: '03/15/2024',
        target_incorrect: '03/15/2024',
        target_correct: '15/03/2024',
        explanation: 'US date format (MM/DD/YYYY) should be localized to European format (DD/MM/YYYY)'
      }
    ],
    guidelines: 'Use target locale conventions for date, time, and timezone formatting'
  },

  'locale_conventions/currency': {
    dimension: MQMDimension.LOCALE_CONVENTIONS,
    category: MQMLocaleConventionsCategory.CURRENCY,
    severity: MQMSeverity.MINOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MINOR],
    description: 'Issues with currency formatting, symbols, or amounts according to target locale',
    examples: [
      {
        source: '$19.99',
        target_incorrect: '$19.99',
        target_correct: '19,99 €',
        explanation: 'Currency should be converted and formatted for European locale'
      }
    ],
    guidelines: 'Use appropriate currency symbols, formatting, and potentially conversion for target locale'
  },

  // AUDIENCE APPROPRIATENESS ERRORS
  'audience_appropriateness/inappropriate_style': {
    dimension: MQMDimension.AUDIENCE_APPROPRIATENESS,
    category: MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'The style is not appropriate for the intended audience or context',
    examples: [
      {
        source: 'Click here to proceed',
        target_incorrect: 'Clique ici pour continuer',
        target_correct: 'Cliquez ici pour continuer',
        explanation: 'Informal "tu" form used in formal business context requiring "vous" form'
      }
    ],
    guidelines: 'Match the appropriate formality level and style for the target audience'
  },

  // DESIGN AND MARKUP ERRORS
  'design_and_markup/markup': {
    dimension: MQMDimension.DESIGN_AND_MARKUP,
    category: MQMDesignAndMarkupCategory.MARKUP,
    severity: MQMSeverity.MAJOR,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.MAJOR],
    description: 'Issues with markup, tags, or formatting codes in the target text',
    examples: [
      {
        source: 'Click <b>Save</b> to continue',
        target_incorrect: 'Cliquez <b>Sauvegarder pour continuer',
        target_correct: 'Cliquez sur <b>Sauvegarder</b> pour continuer',
        explanation: 'Missing closing tag and incorrect tag placement'
      }
    ],
    guidelines: 'Preserve all markup and formatting while ensuring proper syntax and placement'
  },

  'design_and_markup/truncation': {
    dimension: MQMDimension.DESIGN_AND_MARKUP,
    category: MQMDesignAndMarkupCategory.TRUNCATION,
    severity: MQMSeverity.CRITICAL,
    penalty: DEFAULT_MQM_PENALTIES[MQMSeverity.CRITICAL],
    description: 'Text is cut off or truncated in a way that affects meaning or usability',
    examples: [
      {
        source: 'Configuration Settings',
        target_incorrect: 'Paramètres de confi...',
        target_correct: 'Paramètres de configuration',
        explanation: 'Text truncated in UI context making it unclear'
      }
    ],
    guidelines: 'Ensure all text fits properly in allocated space without truncation'
  }
};

/**
 * Mapping of dimensions to their allowed categories
 */
export const DIMENSION_CATEGORIES: Record<MQMDimension, MQMErrorCategory[]> = {
  [MQMDimension.TERMINOLOGY]: [
    MQMTerminologyCategory.INCONSISTENT_USE,
    MQMTerminologyCategory.WRONG_TERM,
    MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN
  ],
  [MQMDimension.ACCURACY]: [
    MQMAccuracyCategory.MISTRANSLATION,
    MQMAccuracyCategory.OMISSION,
    MQMAccuracyCategory.ADDITION,
    MQMAccuracyCategory.UNTRANSLATED,
    MQMAccuracyCategory.DO_NOT_TRANSLATE_MISTRANSLATED
  ],
  [MQMDimension.LINGUISTIC_CONVENTIONS]: [
    MQLinguisticConventionsCategory.GRAMMAR,
    MQLinguisticConventionsCategory.SPELLING,
    MQLinguisticConventionsCategory.PUNCTUATION,
    MQLinguisticConventionsCategory.CAPITALIZATION,
    MQLinguisticConventionsCategory.WORD_ORDER,
    MQLinguisticConventionsCategory.FUNCTION_WORDS,
    MQLinguisticConventionsCategory.TENSE_MOOD_ASPECT,
    MQLinguisticConventionsCategory.AGREEMENT,
    MQLinguisticConventionsCategory.WORD_FORM,
    MQLinguisticConventionsCategory.PART_OF_SPEECH
  ],
  [MQMDimension.STYLE]: [
    MQMStyleCategory.AWKWARD,
    MQMStyleCategory.UNNATURAL,
    MQMStyleCategory.INCONSISTENT,
    MQMStyleCategory.UNCLEAR
  ],
  [MQMDimension.LOCALE_CONVENTIONS]: [
    MQMLocaleConventionsCategory.DATE_TIME,
    MQMLocaleConventionsCategory.CURRENCY,
    MQMLocaleConventionsCategory.ADDRESS,
    MQMLocaleConventionsCategory.TELEPHONE,
    MQMLocaleConventionsCategory.NAME,
    MQMLocaleConventionsCategory.SORTING,
    MQMLocaleConventionsCategory.MEASUREMENT
  ],
  [MQMDimension.AUDIENCE_APPROPRIATENESS]: [
    MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE,
    MQMAudienceAppropriatenessCategory.INAPPROPRIATE_VARIETY,
    MQMAudienceAppropriatenessCategory.INAPPROPRIATE_REGISTER
  ],
  [MQMDimension.DESIGN_AND_MARKUP]: [
    MQMDesignAndMarkupCategory.CHARACTER_ENCODING,
    MQMDesignAndMarkupCategory.MARKUP,
    MQMDesignAndMarkupCategory.MISSING_TEXT,
    MQMDesignAndMarkupCategory.WHITESPACE,
    MQMDesignAndMarkupCategory.TRUNCATION,
    MQMDesignAndMarkupCategory.OVERLAP
  ]
};

/**
 * Default MQM Assessment Configuration
 */
export const DEFAULT_MQM_CONFIG: MQMAssessmentConfig = {
  scoring_unit: 'words',
  unit_count: 100, // per 100 words
  severity_weights: DEFAULT_MQM_PENALTIES,
  dimension_weights: DEFAULT_DIMENSION_WEIGHTS,
  quality_threshold: MQM_QUALITY_THRESHOLDS.good,
  enabled_dimensions: Object.values(MQMDimension),
  show_neutral_annotations: false,
  aggregate_by_dimension: true,
  include_confidence_intervals: false
};

/**
 * Helper function to get error definition key
 */
export function getMQMErrorKey(dimension: MQMDimension, category: MQMErrorCategory): string {
  return `${dimension}/${category}`;
}

/**
 * Helper function to get all error definitions for a dimension
 */
export function getErrorDefinitionsForDimension(dimension: MQMDimension): MQMErrorDefinition[] {
  return Object.entries(MQM_ERROR_DEFINITIONS)
    .filter(([key]) => key.startsWith(dimension))
    .map(([, definition]) => definition);
}

/**
 * Helper function to validate if a category belongs to a dimension
 */
export function isValidCategoryForDimension(dimension: MQMDimension, category: MQMErrorCategory): boolean {
  return DIMENSION_CATEGORIES[dimension].includes(category);
} 