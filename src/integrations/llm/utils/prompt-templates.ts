// Prompt Templates for Quality Assessment and Linguistic Analysis

import { PromptTemplate } from '../types/llm-types';

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Quality Assessment Templates
    this.addTemplate({
      id: 'quality_assessment_comprehensive',
      name: 'Comprehensive Quality Assessment',
      description: 'Complete quality assessment comparing source and target text',
      category: 'quality_assessment',
      version: '1.0',
      variables: ['sourceText', 'targetText', 'context', 'framework', 'sourceLanguage', 'targetLanguage'],
      template: `You are an expert linguistic quality assessor. Analyze the translation quality of the provided text pair using professional assessment criteria.

SOURCE TEXT ({{sourceLanguage}}):
{{sourceText}}

TARGET TEXT ({{targetLanguage}}):
{{targetText}}

{{#if context}}
CONTEXT:
{{context}}
{{/if}}

{{#if framework}}
ASSESSMENT FRAMEWORK: {{framework}}
{{/if}}

Please provide a comprehensive quality assessment with the following structure:

## OVERALL SCORES (0-100)
- Overall Quality Score: [score]
- Fluency Score: [score] 
- Adequacy Score: [score]
- Confidence Level: [score]

## DETAILED ANALYSIS

### FLUENCY ASSESSMENT
Evaluate how natural and readable the target text sounds to a native speaker:
- Grammar and syntax correctness
- Natural word order and phrasing
- Appropriate register and style
- Readability and flow

### ADEQUACY ASSESSMENT  
Evaluate how completely the meaning is transferred from source to target:
- Completeness of meaning transfer
- Accuracy of concepts and facts
- Preservation of intended message
- No additions or omissions

### ERROR ANALYSIS
For each error found, provide:
- Error Type: [grammar/lexical/style/omission/addition/mistranslation]
- Severity: [minor/major/critical]
- Description: [detailed explanation]
- Suggestion: [recommended correction]
- Confidence: [0-100]

### TERMINOLOGY ANALYSIS
- Consistency of terminology usage
- Appropriateness of technical terms
- Domain-specific accuracy
- Style guide adherence

### LINGUISTIC QUALITY METRICS
- Word count comparison
- Sentence structure preservation
- Cultural adaptation appropriateness
- Register consistency

## SUGGESTIONS FOR IMPROVEMENT
Provide specific, actionable recommendations for enhancing translation quality.

## ASSESSMENT REASONING
Explain your scoring rationale and key factors that influenced the assessment.

Format your response as valid JSON with this structure:
{
  "overallScore": number,
  "fluencyScore": number, 
  "adequacyScore": number,
  "confidence": number,
  "errors": [
    {
      "type": "string",
      "severity": "minor|major|critical",
      "description": "string",
      "suggestion": "string",
      "position": {"start": number, "end": number},
      "confidence": number
    }
  ],
  "suggestions": [
    {
      "type": "string",
      "text": "string",
      "confidence": number,
      "reasoning": "string"
    }
  ],
  "metrics": {
    "wordCount": number,
    "characterCount": number,
    "consistencyScore": number,
    "terminologyAdherence": number
  },
  "reasoning": "string"
}`
    });

    this.addTemplate({
      id: 'fluency_assessment',
      name: 'Fluency Assessment',
      description: 'Focused fluency evaluation for target text',
      category: 'linguistic_analysis',
      version: '1.0',
      variables: ['targetText', 'language', 'context'],
      template: `Evaluate the fluency of this {{language}} text. Focus on how natural and readable it sounds to a native speaker.

TEXT TO ANALYZE:
{{targetText}}

{{#if context}}
CONTEXT:
{{context}}
{{/if}}

Assess the following aspects:

1. GRAMMAR AND SYNTAX
- Sentence structure correctness
- Verb tenses and agreements
- Article and preposition usage
- Punctuation appropriateness

2. NATURALNESS
- Word choice and collocation
- Idiomatic expressions usage
- Register appropriateness
- Cultural naturalness

3. READABILITY
- Sentence flow and connectivity
- Logical progression
- Clarity of expression
- Ease of comprehension

4. STYLE CONSISTENCY
- Tone uniformity
- Register maintenance
- Stylistic coherence

Provide a fluency score (0-100) and detailed feedback on areas for improvement.

Return as JSON:
{
  "fluencyScore": number,
  "grammarScore": number,
  "naturalnessScore": number,
  "readabilityScore": number,
  "styleScore": number,
  "issues": [
    {
      "type": "grammar|style|naturalness|readability",
      "description": "string",
      "suggestion": "string", 
      "position": {"start": number, "end": number},
      "confidence": number
    }
  ],
  "overallFeedback": "string"
}`
    });

    this.addTemplate({
      id: 'adequacy_assessment',
      name: 'Adequacy Assessment',
      description: 'Meaning transfer evaluation between source and target',
      category: 'quality_assessment',
      version: '1.0',
      variables: ['sourceText', 'targetText', 'sourceLanguage', 'targetLanguage'],
      template: `Compare these texts to evaluate meaning transfer accuracy.

SOURCE ({{sourceLanguage}}):
{{sourceText}}

TARGET ({{targetLanguage}}):
{{targetText}}

Evaluate meaning transfer on these dimensions:

1. COMPLETENESS
- All source concepts preserved
- No missing information
- No unwarranted additions

2. ACCURACY
- Factual correctness
- Numerical precision
- Technical accuracy
- Conceptual fidelity

3. SEMANTIC EQUIVALENCE
- Core meaning preservation
- Nuance retention
- Implied meaning transfer
- Cultural context adaptation

4. FUNCTIONAL EQUIVALENCE
- Purpose fulfillment
- Intended effect achievement
- Audience appropriateness

Return assessment as JSON:
{
  "adequacyScore": number,
  "completenessScore": number,
  "accuracyScore": number,
  "semanticScore": number,
  "functionalScore": number,
  "issues": [
    {
      "type": "omission|addition|mistranslation|inaccuracy",
      "severity": "minor|major|critical",
      "description": "string",
      "sourceSegment": "string",
      "targetSegment": "string",
      "suggestion": "string"
    }
  ],
  "overallAssessment": "string"
}`
    });

    this.addTemplate({
      id: 'error_detection',
      name: 'Error Detection and Classification',
      description: 'Systematic error identification and categorization',
      category: 'error_detection',
      version: '1.0',
      variables: ['sourceText', 'targetText', 'errorTypes'],
      template: `Systematically identify and classify errors in this translation.

SOURCE:
{{sourceText}}

TARGET:
{{targetText}}

{{#if errorTypes}}
FOCUS ON THESE ERROR TYPES: {{errorTypes}}
{{/if}}

Identify errors in these categories:

1. LINGUISTIC ERRORS
- Grammar: verb forms, agreement, syntax
- Lexical: wrong word choice, false friends
- Spelling: typos, orthographic errors
- Punctuation: missing, incorrect marks

2. TRANSFER ERRORS  
- Omissions: missing content
- Additions: extra content
- Mistranslations: wrong meaning
- Non-translations: untranslated terms

3. STYLE ERRORS
- Register: formal/informal mismatch
- Tone: inappropriate emotional coloring
- Consistency: terminology/style variation
- Fluency: unnatural expression

4. CULTURAL/FUNCTIONAL ERRORS
- Cultural adaptation failures
- Audience inappropriateness
- Functional inadequacy
- Context misunderstanding

For each error provide:
- Exact location and text
- Error classification
- Severity assessment
- Correction suggestion
- Confidence rating

Return as JSON:
{
  "errorCount": number,
  "errors": [
    {
      "id": "string",
      "category": "linguistic|transfer|style|cultural",
      "type": "string",
      "severity": "minor|major|critical",
      "description": "string",
      "sourceText": "string",
      "targetText": "string",
      "suggestion": "string",
      "position": {"start": number, "end": number},
      "confidence": number
    }
  ],
  "errorSummary": {
    "byCategory": {"linguistic": number, "transfer": number, "style": number, "cultural": number},
    "bySeverity": {"minor": number, "major": number, "critical": number}
  }
}`
    });

    this.addTemplate({
      id: 'terminology_consistency',
      name: 'Terminology Consistency Check',
      description: 'Evaluate terminology usage and consistency',
      category: 'linguistic_analysis',
      version: '1.0',
      variables: ['text', 'domain', 'glossary', 'language'],
      template: `Analyze terminology usage and consistency in this {{language}} text.

TEXT:
{{text}}

{{#if domain}}
DOMAIN: {{domain}}
{{/if}}

{{#if glossary}}
REFERENCE GLOSSARY:
{{glossary}}
{{/if}}

Evaluate:

1. TERMINOLOGY IDENTIFICATION
- Extract domain-specific terms
- Identify technical vocabulary
- Note proper nouns and names
- Highlight acronyms and abbreviations

2. CONSISTENCY ANALYSIS
- Internal consistency within text
- Adherence to provided glossary
- Industry standard compliance
- Style guide conformance

3. APPROPRIATENESS ASSESSMENT
- Domain suitability
- Audience appropriateness
- Register consistency
- Cultural adaptation

4. QUALITY METRICS
- Terminology accuracy
- Consistency percentage
- Coverage completeness
- Standard compliance

Return analysis as JSON:
{
  "consistencyScore": number,
  "terminologyCount": number,
  "extractedTerms": [
    {
      "term": "string",
      "category": "string",
      "frequency": number,
      "contexts": ["string"],
      "isConsistent": boolean,
      "standardTranslation": "string",
      "confidence": number
    }
  ],
  "inconsistencies": [
    {
      "term": "string",
      "variations": ["string"],
      "recommendation": "string",
      "severity": "minor|major|critical"
    }
  ],
  "recommendations": ["string"],
  "metrics": {
    "totalTerms": number,
    "consistentTerms": number,
    "consistencyRate": number,
    "domainCoverage": number
  }
}`
    });

    // MQM-specific template
    this.addTemplate({
      id: 'mqm_assessment',
      name: 'MQM Framework Assessment',
      description: 'Multidimensional Quality Metrics assessment',
      category: 'quality_assessment',
      version: '1.0',
      variables: ['sourceText', 'targetText', 'mqmDimensions'],
      template: `Perform MQM (Multidimensional Quality Metrics) assessment of this translation.

SOURCE:
{{sourceText}}

TARGET:
{{targetText}}

{{#if mqmDimensions}}
FOCUS DIMENSIONS: {{mqmDimensions}}
{{/if}}

Evaluate according to MQM error typology:

## ERROR CATEGORIES

### ACCURACY
- Mistranslation
- Omission
- Addition
- Untranslated text

### FLUENCY
- Inconsistency
- Grammar
- Register
- Locale convention
- Style
- Character encoding

### TERMINOLOGY
- Inconsistent use of terminology
- Wrong term

### STYLE
- Awkward/unnatural
- Inconsistent style

### LOCALE CONVENTION
- Address format
- Date format
- Currency format
- Telephone format

For each error:
- Assign severity: Critical/Major/Minor
- Calculate penalty points
- Provide correction

MQM Score = 100 - (Total penalty points / Word count × 100)

Return as JSON:
{
  "mqmScore": number,
  "wordCount": number,
  "totalPenaltyPoints": number,
  "errors": [
    {
      "category": "accuracy|fluency|terminology|style|locale",
      "subcategory": "string",
      "severity": "critical|major|minor",
      "penaltyPoints": number,
      "description": "string",
      "sourceSegment": "string",
      "targetSegment": "string",
      "correction": "string",
      "position": {"start": number, "end": number}
    }
  ],
  "categoryBreakdown": {
    "accuracy": {"count": number, "points": number},
    "fluency": {"count": number, "points": number},
    "terminology": {"count": number, "points": number},
    "style": {"count": number, "points": number},
    "locale": {"count": number, "points": number}
  },
  "qualityLevel": "excellent|good|acceptable|poor"
}`
    });
  }

  private addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  public getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  public interpolateTemplate(templateId: string, variables: Record<string, any>): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.interpolateString(template.template, variables);
  }

  private interpolateString(template: string, variables: Record<string, any>): string {
    let result = template;

    // Handle simple variable substitution {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return variables[variable] !== undefined ? String(variables[variable]) : match;
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return variables[variable] ? content.trim() : '';
    });

    // Handle conditional blocks with else {{#if variable}}...{{else}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (match, variable, ifContent, elseContent) => {
        return variables[variable] ? ifContent.trim() : elseContent.trim();
      }
    );

    return result;
  }

  public validateTemplate(templateId: string, variables: Record<string, any>): { valid: boolean; missingVariables: string[] } {
    const template = this.getTemplate(templateId);
    if (!template) {
      return { valid: false, missingVariables: [] };
    }

    const missingVariables = template.variables.filter(variable => variables[variable] === undefined);
    
    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }

  public createCustomTemplate(template: Omit<PromptTemplate, 'id'> & { id?: string }): string {
    const id = template.id || `custom_${Date.now()}`;
    this.addTemplate({ ...template, id });
    return id;
  }

  public updateTemplate(id: string, updates: Partial<PromptTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    this.templates.set(id, { ...template, ...updates });
    return true;
  }

  public deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  public exportTemplates(): PromptTemplate[] {
    return this.getAllTemplates();
  }

  public importTemplates(templates: PromptTemplate[]): void {
    templates.forEach(template => this.addTemplate(template));
  }
}

