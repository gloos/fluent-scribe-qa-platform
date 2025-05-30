/**
 * XLIFF Validation Framework
 * Provides validation interfaces and built-in validators
 */

import {
  XLIFFValidator,
  XLIFFDocument,
  XLIFFParsingError,
  XLIFFErrorType,
  ErrorSeverity,
  XLIFFFile,
  XLIFFTransUnit,
  XLIFFVersion
} from './types';

/**
 * Base validator class with common functionality
 */
export abstract class BaseXLIFFValidator implements XLIFFValidator {
  public abstract name: string;
  public abstract description: string;

  public abstract validate(document: XLIFFDocument): XLIFFParsingError[];

  /**
   * Create a validation error
   */
  protected createError(
    type: XLIFFErrorType,
    severity: ErrorSeverity,
    message: string,
    details?: Record<string, any>
  ): XLIFFParsingError {
    return {
      type,
      severity,
      message,
      details: {
        validator: this.name,
        ...details
      }
    };
  }

  /**
   * Validate language code format
   */
  protected validateLanguageCode(code: string): boolean {
    // Basic language code validation (RFC 5646)
    const languageCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?(-[a-z0-9]+)*$/i;
    return languageCodePattern.test(code);
  }

  /**
   * Check if a string is empty or only whitespace
   */
  protected isEmpty(value: string | undefined | null): boolean {
    return !value || value.trim().length === 0;
  }
}

/**
 * Structural validator - checks document structure
 */
export class StructuralValidator extends BaseXLIFFValidator {
  public name = 'StructuralValidator';
  public description = 'Validates XLIFF document structure and required elements';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Validate document has files
    if (!document.files || document.files.length === 0) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.CRITICAL,
        'Document must contain at least one file element'
      ));
      return errors; // Can't continue without files
    }

    // Validate each file
    document.files.forEach((file, index) => {
      errors.push(...this.validateFile(file, index));
    });

    return errors;
  }

  private validateFile(file: XLIFFFile, index: number): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    const fileContext = { fileIndex: index, fileName: file.original };

    // Required attributes
    if (this.isEmpty(file.original)) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have an "original" attribute',
        fileContext
      ));
    }

    if (this.isEmpty(file.sourceLanguage)) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have a "source-language" attribute',
        fileContext
      ));
    }

    if (this.isEmpty(file.datatype)) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.MAJOR,
        'File element must have a "datatype" attribute',
        fileContext
      ));
    }

    // Body is required
    if (!file.body) {
      errors.push(this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.CRITICAL,
        'File element must contain a body element',
        fileContext
      ));
      return errors; // Can't continue without body
    }

    // Validate translation units
    const allTransUnits = file.getAllTransUnits();
    if (allTransUnits.length === 0) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.WARNING,
        'File body contains no translation units',
        fileContext
      ));
    }

    // Check for duplicate translation unit IDs within file
    const transUnitIds = new Set<string>();
    const duplicateIds: string[] = [];

    allTransUnits.forEach((unit, unitIndex) => {
      if (!unit.id || this.isEmpty(unit.id)) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          'Translation unit must have an "id" attribute',
          { ...fileContext, unitIndex, unitId: unit.id }
        ));
      } else {
        if (transUnitIds.has(unit.id)) {
          duplicateIds.push(unit.id);
        } else {
          transUnitIds.add(unit.id);
        }
      }

      if (this.isEmpty(unit.source)) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          'Translation unit must have source content',
          { ...fileContext, unitIndex, unitId: unit.id }
        ));
      }
    });

    // Report duplicate IDs
    duplicateIds.forEach(id => {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.MAJOR,
        `Duplicate translation unit ID: ${id}`,
        { ...fileContext, duplicateId: id }
      ));
    });

    return errors;
  }
}

/**
 * Language validator - validates language codes and consistency
 */
