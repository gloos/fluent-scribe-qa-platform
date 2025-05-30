// Default Response Provider for LLM Fallback System

import {
  QualityAssessmentResponse,
  LinguisticAnalysisResponse,
  DefaultAssessmentResponses,
  ParsedResponse
} from '../types/llm-types';

export class DefaultResponseProvider {
  private static instance: DefaultResponseProvider;
  
  private constructor() {}

  public static getInstance(): DefaultResponseProvider {
    if (!DefaultResponseProvider.instance) {
      DefaultResponseProvider.instance = new DefaultResponseProvider();
    }
    return DefaultResponseProvider.instance;
  }

  /**
   * Get default quality assessment response
   */
  public getDefaultQualityAssessment(
    sourceText: string,
    targetText: string,
    context?: string
  ): ParsedResponse<QualityAssessmentResponse> {
    const response: QualityAssessmentResponse = {
      overallScore: 50, // Neutral score when unable to assess
      fluencyScore: 50,
      adequacyScore: 50,
      confidence: 20, // Low confidence for default response
      
      errors: [
        {
          type: 'service_unavailable',
          severity: 'minor',
          description: 'Quality assessment service temporarily unavailable. Manual review recommended.',
          confidence: 100,
          suggestion: 'Please review this translation manually or try again later.'
        }
      ],
      
      suggestions: [
        {
          type: 'service_notice',
          text: 'LLM services are currently unavailable. This is a default assessment.',
          confidence: 100,
          reasoning: 'All configured LLM providers are currently unreachable.'
        }
      ],
      
      metrics: {
        wordCount: targetText.split(/\s+/).length,
        characterCount: targetText.length,
        consistencyScore: 50,
        terminologyAdherence: 50
      },
      
      reasoning: 'This is a default response provided when LLM services are unavailable. The scores are neutral (50/100) and should not be considered as actual quality metrics. Manual review is recommended.',
      
      metadata: {
        defaultResponse: true,
        timestamp: new Date().toISOString(),
        sourceTextLength: sourceText.length,
        targetTextLength: targetText.length
      }
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_quality_assessment'
      }
    };
  }

  /**
   * Get default linguistic analysis response
   */
  public getDefaultLinguisticAnalysis(
    text: string,
    language: string,
    analysisTypes: Array<'grammar' | 'style' | 'terminology' | 'consistency' | 'fluency'>
  ): ParsedResponse<LinguisticAnalysisResponse> {
    const response: LinguisticAnalysisResponse = {
      language,
      
      grammar: {
        score: 50,
        issues: [
          {
            type: 'service_unavailable',
            description: 'Grammar analysis service temporarily unavailable',
            suggestion: 'Manual grammar review recommended',
            position: { start: 0, end: text.length },
            confidence: 100
          }
        ]
      },
      
      style: {
        score: 50,
        issues: [
          {
            type: 'service_unavailable',
            description: 'Style analysis service temporarily unavailable',
            suggestion: 'Manual style review recommended',
            confidence: 100
          }
        ]
      },
      
      terminology: {
        score: 50,
        issues: [
          {
            term: 'All terms',
            suggestion: 'Terminology analysis unavailable',
            confidence: 100,
            category: 'service_notice'
          }
        ]
      },
      
      consistency: {
        score: 50,
        inconsistencies: [
          {
            type: 'service_unavailable',
            instances: ['Analysis unavailable'],
            suggestion: 'Manual consistency review recommended'
          }
        ]
      },
      
      fluency: {
        score: 50,
        issues: [
          {
            type: 'service_unavailable',
            description: 'Fluency analysis service temporarily unavailable',
            suggestion: 'Manual fluency review recommended',
            confidence: 100
          }
        ]
      },
      
      overallScore: 50,
      
      metadata: {
        defaultResponse: true,
        timestamp: new Date().toISOString(),
        requestedAnalysisTypes: analysisTypes,
        textLength: text.length
      }
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_linguistic_analysis'
      }
    };
  }

  /**
   * Get default error detection response
   */
  public getDefaultErrorDetection(): ParsedResponse<Array<{
    type: string;
    severity: 'minor' | 'major' | 'critical';
    description: string;
    confidence: number;
  }>> {
    const errors = [
      {
        type: 'service_unavailable',
        severity: 'minor' as const,
        description: 'Error detection service is temporarily unavailable. Manual review is recommended to identify potential issues.',
        confidence: 100
      }
    ];

    return {
      success: true,
      data: errors,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_error_detection'
      }
    };
  }

  /**
   * Get default fluency assessment response
   */
  public getDefaultFluencyAssessment(): ParsedResponse<{
    score: number;
    issues: any[];
    confidence: number;
  }> {
    const response = {
      score: 50,
      issues: [
        {
          type: 'service_unavailable',
          description: 'Fluency assessment service temporarily unavailable',
          suggestion: 'Manual fluency review recommended',
          confidence: 100
        }
      ],
      confidence: 20
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_fluency_assessment'
      }
    };
  }

  /**
   * Get default adequacy assessment response
   */
  public getDefaultAdequacyAssessment(): ParsedResponse<{
    score: number;
    issues: any[];
    confidence: number;
  }> {
    const response = {
      score: 50,
      issues: [
        {
          type: 'service_unavailable',
          description: 'Adequacy assessment service temporarily unavailable',
          suggestion: 'Manual adequacy review recommended',
          confidence: 100
        }
      ],
      confidence: 20
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_adequacy_assessment'
      }
    };
  }

  /**
   * Get default MQM assessment response
   */
  public getDefaultMQMAssessment(): ParsedResponse<{
    score: number;
    errors: any[];
    confidence: number;
  }> {
    const response = {
      score: 50,
      errors: [
        {
          type: 'service_unavailable',
          severity: 'minor',
          description: 'MQM assessment service temporarily unavailable',
          suggestion: 'Manual MQM evaluation recommended',
          confidence: 100
        }
      ],
      confidence: 20
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_mqm_assessment'
      }
    };
  }

  /**
   * Get default terminology consistency response
   */
  public getDefaultTerminologyConsistency(): ParsedResponse<{
    score: number;
    inconsistencies: any[];
    confidence: number;
  }> {
    const response = {
      score: 50,
      inconsistencies: [
        {
          type: 'service_unavailable',
          terms: ['Analysis unavailable'],
          suggestion: 'Manual terminology review recommended',
          confidence: 100
        }
      ],
      confidence: 20
    };

    return {
      success: true,
      data: response,
      confidence: 20,
      metadata: {
        fallbackReason: 'All LLM services unavailable',
        responseType: 'default_terminology_consistency'
      }
    };
  }

  /**
   * Get a comprehensive default response set
   */
  public getAllDefaultResponses(): DefaultAssessmentResponses {
    return {
      quality_assessment: this.getDefaultQualityAssessment('', '').data!,
      linguistic_analysis: this.getDefaultLinguisticAnalysis('', 'en', ['grammar', 'style']).data!,
      error_detection: this.getDefaultErrorDetection().data!,
      fluency_assessment: this.getDefaultFluencyAssessment().data!,
      adequacy_assessment: this.getDefaultAdequacyAssessment().data!,
      mqm_assessment: this.getDefaultMQMAssessment().data!
    };
  }

  /**
   * Check if a response is a default response
   */
  public static isDefaultResponse(response: any): boolean {
    return response?.metadata?.defaultResponse === true;
  }

  /**
   * Get default response message for users
   */
  public getServiceUnavailableMessage(): string {
    return 'AI quality assessment services are temporarily unavailable. Default assessments have been provided. For accurate quality evaluation, please try again later or perform manual review.';
  }

  /**
   * Create a user notification for service degradation
   */
  public createServiceDegradationNotice(): {
    type: 'warning';
    title: string;
    message: string;
    actions: Array<{
      label: string;
      action: string;
    }>;
  } {
    return {
      type: 'warning',
      title: 'Quality Assessment Service Degraded',
      message: 'AI-powered quality assessment is currently unavailable. Default assessments are being provided with reduced accuracy. Manual review is recommended for important translations.',
      actions: [
        {
          label: 'Retry Assessment',
          action: 'retry_assessment'
        },
        {
          label: 'Continue with Manual Review',
          action: 'manual_review'
        },
        {
          label: 'View Service Status',
          action: 'view_service_status'
        }
      ]
    };
  }
} 