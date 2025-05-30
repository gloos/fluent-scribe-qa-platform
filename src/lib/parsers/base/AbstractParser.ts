/**
 * Abstract base parser class for XLIFF parsers
 * Provides common functionality and defines the contract for version-specific parsers
 */

import {
  XLIFFParser,
  XLIFFParsingResult,
  XLIFFParsingOptions,
  XLIFFDocument,
  XLIFFParsingError,
  XLIFFVersion,
  XLIFFErrorType,
  ErrorSeverity,
  XLIFFProcessingContext
} from '../types';

/**
 * Abstract parser class that all version-specific parsers must extend
 */
export abstract class AbstractXLIFFParser implements XLIFFParser {
  public abstract readonly version: XLIFFVersion;
  public abstract readonly supportedNamespaces: string[];

  /**
   * Parse XLIFF content into a document model
   */
  public async parse(
    xmlContent: string,
    options: XLIFFParsingOptions = {}
  ): Promise<XLIFFParsingResult> {
    const startTime = Date.now();
    const result: XLIFFParsingResult = {
      success: false,
      errors: [],
      warnings: [],
      metadata: {
        version: this.version,
        parseTime: 0,
        totalSegments: 0,
        totalFiles: 0
      }
    };

    try {
      // Validate input
      if (!xmlContent || xmlContent.trim().length === 0) {
        result.errors.push(this.createError(
          XLIFFErrorType.PARSING_ERROR,
          ErrorSeverity.CRITICAL,
          'Empty XML content provided'
        ));
        return result;
      }

      // Create processing context
      const context = this.createProcessingContext(options);

      // Parse XML structure
      const domDocument = this.parseXMLString(xmlContent);
      
      // Version-specific parsing
      const document = await this.parseDocument(domDocument, context);
      
      if (document) {
        document.originalXML = options.extractMetadata ? xmlContent : undefined;
        
        // Validate document if requested
        if (options.validateSchema) {
          const validationErrors = this.validate(document);
          result.errors.push(...validationErrors.filter(e => e.severity === ErrorSeverity.CRITICAL || e.severity === ErrorSeverity.MAJOR));
          result.warnings.push(...validationErrors.filter(e => e.severity === ErrorSeverity.MINOR || e.severity === ErrorSeverity.WARNING));
        }

        // Apply custom validators
        if (options.customValidators) {
          for (const validator of options.customValidators) {
            const customErrors = validator.validate(document);
            result.errors.push(...customErrors.filter(e => e.severity === ErrorSeverity.CRITICAL || e.severity === ErrorSeverity.MAJOR));
            result.warnings.push(...customErrors.filter(e => e.severity === ErrorSeverity.MINOR || e.severity === ErrorSeverity.WARNING));
          }
        }

        result.document = document;
        result.success = result.errors.length === 0;
        result.metadata.totalSegments = document.getTotalSegmentCount();
        result.metadata.totalFiles = document.files.length;
      }

    } catch (error) {
      result.errors.push(this.createError(
        XLIFFErrorType.PARSING_ERROR,
        ErrorSeverity.CRITICAL,
        `Failed to parse XLIFF: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }

    result.metadata.parseTime = Date.now() - startTime;
    return result;
  }

  /**
   * Validate a parsed XLIFF document
   */
  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Basic document validation
    if (!document.files || document.files.length === 0) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.CRITICAL,
        'Document must contain at least one file'
      ));
    }

    // Validate each file
    for (const file of document.files) {
      errors.push(...this.validateFile(file));
    }

    // Version-specific validation
    errors.push(...this.validateVersionSpecific(document));

    return errors;
  }

  /**
   * Serialize a document back to XML
   */
  public abstract serialize(document: XLIFFDocument): string;

  /**
   * Detect if this parser can handle the given XML content
   */
  public abstract detectVersion(xmlContent: string): boolean;

  /**
   * Normalize document to standard format
   */
  public abstract normalizeDocument(document: XLIFFDocument): XLIFFDocument;

  /**
   * Version-specific document parsing implementation
   */
  protected abstract parseDocument(
    domDocument: Document,
    context: XLIFFProcessingContext
  ): Promise<XLIFFDocument>;

  /**
   * Version-specific validation
   */
  protected abstract validateVersionSpecific(document: XLIFFDocument): XLIFFParsingError[];

  /**
   * Parse XML string into DOM document
   */
  protected parseXMLString(xmlContent: string): Document {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML parsing failed: ${parseError.textContent}`);
    }

    return doc;
  }

  /**
   * Create processing context from options
   */
  protected createProcessingContext(options: XLIFFParsingOptions): XLIFFProcessingContext {
    return {
      preserveOriginalStructure: options.preserveWhitespace ?? false,
      extractAllMetadata: options.extractMetadata ?? true,
      validateAgainstSchema: options.validateSchema ?? false,
      customNamespaces: {},
      errorHandler: undefined,
      progressCallback: undefined
    };
  }

  /**
   * Validate a file
   */
  protected validateFile(file: any): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    if (!file.original) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have an "original" attribute'
      ));
    }

    if (!file.sourceLanguage) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have a "source-language" attribute'
      ));
    }

    if (!file.datatype) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have a "datatype" attribute'
      ));
    }

    if (!file.body) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.CRITICAL,
        'File element must contain a body element'
      ));
    }

    return errors;
  }

  /**
   * Create a standardized parsing error
   */
  protected createError(
    type: XLIFFErrorType,
    severity: ErrorSeverity,
    message: string,
    location?: { line?: number; column?: number; xpath?: string },
    details?: Record<string, any>
  ): XLIFFParsingError {
    return {
      type,
      severity,
      message,
      location,
      details
    };
  }

  /**
   * Extract attributes from DOM element
   */
  protected extractAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
      }
    }

    return attributes;
  }

  /**
   * Get text content from element, handling whitespace preservation
   */
  protected getTextContent(element: Element, preserveWhitespace = false): string {
    if (!element) return '';
    
    const text = element.textContent || '';
    return preserveWhitespace ? text : text.trim();
  }

  /**
   * Find child elements by tag name
   */
  protected findChildElements(parent: Element, tagName: string): Element[] {
    const children: Element[] = [];
    
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.tagName === tagName) {
        children.push(child);
      }
    }

    return children;
  }

  /**
   * Find first child element by tag name
   */
  protected findFirstChildElement(parent: Element, tagName: string): Element | null {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.tagName === tagName) {
        return child;
      }
    }
    return null;
  }

  /**
   * Check if element has required attributes
   */
  protected validateRequiredAttributes(
    element: Element,
    requiredAttrs: string[]
  ): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    
    for (const attr of requiredAttrs) {
      if (!element.hasAttribute(attr)) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          `Element "${element.tagName}" is missing required attribute "${attr}"`
        ));
      }
    }

    return errors;
  }

  /**
   * Utility method to convert DOM Node to XPath
   */
  protected getXPath(element: Node): string {
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const parts: string[] = [];
    let current: Node | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const currentElement = current as Element;
      let tagName = currentElement.tagName.toLowerCase();
      
      // Add position if there are siblings with the same name
      const siblings = Array.from(currentElement.parentNode?.children || [])
        .filter(sibling => sibling.tagName === currentElement.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentElement) + 1;
        tagName += `[${index}]`;
      }

      parts.unshift(tagName);
      current = current.parentNode;
    }

    return '/' + parts.join('/');
  }
} 