export class LanguageValidator extends BaseXLIFFValidator {
  public name = 'LanguageValidator';
  public description = 'Validates language codes and language consistency';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    document.files.forEach((file, index) => {
      const fileContext = { fileIndex: index, fileName: file.original };

      // Validate source language
      if (file.sourceLanguage && !this.validateLanguageCode(file.sourceLanguage)) {
        errors.push(this.createError(
          XLIFFErrorType.INVALID_ATTRIBUTE,
          ErrorSeverity.MAJOR,
          `Invalid source language code: ${file.sourceLanguage}`,
          { ...fileContext, languageCode: file.sourceLanguage }
        ));
      }

      // Validate target language
      if (file.targetLanguage && !this.validateLanguageCode(file.targetLanguage)) {
        errors.push(this.createError(
          XLIFFErrorType.INVALID_ATTRIBUTE,
          ErrorSeverity.MAJOR,
          `Invalid target language code: ${file.targetLanguage}`,
          { ...fileContext, languageCode: file.targetLanguage }
        ));
      }

      // Check if source and target languages are the same
      if (file.sourceLanguage && file.targetLanguage && 
          file.sourceLanguage === file.targetLanguage) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'Source and target languages are identical',
          { ...fileContext, sourceLanguage: file.sourceLanguage, targetLanguage: file.targetLanguage }
        ));
      }
    });

    return errors;
  }
}

/**
 * Content validator - validates translation unit content
 */
export class ContentValidator extends BaseXLIFFValidator {
  public name = 'ContentValidator';
  public description = 'Validates translation unit content and consistency';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };
      const allTransUnits = file.getAllTransUnits();

      allTransUnits.forEach((unit, unitIndex) => {
        const unitContext = { ...fileContext, unitIndex, unitId: unit.id };

        // Check for empty source
        if (this.isEmpty(unit.source)) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.MAJOR,
            'Translation unit has empty source content',
            unitContext
          ));
        }

        // Check for inconsistent translation state
        if (unit.target && !this.isEmpty(unit.target)) {
          if (unit.state === 'new' || unit.state === 'needs-translation') {
            errors.push(this.createError(
              XLIFFErrorType.VALIDATION_ERROR,
              ErrorSeverity.WARNING,
              `Translation unit has target content but state is "${unit.state}"`,
              { ...unitContext, state: unit.state }
            ));
          }
        } else {
          if (unit.state === 'final' || unit.state === 'translated') {
            errors.push(this.createError(
              XLIFFErrorType.VALIDATION_ERROR,
              ErrorSeverity.WARNING,
              `Translation unit is marked as "${unit.state}" but has no target content`,
              { ...unitContext, state: unit.state }
            ));
          }
        }

        // Check for potential encoding issues
        if (this.hasEncodingIssues(unit.source)) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.MINOR,
            'Source content may have encoding issues',
            { ...unitContext, content: unit.source.substring(0, 100) }
          ));
        }

        if (unit.target && this.hasEncodingIssues(unit.target)) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.MINOR,
            'Target content may have encoding issues',
            { ...unitContext, content: unit.target.substring(0, 100) }
          ));
        }
      });
    });

    return errors;
  }

  private hasEncodingIssues(text: string): boolean {
    // Check for common encoding issue patterns
    const encodingIssuePatterns = [
      /�/, // Replacement character
      /&[a-zA-Z0-9#]+;/, // HTML entities that should be decoded
      /[\u0000-\u001F\u007F-\u009F]/, // Control characters
    ];

    return encodingIssuePatterns.some(pattern => pattern.test(text));
  }
}

/**
 * Consistency validator - checks for consistency across the document
 */
export class ConsistencyValidator extends BaseXLIFFValidator {
  public name = 'ConsistencyValidator';
  public description = 'Validates consistency across translation units and files';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Check for consistent source/target language across files
    const sourceLanguages = new Set<string>();
    const targetLanguages = new Set<string>();

    document.files.forEach(file => {
      if (file.sourceLanguage) sourceLanguages.add(file.sourceLanguage);
      if (file.targetLanguage) targetLanguages.add(file.targetLanguage);
    });

