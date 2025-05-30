/**
 * Enhanced Error Handling System for XLIFF Parsers
 * Provides hierarchical error classification, recovery strategies, and detailed tracking
 */

import { XLIFFErrorType, ErrorSeverity, XLIFFParsingError } from './types';

/**
 * Error categories for hierarchical classification
 */
export enum ErrorCategory {
  STRUCTURAL = 'structural',        // Document structure issues
  CONTENT = 'content',             // Content validation issues
  SCHEMA = 'schema',               // Schema validation issues
  ENCODING = 'encoding',           // Character encoding issues
  SYNTAX = 'syntax',               // XML/XLIFF syntax issues
  SEMANTIC = 'semantic',           // Semantic validation issues
  PERFORMANCE = 'performance',     // Performance-related issues
  COMPATIBILITY = 'compatibility'  // Version/tool compatibility issues
}

/**
 * Recovery strategies for handling errors
 */
export enum RecoveryStrategy {
  IGNORE = 'ignore',               // Continue processing, ignore error
  DEFAULT = 'default',             // Use default value and continue
  SKIP = 'skip',                   // Skip the problematic element
  REPAIR = 'repair',               // Attempt to repair the issue
  ABORT = 'abort',                 // Stop processing completely
  WARN = 'warn'                    // Log warning and continue
}

/**
 * Enhanced location information for errors
 */
export interface ErrorLocation {
  line?: number;
  column?: number;
  xpath?: string;
  elementName?: string;
  attributeName?: string;
  parentElement?: string;
  offset?: number;
  contextBefore?: string;
  contextAfter?: string;
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  strategy: RecoveryStrategy;
  description: string;
  appliedValue?: any;
  fallbackValue?: any;
  successful: boolean;
  notes?: string;
}

/**
 * Enhanced XLIFF parsing error with additional metadata
 */
export interface EnhancedXLIFFError extends XLIFFParsingError {
  category: ErrorCategory;
  errorCode: string;
  phase: 'parsing' | 'validation' | 'processing' | 'serialization';
  recoverable: boolean;
  recoveryAction?: RecoveryAction;
  timestamp: number;
  context: {
    parser: string;
    version: string;
    processingStep: string;
    elementContext?: string;
  };
  location: ErrorLocation;
  relatedErrors?: string[]; // IDs of related errors
  helpUrl?: string;
}

/**
 * Error factory for creating standardized errors
 */