// Singleton instance
export const promptTemplateManager = new PromptTemplateManager();

// Helper functions for common use cases
export function getQualityAssessmentPrompt(
  sourceText: string,
  targetText: string,
  options?: {
    context?: string;
    framework?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  }
): string {
  return promptTemplateManager.interpolateTemplate('quality_assessment_comprehensive', {
    sourceText,
    targetText,
    context: options?.context || '',
    framework: options?.framework || 'General Quality Assessment',
    sourceLanguage: options?.sourceLanguage || 'Source Language',
    targetLanguage: options?.targetLanguage || 'Target Language'
  });
}

export function getFluencyAssessmentPrompt(
  targetText: string,
  language: string,
  context?: string
): string {
  return promptTemplateManager.interpolateTemplate('fluency_assessment', {
    targetText,
    language,
    context: context || ''
  });
}

export function getAdequacyAssessmentPrompt(
  sourceText: string,
  targetText: string,
  sourceLanguage: string = 'Source Language',
  targetLanguage: string = 'Target Language'
): string {
  return promptTemplateManager.interpolateTemplate('adequacy_assessment', {
    sourceText,
    targetText,
    sourceLanguage,
    targetLanguage
  });
}

export function getErrorDetectionPrompt(
  sourceText: string,
  targetText: string,
  errorTypes?: string[]
): string {
  return promptTemplateManager.interpolateTemplate('error_detection', {
    sourceText,
    targetText,
    errorTypes: errorTypes?.join(', ') || ''
  });
}

export function getMQMAssessmentPrompt(
  sourceText: string,
  targetText: string,
  dimensions?: string[]
): string {
  return promptTemplateManager.interpolateTemplate('mqm_assessment', {
    sourceText,
    targetText,
    mqmDimensions: dimensions?.join(', ') || ''
  });
}

export function getTerminologyConsistencyPrompt(
  text: string,
  language: string,
  options?: {
    domain?: string;
    glossary?: string;
  }
): string {
  return promptTemplateManager.interpolateTemplate('terminology_consistency', {
    text,
    language,
    domain: options?.domain || '',
    glossary: options?.glossary || ''
  });
} 