    if (sourceLanguages.size > 1) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.WARNING,
        `Multiple source languages found in document: ${Array.from(sourceLanguages).join(', ')}`,
        { sourceLanguages: Array.from(sourceLanguages) }
      ));
    }

    if (targetLanguages.size > 1) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.WARNING,
        `Multiple target languages found in document: ${Array.from(targetLanguages).join(', ')}`,
        { targetLanguages: Array.from(targetLanguages) }
      ));
    }

    // Check for duplicate source content with different targets
    this.validateTranslationConsistency(document, errors);

    return errors;
  }

  private validateTranslationConsistency(
    document: XLIFFDocument,
    errors: XLIFFParsingError[]
  ): void {
    const sourceToTargets = new Map<string, Array<{
      target: string;
      fileIndex: number;
      fileName: string;
      unitId: string;
    }>>();

    // Collect all source -> target mappings
    document.files.forEach((file, fileIndex) => {
      const allTransUnits = file.getAllTransUnits();
      
      allTransUnits.forEach(unit => {
        if (unit.source && unit.target && !this.isEmpty(unit.target)) {
          const normalizedSource = unit.source.trim();
          
          if (!sourceToTargets.has(normalizedSource)) {
            sourceToTargets.set(normalizedSource, []);
          }

          sourceToTargets.get(normalizedSource)!.push({
            target: unit.target.trim(),
            fileIndex,
            fileName: file.original,
            unitId: unit.id
          });
        }
      });
    });

    // Find inconsistent translations
    sourceToTargets.forEach((targets, source) => {
      if (targets.length > 1) {
        const uniqueTargets = new Set(targets.map(t => t.target));
        
        if (uniqueTargets.size > 1) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.WARNING,
            'Inconsistent translations found for identical source text',
            {
              source: source.substring(0, 100),
              targets: Array.from(uniqueTargets),
              occurrences: targets.map(t => ({
                file: t.fileName,
                unitId: t.unitId,
                target: t.target.substring(0, 100)
              }))
            }
          ));
        }
      }
    });
  }
}

/**
 * XLIFF 1.2 specific validator
 */
export class XLIFF12Validator extends BaseXLIFFValidator {
  public name = 'XLIFF12Validator';
  public description = 'Validates XLIFF 1.2 specific requirements and conventions';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Validate XLIFF 1.2 version
    if (document.version !== XLIFFVersion.V1_2) {
      return errors; // Skip if not XLIFF 1.2
    }

    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };

      // XLIFF 1.2 specific: datatype is required
      if (this.isEmpty(file.datatype)) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          'XLIFF 1.2 requires datatype attribute on file element',
          fileContext
        ));
      }

      // XLIFF 1.2 specific: source-language format
      if (file.sourceLanguage && file.sourceLanguage.includes('_')) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'XLIFF 1.2 typically uses hyphens in language codes, not underscores',
          { ...fileContext, sourceLanguage: file.sourceLanguage }
        ));
      }

      // Check trans-unit specific requirements
      const allTransUnits = file.getAllTransUnits();
      allTransUnits.forEach((unit, unitIndex) => {
        const unitContext = { ...fileContext, unitIndex, unitId: unit.id };

        // XLIFF 1.2 specific: resname validation
        if (unit.resname && unit.resname.length > 100) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.WARNING,
            'Resource name (resname) is unusually long for XLIFF 1.2',
            { ...unitContext, resname: unit.resname.substring(0, 50) + '...' }
          ));
        }

        // XLIFF 1.2 specific: state attribute validation
        if (unit.state) {
          const validStates = ['new', 'needs-translation', 'needs-l10n', 'needs-review-adaptation', 
                               'needs-review-l10n', 'needs-review-translation', 'final', 'signed-off', 'translated'];
          if (!validStates.includes(unit.state)) {
            errors.push(this.createError(
              XLIFFErrorType.INVALID_ATTRIBUTE,
              ErrorSeverity.WARNING,
              `Invalid state value for XLIFF 1.2: ${unit.state}`,
              { ...unitContext, state: unit.state, validStates }
            ));
          }
        }
      });
    });

    return errors;
  }
}