export class XLIFFErrorFactory {
  /**
   * Create a missing required element error
   */
  static createMissingElementError(
    elementName: string,
    parentElement?: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
      category: ErrorCategory.STRUCTURAL,
      severity: ErrorSeverity.MAJOR,
      errorCode: 'STRUCT_001',
      phase: 'validation',
      recoverable: true,
      message: `Required element "${elementName}" is missing${parentElement ? ` in ${parentElement}` : ''}`,
      timestamp: Date.now(),
      context: {
        parser: 'unknown',
        version: 'unknown',
        processingStep: 'structure_validation',
        elementContext: parentElement
      },
      location: {
        elementName,
        parentElement,
        ...location
      },
      helpUrl: 'https://docs.oasis-open.org/xliff/xliff-core/v1.2/os/xliff-core.html'
    };
  }

  /**
   * Create a malformed XML error
   */
  static createMalformedXMLError(
    message: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.MALFORMED_XML,
      category: ErrorCategory.SYNTAX,
      severity: ErrorSeverity.CRITICAL,
      errorCode: 'SYNTAX_001',
      phase: 'parsing',
      recoverable: false,
      message: `Malformed XML: ${message}`,
      timestamp: Date.now(),
      context: {
        parser: 'xml_parser',
        version: 'unknown',
        processingStep: 'xml_parsing'
      },
      location: {
        ...location
      },
      helpUrl: 'https://www.w3.org/TR/xml/'
    };
  }

  /**
   * Create an invalid attribute error
   */
  static createInvalidAttributeError(
    attributeName: string,
    elementName: string,
    expectedValue?: string,
    actualValue?: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    const message = expectedValue
      ? `Invalid value for attribute "${attributeName}" in element "${elementName}". Expected: ${expectedValue}, got: ${actualValue || 'undefined'}`
      : `Invalid attribute "${attributeName}" in element "${elementName}"`;

    return {
      type: XLIFFErrorType.INVALID_ATTRIBUTE,
      category: ErrorCategory.CONTENT,
      severity: ErrorSeverity.MINOR,
      errorCode: 'ATTR_001',
      phase: 'validation',
      recoverable: true,
      message,
      timestamp: Date.now(),
      context: {
        parser: 'unknown',
        version: 'unknown',
        processingStep: 'attribute_validation',
        elementContext: elementName
      },
      location: {
        elementName,
        attributeName,
        ...location
      },
      details: {
        expectedValue,
        actualValue
      }
    };
  }

  /**
   * Create an encoding error
   */
  static createEncodingError(
    message: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.PARSING_ERROR,
      category: ErrorCategory.ENCODING,
      severity: ErrorSeverity.MAJOR,
      errorCode: 'ENC_001',
      phase: 'parsing',
      recoverable: true,
      message: `Encoding error: ${message}`,
      timestamp: Date.now(),
      context: {
        parser: 'unknown',
        version: 'unknown',
        processingStep: 'encoding_detection'
      },
      location: {
        ...location
      },
      helpUrl: 'https://www.w3.org/International/articles/definitions-characters/'
    };
  }

  /**
   * Create a schema validation error
   */
  static createSchemaValidationError(
    message: string,
    schemaPath?: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.SCHEMA_ERROR,
      category: ErrorCategory.SCHEMA,
      severity: ErrorSeverity.MAJOR,
      errorCode: 'SCHEMA_001',
      phase: 'validation',
      recoverable: false,
      message: `Schema validation failed: ${message}`,
      timestamp: Date.now(),
      context: {
        parser: 'schema_validator',
        version: 'unknown',
        processingStep: 'schema_validation'
      },
      location: {
        ...location
      },
      details: {
        schemaPath
      }
    };
  }

  /**
   * Create a performance warning
   */
  static createPerformanceWarning(
    operation: string,
    duration: number,
    threshold: number,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.VALIDATION_ERROR,
      category: ErrorCategory.PERFORMANCE,
      severity: ErrorSeverity.WARNING,
      errorCode: 'PERF_001',
      phase: 'processing',
      recoverable: true,
      message: `Performance warning: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      timestamp: Date.now(),
      context: {
        parser: 'performance_monitor',
        version: 'unknown',
        processingStep: operation
      },
      location: {
        ...location
      },
      details: {
        operation,
        duration,
        threshold
      }
    };
  }

  /**
   * Create a compatibility warning
   */
  static createCompatibilityWarning(
    feature: string,
    version: string,
    location?: Partial<ErrorLocation>
  ): EnhancedXLIFFError {
    return {
      type: XLIFFErrorType.VALIDATION_ERROR,
      category: ErrorCategory.COMPATIBILITY,
      severity: ErrorSeverity.WARNING,
      errorCode: 'COMPAT_001',
      phase: 'validation',
      recoverable: true,
      message: `Compatibility warning: Feature "${feature}" may not be supported in ${version}`,
      timestamp: Date.now(),
      context: {
        parser: 'compatibility_checker',
        version,
        processingStep: 'compatibility_check'
      },
      location: {
        ...location
      },
      details: {
        feature,
        version
      }
    };
  }
}

/**
 * Error recovery engine for attempting automatic recovery
 */
export class ErrorRecoveryEngine {
  private recoveryAttempts: Map<string, number> = new Map();
  private maxRecoveryAttempts = 3;

  /**
   * Attempt to recover from an error
   */
  public attemptRecovery(error: EnhancedXLIFFError): RecoveryAction | null {
    const errorKey = `${error.errorCode}_${error.location.line}_${error.location.column}`;
    const attempts = this.recoveryAttempts.get(errorKey) || 0;

    if (attempts >= this.maxRecoveryAttempts) {
      return null; // Too many attempts
    }

    this.recoveryAttempts.set(errorKey, attempts + 1);

    switch (error.category) {
      case ErrorCategory.STRUCTURAL:
        return this.recoverStructuralError(error);
      case ErrorCategory.CONTENT:
        return this.recoverContentError(error);
      case ErrorCategory.ENCODING:
        return this.recoverEncodingError(error);
      default:
        return null;
    }
  }

  private recoverStructuralError(error: EnhancedXLIFFError): RecoveryAction {
    if (error.type === XLIFFErrorType.MISSING_REQUIRED_ELEMENT) {
      return {
        strategy: RecoveryStrategy.DEFAULT,
        description: `Created default ${error.location.elementName} element`,
        appliedValue: `<${error.location.elementName}/>`,
        successful: true,
        notes: 'Auto-generated default element to maintain structure'
      };
    }

    return {
      strategy: RecoveryStrategy.SKIP,
      description: 'Skipped problematic structural element',
      successful: true
    };
  }

  private recoverContentError(error: EnhancedXLIFFError): RecoveryAction {
    if (error.type === XLIFFErrorType.INVALID_ATTRIBUTE) {
      const fallbackValue = this.getDefaultAttributeValue(
        error.location.attributeName!,
        error.location.elementName!
      );

      return {
        strategy: RecoveryStrategy.DEFAULT,
        description: `Used default value for invalid attribute`,
        appliedValue: fallbackValue,
        fallbackValue,
        successful: true,
        notes: `Replaced invalid attribute value with default: ${fallbackValue}`
      };
    }

    return {
      strategy: RecoveryStrategy.WARN,
      description: 'Logged content warning and continued',
      successful: true
    };
  }

  private recoverEncodingError(error: EnhancedXLIFFError): RecoveryAction {
    return {
      strategy: RecoveryStrategy.REPAIR,
      description: 'Attempted to repair encoding issues',
      successful: true,
      notes: 'Applied UTF-8 encoding normalization'
    };
  }

  private getDefaultAttributeValue(attributeName: string, elementName: string): string {
    const defaults: Record<string, Record<string, string>> = {
      'trans-unit': {
        'approved': 'no',
        'translate': 'yes'
      },
      'file': {
        'datatype': 'unknown'
      }
    };

    return defaults[elementName]?.[attributeName] || '';
  }
}

/**
 * Error location tracker for precise error positioning
 */
export class ErrorLocationTracker {
  private xmlContent: string;
  private lines: string[];

  constructor(xmlContent: string) {
    this.xmlContent = xmlContent;
    this.lines = xmlContent.split('\n');
  }

  /**
   * Get detailed location information for a given position
   */
  public getLocationInfo(offset: number): ErrorLocation {
    let line = 1;
    let column = 1;
    let currentOffset = 0;

    for (let i = 0; i < this.xmlContent.length && currentOffset < offset; i++) {
      if (this.xmlContent[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      currentOffset++;
    }

    const contextStart = Math.max(0, offset - 50);
    const contextEnd = Math.min(this.xmlContent.length, offset + 50);
    const contextBefore = this.xmlContent.substring(contextStart, offset);
    const contextAfter = this.xmlContent.substring(offset, contextEnd);

    return {
      line,
      column,
      offset,
      contextBefore,
      contextAfter
    };
  }

  /**
   * Get XPath for an element at a given line/column
   */
  public getXPath(line: number, column: number): string {
    // Simplified XPath generation - in real implementation,
    // this would parse the XML structure to build accurate XPath
    const lineContent = this.lines[line - 1] || '';
    const elementMatch = lineContent.match(/<(\w+)/);
    
    if (elementMatch) {
      return `//${elementMatch[1]}[${line}]`;
    }

    return `//*[${line}]`;
  }

  /**
   * Find the element context at a given position
   */
  public getElementContext(offset: number): { elementName?: string; parentElement?: string } {
    // Look backwards to find the opening tag
    let searchPos = offset;
    while (searchPos > 0 && this.xmlContent[searchPos] !== '<') {
      searchPos--;
    }

    if (searchPos === 0) return {};

    const elementMatch = this.xmlContent.substring(searchPos).match(/<(\w+)/);
    if (!elementMatch) return {};

    const elementName = elementMatch[1];

    // Find parent element (simplified)
    let parentSearchPos = searchPos - 1;
    while (parentSearchPos > 0 && this.xmlContent[parentSearchPos] !== '<') {
      parentSearchPos--;
    }

    const parentMatch = this.xmlContent.substring(parentSearchPos).match(/<(\w+)/);
    const parentElement = parentMatch ? parentMatch[1] : undefined;

    return { elementName, parentElement };
  }
} 