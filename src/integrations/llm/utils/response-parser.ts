// Response Parser for LLM Quality Assessment Responses

import { 
  QualityAssessmentResponse, 
  LinguisticAnalysisResponse, 
  ParsedResponse 
} from '../types/llm-types';
import { ErrorSeverity } from '../../../lib/types/assessment';

export class LLMResponseParser {
  
  /**
   * Parse a comprehensive quality assessment response from LLM
   */
  public static parseQualityAssessment(response: string): ParsedResponse<QualityAssessmentResponse> {
    try {
      // Extract JSON from response if it's embedded in text
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      // Validate and transform the response
      const qualityResponse: QualityAssessmentResponse = {
        overallScore: this.parseScore(parsed.overallScore),
        fluencyScore: this.parseScore(parsed.fluencyScore),
        adequacyScore: this.parseScore(parsed.adequacyScore),
        confidence: this.parseScore(parsed.confidence),
        
        errors: this.parseErrors(parsed.errors),
        suggestions: this.parseSuggestions(parsed.suggestions),
        
        metrics: {
          wordCount: parsed.metrics?.wordCount || 0,
          characterCount: parsed.metrics?.characterCount || 0,
          consistencyScore: parsed.metrics?.consistencyScore,
          terminologyAdherence: parsed.metrics?.terminologyAdherence
        },
        
        reasoning: parsed.reasoning || 'No reasoning provided',
        metadata: {
          parsedAt: new Date().toISOString(),
          originalResponse: response.substring(0, 500) // Store truncated original
        }
      };

      return {
        success: true,
        data: qualityResponse,
        confidence: this.calculateParsingConfidence(qualityResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse quality assessment response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
    }
  }

  /**
   * Parse fluency assessment response
   */
  public static parseFluencyAssessment(response: string): ParsedResponse<any> {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      const fluencyResponse = {
        fluencyScore: this.parseScore(parsed.fluencyScore),
        grammarScore: this.parseScore(parsed.grammarScore),
        naturalnessScore: this.parseScore(parsed.naturalnessScore),
        readabilityScore: this.parseScore(parsed.readabilityScore),
        styleScore: this.parseScore(parsed.styleScore),
        issues: this.parseFluencyIssues(parsed.issues),
        overallFeedback: parsed.overallFeedback || ''
      };

      return {
        success: true,
        data: fluencyResponse,
        confidence: this.calculateGenericConfidence(fluencyResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse fluency assessment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse adequacy assessment response
   */
  public static parseAdequacyAssessment(response: string): ParsedResponse<any> {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      const adequacyResponse = {
        adequacyScore: this.parseScore(parsed.adequacyScore),
        completenessScore: this.parseScore(parsed.completenessScore),
        accuracyScore: this.parseScore(parsed.accuracyScore),
        semanticScore: this.parseScore(parsed.semanticScore),
        functionalScore: this.parseScore(parsed.functionalScore),
        issues: this.parseAdequacyIssues(parsed.issues),
        overallAssessment: parsed.overallAssessment || ''
      };

      return {
        success: true,
        data: adequacyResponse,
        confidence: this.calculateGenericConfidence(adequacyResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse adequacy assessment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse error detection response
   */
  public static parseErrorDetection(response: string): ParsedResponse<any> {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      const errorResponse = {
        errorCount: parsed.errorCount || 0,
        errors: this.parseDetectedErrors(parsed.errors),
        errorSummary: {
          byCategory: parsed.errorSummary?.byCategory || {},
          bySeverity: parsed.errorSummary?.bySeverity || {}
        }
      };

      return {
        success: true,
        data: errorResponse,
        confidence: this.calculateGenericConfidence(errorResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse error detection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse MQM assessment response
   */
  public static parseMQMAssessment(response: string): ParsedResponse<any> {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      const mqmResponse = {
        mqmScore: this.parseScore(parsed.mqmScore),
        wordCount: parsed.wordCount || 0,
        totalPenaltyPoints: parsed.totalPenaltyPoints || 0,
        errors: this.parseMQMErrors(parsed.errors),
        categoryBreakdown: parsed.categoryBreakdown || {},
        qualityLevel: parsed.qualityLevel || 'unknown'
      };

      return {
        success: true,
        data: mqmResponse,
        confidence: this.calculateGenericConfidence(mqmResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse MQM assessment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse terminology consistency response
   */
  public static parseTerminologyConsistency(response: string): ParsedResponse<any> {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);

      const terminologyResponse = {
        consistencyScore: this.parseScore(parsed.consistencyScore),
        terminologyCount: parsed.terminologyCount || 0,
        extractedTerms: this.parseExtractedTerms(parsed.extractedTerms),
        inconsistencies: parsed.inconsistencies || [],
        recommendations: parsed.recommendations || [],
        metrics: parsed.metrics || {}
      };

      return {
        success: true,
        data: terminologyResponse,
        confidence: this.calculateGenericConfidence(terminologyResponse)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse terminology consistency: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract JSON from response text that might contain additional formatting
   */
  private static extractJSON(response: string): string {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Try to find JSON object bounds
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    // Clean up common formatting issues
    cleaned = cleaned
      .replace(/\n\s*/g, ' ')  // Replace newlines with spaces
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .trim();

    return cleaned;
  }

  /**
   * Parse and validate score values
   */
  private static parseScore(score: any): number {
    const parsed = typeof score === 'string' ? parseFloat(score) : score;
    if (typeof parsed !== 'number' || isNaN(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(100, parsed)); // Clamp between 0-100
  }

  /**
   * Parse error array for quality assessment
   */
  private static parseErrors(errors: any[]): QualityAssessmentResponse['errors'] {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.map(error => ({
      type: error.type || 'unknown',
      severity: this.normalizeSeverity(error.severity),
      description: error.description || '',
      suggestion: error.suggestion || '',
      position: {
        start: parseInt(error.position?.start) || 0,
        end: parseInt(error.position?.end) || 0
      },
      confidence: this.parseScore(error.confidence)
    }));
  }

  /**
   * Parse suggestions array
   */
  private static parseSuggestions(suggestions: any[]): QualityAssessmentResponse['suggestions'] {
    if (!Array.isArray(suggestions)) {
      return [];
    }

    return suggestions.map(suggestion => ({
      type: suggestion.type || 'general',
      text: suggestion.text || '',
      confidence: this.parseScore(suggestion.confidence),
      reasoning: suggestion.reasoning || ''
    }));
  }

  /**
   * Parse fluency issues
   */
  private static parseFluencyIssues(issues: any[]): any[] {
    if (!Array.isArray(issues)) {
      return [];
    }

    return issues.map(issue => ({
      type: issue.type || 'unknown',
      description: issue.description || '',
      suggestion: issue.suggestion || '',
      position: {
        start: parseInt(issue.position?.start) || 0,
        end: parseInt(issue.position?.end) || 0
      },
      confidence: this.parseScore(issue.confidence)
    }));
  }

  /**
   * Parse adequacy issues
   */
  private static parseAdequacyIssues(issues: any[]): any[] {
    if (!Array.isArray(issues)) {
      return [];
    }

    return issues.map(issue => ({
      type: issue.type || 'unknown',
      severity: this.normalizeSeverity(issue.severity),
      description: issue.description || '',
      sourceSegment: issue.sourceSegment || '',
      targetSegment: issue.targetSegment || '',
      suggestion: issue.suggestion || ''
    }));
  }

  /**
   * Parse detected errors
   */
  private static parseDetectedErrors(errors: any[]): any[] {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.map(error => ({
      id: error.id || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: error.category || 'unknown',
      type: error.type || 'unknown',
      severity: this.normalizeSeverity(error.severity),
      description: error.description || '',
      sourceText: error.sourceText || '',
      targetText: error.targetText || '',
      suggestion: error.suggestion || '',
      position: {
        start: parseInt(error.position?.start) || 0,
        end: parseInt(error.position?.end) || 0
      },
      confidence: this.parseScore(error.confidence)
    }));
  }

  /**
   * Parse MQM errors
   */
  private static parseMQMErrors(errors: any[]): any[] {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.map(error => ({
      category: error.category || 'unknown',
      subcategory: error.subcategory || '',
      severity: this.normalizeSeverity(error.severity),
      penaltyPoints: parseFloat(error.penaltyPoints) || 0,
      description: error.description || '',
      sourceSegment: error.sourceSegment || '',
      targetSegment: error.targetSegment || '',
      correction: error.correction || '',
      position: {
        start: parseInt(error.position?.start) || 0,
        end: parseInt(error.position?.end) || 0
      }
    }));
  }

  /**
   * Parse extracted terms
   */
  private static parseExtractedTerms(terms: any[]): any[] {
    if (!Array.isArray(terms)) {
      return [];
    }

    return terms.map(term => ({
      term: term.term || '',
      category: term.category || 'general',
      frequency: parseInt(term.frequency) || 1,
      contexts: Array.isArray(term.contexts) ? term.contexts : [],
      isConsistent: Boolean(term.isConsistent),
      standardTranslation: term.standardTranslation || '',
      confidence: this.parseScore(term.confidence)
    }));
  }

  /**
   * Normalize severity values to match application enum
   */
  private static normalizeSeverity(severity: any): ErrorSeverity {
    const severityStr = String(severity).toLowerCase();
    
    switch (severityStr) {
      case 'critical':
      case 'high':
        return ErrorSeverity.CRITICAL;
      case 'major':
      case 'medium':
        return ErrorSeverity.MAJOR;
      case 'minor':
      case 'low':
        return ErrorSeverity.MINOR;
      default:
        return ErrorSeverity.MINOR;
    }
  }

  /**
   * Calculate parsing confidence based on response completeness
   */
  private static calculateParsingConfidence(response: QualityAssessmentResponse): number {
    let confidence = 0;
    
    // Base score presence
    if (response.overallScore > 0) confidence += 20;
    if (response.fluencyScore > 0) confidence += 15;
    if (response.adequacyScore > 0) confidence += 15;
    
    // Content quality
    if (response.reasoning && response.reasoning.length > 10) confidence += 20;
    if (response.errors && response.errors.length > 0) confidence += 15;
    if (response.suggestions && response.suggestions.length > 0) confidence += 10;
    
    // Metrics presence
    if (response.metrics.wordCount > 0) confidence += 5;
    
    return Math.min(100, confidence);
  }

  /**
   * Calculate generic confidence for other response types
   */
  private static calculateGenericConfidence(response: any): number {
    let confidence = 50; // Base confidence
    
    // Check for required fields
    const requiredFields = Object.keys(response);
    const populatedFields = requiredFields.filter(field => {
      const value = response[field];
      return value !== undefined && value !== null && value !== '' && 
             (typeof value !== 'number' || value > 0);
    });
    
    confidence += (populatedFields.length / requiredFields.length) * 40;
    
    // Bonus for arrays with content
    Object.values(response).forEach(value => {
      if (Array.isArray(value) && value.length > 0) {
        confidence += 5;
      }
    });
    
    return Math.min(100, confidence);
  }

  /**
   * Validate response structure and content
   */
  public static validateResponse(response: any, expectedFields: string[]): { valid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    expectedFields.forEach(field => {
      if (response[field] === undefined || response[field] === null) {
        missingFields.push(field);
      }
    });
    
    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Sanitize and clean response text
   */
  public static sanitizeResponse(response: string): string {
    return response
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract metadata from response
   */
  public static extractMetadata(response: string): Record<string, any> {
    const metadata: Record<string, any> = {
      responseLength: response.length,
      hasJSON: response.includes('{') && response.includes('}'),
      hasMarkdown: response.includes('```'),
      estimatedTokens: Math.ceil(response.length / 4), // Rough token estimate
      parsedAt: new Date().toISOString()
    };

    // Look for model mentions
    const modelMatch = response.match(/model[:\s]+([a-zA-Z0-9-_.]+)/i);
    if (modelMatch) {
      metadata.mentionedModel = modelMatch[1];
    }

    // Look for confidence indicators
    const confidenceMatch = response.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
    if (confidenceMatch) {
      metadata.mentionedConfidence = parseFloat(confidenceMatch[1]);
    }

    return metadata;
  }
} 