/**
 * XLIFF 2.0 specific validator
 */
export class XLIFF20Validator extends BaseXLIFFValidator {
  public name = 'XLIFF20Validator';
  public description = 'Validates XLIFF 2.0 specific requirements and conventions';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Validate XLIFF 2.0 version
    if (document.version !== XLIFFVersion.V2_0) {
      return errors; // Skip if not XLIFF 2.0
    }

    // XLIFF 2.0 specific: namespace validation
    if (!document.xmlns || !document.xmlns.includes('urn:oasis:names:tc:xliff:document:2.0')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.MAJOR,
        'XLIFF 2.0 document must have correct namespace',
        { xmlns: document.xmlns }
      ));
    }

    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };

      // XLIFF 2.0 specific: file id is required
      if (!file.attributes?.id) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          'XLIFF 2.0 requires id attribute on file element',
          fileContext
        ));
      }

      // XLIFF 2.0 uses srcLang/trgLang instead of source-language/target-language
      if (file.sourceLanguage && !file.attributes?.srcLang) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'XLIFF 2.0 should use srcLang attribute instead of source-language',
          fileContext
        ));
      }

      if (file.targetLanguage && !file.attributes?.trgLang) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'XLIFF 2.0 should use trgLang attribute instead of target-language',
          fileContext
        ));
      }

      // Check unit structure (XLIFF 2.0 uses units instead of trans-units)
      const allTransUnits = file.getAllTransUnits();
      allTransUnits.forEach((unit, unitIndex) => {
        const unitContext = { ...fileContext, unitIndex, unitId: unit.id };

        // XLIFF 2.0 specific: state attribute validation
        if (unit.state) {
          const validStates = ['initial', 'translated', 'reviewed', 'final'];
          if (!validStates.includes(unit.state)) {
            errors.push(this.createError(
              XLIFFErrorType.INVALID_ATTRIBUTE,
              ErrorSeverity.WARNING,
              `Invalid state value for XLIFF 2.0: ${unit.state}`,
              { ...unitContext, state: unit.state, validStates }
            ));
          }
        }
      });
    });

    return errors;
  }
}

/**
 * MXLIFF specific validator
 */
export class MXLIFFValidator extends BaseXLIFFValidator {
  public name = 'MXLIFFValidator';
  public description = 'Validates Microsoft XLIFF (MXLIFF) specific requirements';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Validate MXLIFF version
    if (document.version !== XLIFFVersion.MXLIFF) {
      return errors; // Skip if not MXLIFF
    }

    // MXLIFF specific: should have Microsoft namespace
    if (!document.xmlns || (!document.xmlns.includes('mxliff') && !document.xmlns.includes('microsoft'))) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.WARNING,
        'MXLIFF document should include Microsoft namespace declarations',
        { xmlns: document.xmlns }
      ));
    }

    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };

      // MXLIFF specific: tool information validation
      if (file.tool && !file.tool.toLowerCase().includes('microsoft')) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'MXLIFF file should indicate Microsoft tool usage',
          { ...fileContext, tool: file.tool }
        ));
      }

      // Check for Microsoft-specific attributes
      const allTransUnits = file.getAllTransUnits();
      allTransUnits.forEach((unit, unitIndex) => {
        const unitContext = { ...fileContext, unitIndex, unitId: unit.id };

        // MXLIFF specific: check for Microsoft custom attributes
        const hasMicrosoftAttrs = Object.keys(unit.attributes).some(key => 
          key.startsWith('mxliff:') || key.startsWith('microsoft:')
        );

        if (!hasMicrosoftAttrs && unit.attributes && Object.keys(unit.attributes).length > 0) {
          errors.push(this.createError(
            XLIFFErrorType.VALIDATION_ERROR,
            ErrorSeverity.MINOR,
            'MXLIFF typically includes Microsoft-specific attributes',
            { ...unitContext, attributes: Object.keys(unit.attributes) }
          ));
        }

        // MXLIFF specific: state validation (extends XLIFF 1.2 states)
        if (unit.state) {
          const mxliffStates = ['new', 'needs-translation', 'needs-l10n', 'needs-review-adaptation', 
                               'needs-review-l10n', 'needs-review-translation', 'final', 'signed-off', 
                               'translated', 'approved']; // 'approved' is MXLIFF extension
          if (!mxliffStates.includes(unit.state)) {
            errors.push(this.createError(
              XLIFFErrorType.INVALID_ATTRIBUTE,
              ErrorSeverity.WARNING,
              `Unrecognized state value for MXLIFF: ${unit.state}`,
              { ...unitContext, state: unit.state, validStates: mxliffStates }
            ));
          }
        }
      });
    });

    return errors;
  }
}

