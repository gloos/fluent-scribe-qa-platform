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
 * Version-specific validator factory
 */
export class ValidatorFactory {
  private static readonly coreValidators: Array<new () => XLIFFValidator> = [
    StructuralValidator,
    LanguageValidator,
    ContentValidator,
    ConsistencyValidator
  ];

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

    // Add version-specific validators here as needed
    switch (version) {
      case XLIFFVersion.V1_2:
        // Add XLIFF 1.2 specific validators
        break;
      case XLIFFVersion.V2_0:
        // Add XLIFF 2.0 specific validators
        break;
      case XLIFFVersion.MXLIFF:
        // Add MXLIFF specific validators
        break;
    }

    return validators;
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