/**
 * Schema validator for XML schema validation
 */
export class SchemaValidator extends BaseXLIFFValidator {
  public name = 'SchemaValidator';
  public description = 'Validates XLIFF documents against XML schemas';

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Schema validation would require XML Schema (XSD) files and a schema validator
    // For now, we perform basic XML structure validation
    
    // Check for well-formed XML structure
    if (!document.originalXML) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.WARNING,
        'Original XML not available for schema validation',
        { version: document.version }
      ));
      return errors;
    }

    // Basic XML structure checks
    const xmlContent = document.originalXML;
    
    // Check for proper XML declaration
    if (!xmlContent.trim().startsWith('<?xml')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.WARNING,
        'XML document should start with XML declaration',
        {}
      ));
    }

    // Check for proper XLIFF root element
    if (!xmlContent.includes('<xliff')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.CRITICAL,
        'Document must have xliff root element',
        {}
      ));
    }

    // Version-specific schema checks
    switch (document.version) {
      case XLIFFVersion.V1_2:
        this.validateXLIFF12Schema(xmlContent, errors);
        break;
      case XLIFFVersion.V2_0:
        this.validateXLIFF20Schema(xmlContent, errors);
        break;
      case XLIFFVersion.MXLIFF:
        this.validateMXLIFFSchema(xmlContent, errors);
        break;
    }

    return errors;
  }

  private validateXLIFF12Schema(xmlContent: string, errors: XLIFFParsingError[]): void {
    // XLIFF 1.2 specific schema checks
    if (!xmlContent.includes('version="1.2"')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.MAJOR,
        'XLIFF 1.2 document must specify version="1.2"',
        {}
      ));
    }

    // Check for DOCTYPE declaration (optional but common)
    if (xmlContent.includes('<!DOCTYPE xliff')) {
      if (!xmlContent.includes('xliff-core-1.2')) {
        errors.push(this.createError(
          XLIFFErrorType.SCHEMA_ERROR,
          ErrorSeverity.WARNING,
          'XLIFF 1.2 DOCTYPE should reference xliff-core-1.2',
          {}
        ));
      }
    }
  }

  private validateXLIFF20Schema(xmlContent: string, errors: XLIFFParsingError[]): void {
    // XLIFF 2.0 specific schema checks
    if (!xmlContent.includes('version="2.0"')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.MAJOR,
        'XLIFF 2.0 document must specify version="2.0"',
        {}
      ));
    }

    // Check for correct namespace
    if (!xmlContent.includes('urn:oasis:names:tc:xliff:document:2.0')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.MAJOR,
        'XLIFF 2.0 document must have correct namespace',
        {}
      ));
    }
  }

  private validateMXLIFFSchema(xmlContent: string, errors: XLIFFParsingError[]): void {
    // MXLIFF specific schema checks (based on XLIFF 1.2 with Microsoft extensions)
    if (!xmlContent.includes('version="1.2"')) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.MAJOR,
        'MXLIFF document must specify version="1.2"',
        {}
      ));
    }

    // Check for Microsoft namespaces
    const hasMicrosoftNS = xmlContent.includes('xmlns:mxliff') || 
                          xmlContent.includes('xmlns:microsoft') ||
                          xmlContent.includes('tool-id="Microsoft"');
    
    if (!hasMicrosoftNS) {
      errors.push(this.createError(
        XLIFFErrorType.SCHEMA_ERROR,
        ErrorSeverity.WARNING,
        'MXLIFF document should include Microsoft namespace or tool identification',
        {}
      ));
    }
  }
}

/**
 * Business rules validator for project-specific requirements
 */
export class BusinessRulesValidator extends BaseXLIFFValidator {
  public name = 'BusinessRulesValidator';
  public description = 'Validates business rules and project-specific requirements';

  private readonly rules: BusinessRule[];

  constructor(rules: BusinessRule[] = []) {
    super();
    this.rules = rules;
  }

  public validate(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Apply each business rule
    this.rules.forEach(rule => {
      try {
        const ruleErrors = rule.validate(document);
        errors.push(...ruleErrors);
      } catch (error) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.MINOR,
          `Business rule ${rule.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { ruleName: rule.name }
        ));
      }
    });

    // Default business rules
    errors.push(...this.validateDefaultBusinessRules(document));

    return errors;
  }

  private validateDefaultBusinessRules(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];

    // Rule: All files should have target language if any translation exists
    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };
      const hasTranslations = file.getAllTransUnits().some(unit => unit.target && !this.isEmpty(unit.target));
      
      if (hasTranslations && this.isEmpty(file.targetLanguage)) {
        errors.push(this.createError(
          XLIFFErrorType.VALIDATION_ERROR,
          ErrorSeverity.WARNING,
          'File contains translations but no target language specified',
          fileContext
        ));
      }
    });

    // Rule: Check for potential security issues in content
    document.files.forEach((file, fileIndex) => {
      const fileContext = { fileIndex, fileName: file.original };
      const allTransUnits = file.getAllTransUnits();

      allTransUnits.forEach((unit, unitIndex) => {
        const unitContext = { ...fileContext, unitIndex, unitId: unit.id };

        // Check for script tags or potentially dangerous content
        const dangerousPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /vbscript:/gi,
          /onload\s*=/gi,
          /onerror\s*=/gi
        ];

        const contentToCheck = [unit.source, unit.target].filter(Boolean);
        contentToCheck.forEach((content, contentIndex) => {
          if (content) {
            dangerousPatterns.forEach(pattern => {
              if (pattern.test(content)) {
                errors.push(this.createError(
                  XLIFFErrorType.VALIDATION_ERROR,
                  ErrorSeverity.MAJOR,
                  `Potentially dangerous content detected in ${contentIndex === 0 ? 'source' : 'target'}`,
                  { ...unitContext, content: content.substring(0, 100) }
                ));
              }
            });
          }
        });
      });
    });

    return errors;
  }
}

/**
 * Business rule interface for custom project validation
 */
export interface BusinessRule {
  name: string;
  description: string;
  validate(document: XLIFFDocument): XLIFFParsingError[];
}

/**
 * Version-specific validator factory
 */
export class ValidatorFactory {
  private static readonly coreValidators: Array<new () => XLIFFValidator> = [
    StructuralValidator,
    LanguageValidator,
    ContentValidator,
    ConsistencyValidator,
    SchemaValidator
  ];

  private static readonly versionValidators = new Map<XLIFFVersion, Array<new () => XLIFFValidator>>([
    [XLIFFVersion.V1_2, [XLIFF12Validator]],
    [XLIFFVersion.V2_0, [XLIFF20Validator]],
    [XLIFFVersion.MXLIFF, [MXLIFFValidator]]
  ]);

  /**
   * Get all core validators
   */
  public static getCoreValidators(): XLIFFValidator[] {
    return this.coreValidators.map(ValidatorClass => new ValidatorClass());
  }

  /**
   * Get validators appropriate for a specific XLIFF version
   */
  public static getValidatorsForVersion(version: XLIFFVersion): XLIFFValidator[] {
    const validators = this.getCoreValidators();

    // Add version-specific validators
    const versionSpecific = this.versionValidators.get(version);
    if (versionSpecific) {
      validators.push(...versionSpecific.map(ValidatorClass => new ValidatorClass()));
    }

    return validators;
  }

  /**
   * Create a business rules validator with custom rules
   */
  public static createBusinessRulesValidator(rules: BusinessRule[]): BusinessRulesValidator {
    return new BusinessRulesValidator(rules);
  }

  /**
   * Create a custom validator
   */
  public static createCustomValidator(
    name: string,
    description: string,
    validateFn: (document: XLIFFDocument) => XLIFFParsingError[]
  ): XLIFFValidator {
    return {
      name,
      description,
      validate: validateFn
    };
  }

  /**
   * Get all validators for a version including business rules
   */
  public static getCompleteValidatorSet(
    version: XLIFFVersion, 
    businessRules: BusinessRule[] = []
  ): XLIFFValidator[] {
    const validators = this.getValidatorsForVersion(version);
    
    if (businessRules.length > 0) {
      validators.push(this.createBusinessRulesValidator(businessRules));
    }

    return validators;
  }
}

/**
 * Validation result aggregator
 */
export class ValidationResultAggregator {
  /**
   * Aggregate validation results from multiple validators
   */
  public static aggregate(
    document: XLIFFDocument,
    validators: XLIFFValidator[]
  ): {
    isValid: boolean;
    errors: XLIFFParsingError[];
    warnings: XLIFFParsingError[];
    summary: {
      totalIssues: number;
      criticalCount: number;
      majorCount: number;
      minorCount: number;
      warningCount: number;
      validatorResults: Array<{
        name: string;
        description: string;
        errorCount: number;
        warningCount: number;
      }>;
    };
  } {
    const allErrors: XLIFFParsingError[] = [];
    const validatorResults: Array<{
      name: string;
      description: string;
      errorCount: number;
      warningCount: number;
    }> = [];

    // Run all validators
    validators.forEach(validator => {
      try {
        const errors = validator.validate(document);
        allErrors.push(...errors);

        const errorCount = errors.filter(e => 
          e.severity === ErrorSeverity.CRITICAL || 
          e.severity === ErrorSeverity.MAJOR ||
          e.severity === ErrorSeverity.MINOR
        ).length;

        const warningCount = errors.filter(e => 
          e.severity === ErrorSeverity.WARNING
        ).length;

        validatorResults.push({
          name: validator.name,
          description: validator.description,
          errorCount,
          warningCount
        });
      } catch (error) {
        // Validator itself failed
        allErrors.push({
          type: XLIFFErrorType.VALIDATION_ERROR,
          severity: ErrorSeverity.CRITICAL,
          message: `Validator ${validator.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { validator: validator.name }
        });
      }
    });

    // Separate errors and warnings
    const errors = allErrors.filter(e => 
      e.severity === ErrorSeverity.CRITICAL || 
      e.severity === ErrorSeverity.MAJOR ||
      e.severity === ErrorSeverity.MINOR
    );

    const warnings = allErrors.filter(e => e.severity === ErrorSeverity.WARNING);

    // Count by severity
    const criticalCount = allErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
    const majorCount = allErrors.filter(e => e.severity === ErrorSeverity.MAJOR).length;
    const minorCount = allErrors.filter(e => e.severity === ErrorSeverity.MINOR).length;
    const warningCount = warnings.length;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalIssues: allErrors.length,
        criticalCount,
        majorCount,
        minorCount,
        warningCount,
        validatorResults
      }
    };
  }
} 