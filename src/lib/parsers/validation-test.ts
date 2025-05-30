/**
 * Comprehensive validation test suite
 * Tests all validators with sample XLIFF documents
 */

import {
  XLIFFDocument,
  XLIFFVersion,
  XLIFFFile,
  XLIFFTransUnit,
  XLIFFBody,
  XLIFFParsingError,
  ErrorSeverity
} from './types';

import {
  ValidatorFactory,
  ValidationResultAggregator,
  StructuralValidator,
  LanguageValidator,
  ContentValidator,
  ConsistencyValidator,
  XLIFF12Validator,
  XLIFF20Validator,
  MXLIFFValidator,
  SchemaValidator,
  BusinessRulesValidator,
  BusinessRule
} from './validation';

/**
 * Test validation system with various scenarios
 */
export async function runValidationTests(): Promise<void> {
  console.log('🧪 Running XLIFF Validation Tests...\n');

  // Test 1: Valid XLIFF 1.2 document
  await testValidXLIFF12();
  
  // Test 2: Invalid XLIFF 1.2 document
  await testInvalidXLIFF12();
  
  // Test 3: Valid XLIFF 2.0 document
  await testValidXLIFF20();
  
  // Test 4: Invalid XLIFF 2.0 document
  await testInvalidXLIFF20();
  
  // Test 5: Valid MXLIFF document
  await testValidMXLIFF();
  
  // Test 6: Invalid MXLIFF document
  await testInvalidMXLIFF();
  
  // Test 7: Business rules validation
  await testBusinessRules();
  
  // Test 8: Version-specific validator factory
  await testValidatorFactory();
  
  // Test 9: Validation result aggregation
  await testValidationAggregation();

  console.log('✅ All validation tests completed!\n');
}

async function testValidXLIFF12(): Promise<void> {
  console.log('📝 Test 1: Valid XLIFF 1.2 Document');
  
  const validDoc: XLIFFDocument = {
    version: XLIFFVersion.V1_2,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2',
    files: [{
      original: 'test.properties',
      sourceLanguage: 'en-US',
      targetLanguage: 'fr-FR',
      datatype: 'plaintext',
      tool: 'TestTool',
      attributes: {},
      metadata: {},
      body: {
        transUnits: [{
          id: 'hello',
          source: 'Hello World',
          target: 'Bonjour le Monde',
          state: 'final',
          attributes: {},
          notes: [],
          altTrans: [],
          inlineElements: [],
          metadata: {}
        }],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="test.properties" source-language="en-US" target-language="fr-FR" datatype="plaintext">
    <body>
      <trans-unit id="hello">
        <source>Hello World</source>
        <target state="final">Bonjour le Monde</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V1_2);
  const result = ValidationResultAggregator.aggregate(validDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  
  if (result.summary.totalIssues > 0) {
    console.log('   Issues:');
    result.errors.concat(result.warnings).forEach((error, index) => {
      console.log(`     ${index + 1}. [${error.severity}] ${error.message}`);
    });
  }
  console.log();
}

async function testInvalidXLIFF12(): Promise<void> {
  console.log('📝 Test 2: Invalid XLIFF 1.2 Document');
  
  const invalidDoc: XLIFFDocument = {
    version: XLIFFVersion.V1_2,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2',
    files: [{
      original: '', // Missing required attribute
      sourceLanguage: 'en_US', // Should be en-US
      targetLanguage: '',
      datatype: '', // Missing required attribute
      attributes: {},
      metadata: {},
      body: {
        transUnits: [
          {
            id: '', // Missing required ID
            source: '', // Empty source
            target: 'Some target',
            state: 'invalid-state', // Invalid state
            attributes: {},
            notes: [],
            altTrans: [],
            inlineElements: [],
            metadata: {}
          },
          {
            id: 'duplicate',
            source: 'Source 1',
            target: 'Target 1',
            state: 'final',
            attributes: {},
            notes: [],
            altTrans: [],
            inlineElements: [],
            metadata: {}
          },
          {
            id: 'duplicate', // Duplicate ID
            source: 'Source 2',
            target: 'Target 2',
            state: 'final',
            attributes: {},
            notes: [],
            altTrans: [],
            inlineElements: [],
            metadata: {}
          }
        ],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="" source-language="en_US" datatype="">
    <body>
      <trans-unit id="">
        <source></source>
        <target state="invalid-state">Some target</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V1_2);
  const result = ValidationResultAggregator.aggregate(invalidDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  console.log(`   Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
  
  console.log('   Top issues found:');
  result.errors.concat(result.warnings).slice(0, 5).forEach((error, index) => {
    console.log(`     ${index + 1}. [${error.severity}] ${error.message}`);
  });
  console.log();
}

async function testValidXLIFF20(): Promise<void> {
  console.log('📝 Test 3: Valid XLIFF 2.0 Document');
  
  const validDoc: XLIFFDocument = {
    version: XLIFFVersion.V2_0,
    xmlns: 'urn:oasis:names:tc:xliff:document:2.0',
    files: [{
      original: 'test.properties',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      datatype: 'plaintext',
      attributes: {
        id: 'file1',
        srcLang: 'en',
        trgLang: 'fr'
      },
      metadata: {},
      body: {
        transUnits: [{
          id: 'unit1',
          source: 'Hello World',
          target: 'Bonjour le Monde',
          state: 'final',
          attributes: {},
          notes: [],
          altTrans: [],
          inlineElements: [],
          metadata: {}
        }],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0">
  <file id="file1" srcLang="en" trgLang="fr" original="test.properties">
    <unit id="unit1">
      <segment>
        <source>Hello World</source>
        <target state="final">Bonjour le Monde</target>
      </segment>
    </unit>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V2_0);
  const result = ValidationResultAggregator.aggregate(validDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  console.log();
}

async function testInvalidXLIFF20(): Promise<void> {
  console.log('📝 Test 4: Invalid XLIFF 2.0 Document');
  
  const invalidDoc: XLIFFDocument = {
    version: XLIFFVersion.V2_0,
    xmlns: 'http://wrong-namespace.com',
    files: [{
      original: 'test.properties',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      datatype: 'plaintext',
      attributes: {}, // Missing required id for XLIFF 2.0
      metadata: {},
      body: {
        transUnits: [{
          id: 'unit1',
          source: 'Hello World',
          target: 'Bonjour le Monde',
          state: 'invalid-xliff20-state', // Invalid XLIFF 2.0 state
          attributes: {},
          notes: [],
          altTrans: [],
          inlineElements: [],
          metadata: {}
        }],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="http://wrong-namespace.com">
  <file srcLang="en" trgLang="fr" original="test.properties">
    <unit id="unit1">
      <segment>
        <source>Hello World</source>
        <target state="invalid-xliff20-state">Bonjour le Monde</target>
      </segment>
    </unit>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V2_0);
  const result = ValidationResultAggregator.aggregate(invalidDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  
  console.log('   Issues found:');
  result.errors.concat(result.warnings).slice(0, 3).forEach((error, index) => {
    console.log(`     ${index + 1}. [${error.severity}] ${error.message}`);
  });
  console.log();
}

async function testValidMXLIFF(): Promise<void> {
  console.log('📝 Test 5: Valid MXLIFF Document');
  
  const validDoc: XLIFFDocument = {
    version: XLIFFVersion.MXLIFF,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2 xmlns:mxliff="urn:microsoft:xliff"',
    files: [{
      original: 'test.resx',
      sourceLanguage: 'en-US',
      targetLanguage: 'fr-FR',
      datatype: 'resx',
      tool: 'Microsoft Translator',
      toolId: 'Microsoft',
      attributes: {},
      metadata: {},
      body: {
        transUnits: [{
          id: 'hello',
          source: 'Hello World',
          target: 'Bonjour le Monde',
          state: 'approved', // MXLIFF extension
          attributes: {
            'mxliff:approved': 'true',
            'mxliff:state': 'final'
          },
          notes: [],
          altTrans: [],
          inlineElements: [],
          metadata: {}
        }],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:mxliff="urn:microsoft:xliff">
  <file original="test.resx" source-language="en-US" target-language="fr-FR" datatype="resx" tool-id="Microsoft">
    <body>
      <trans-unit id="hello" mxliff:approved="true">
        <source>Hello World</source>
        <target state="approved">Bonjour le Monde</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.MXLIFF);
  const result = ValidationResultAggregator.aggregate(validDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  console.log();
}

async function testInvalidMXLIFF(): Promise<void> {
  console.log('📝 Test 6: Invalid MXLIFF Document');
  
  const invalidDoc: XLIFFDocument = {
    version: XLIFFVersion.MXLIFF,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2', // Missing Microsoft namespace
    files: [{
      original: 'test.resx',
      sourceLanguage: 'en-US',
      targetLanguage: 'fr-FR',
      datatype: 'resx',
      tool: 'Generic Tool', // Should be Microsoft tool
      attributes: {},
      metadata: {},
      body: {
        transUnits: [{
          id: 'hello',
          source: 'Hello World',
          target: 'Bonjour le Monde',
          state: 'final',
          attributes: {}, // Missing Microsoft-specific attributes
          notes: [],
          altTrans: [],
          inlineElements: [],
          metadata: {}
        }],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    originalXML: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="test.resx" source-language="en-US" target-language="fr-FR" datatype="resx" tool="Generic Tool">
    <body>
      <trans-unit id="hello">
        <source>Hello World</source>
        <target state="final">Bonjour le Monde</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.MXLIFF);
  const result = ValidationResultAggregator.aggregate(invalidDoc, validators);
  
  console.log(`   Validators tested: ${validators.length}`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  
  console.log('   Issues found:');
  result.errors.concat(result.warnings).slice(0, 3).forEach((error, index) => {
    console.log(`     ${index + 1}. [${error.severity}] ${error.message}`);
  });
  console.log();
}

async function testBusinessRules(): Promise<void> {
  console.log('📝 Test 7: Business Rules Validation');
  
  // Create a custom business rule
  const customRule: BusinessRule = {
    name: 'NoEmptyTargetsRule',
    description: 'Ensures no translation units have empty targets when marked as final',
    validate: (document: XLIFFDocument): XLIFFParsingError[] => {
      const errors: XLIFFParsingError[] = [];
      document.files.forEach(file => {
        file.getAllTransUnits().forEach(unit => {
          if (unit.state === 'final' && (!unit.target || unit.target.trim().length === 0)) {
            errors.push({
              type: 'validation_error' as any,
              severity: ErrorSeverity.MAJOR,
              message: `Final translation unit ${unit.id} has empty target`,
              details: { unitId: unit.id, fileName: file.original }
            });
          }
        });
      });
      return errors;
    }
  };

  const testDoc: XLIFFDocument = {
    version: XLIFFVersion.V1_2,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2',
    files: [{
      original: 'test.properties',
      sourceLanguage: 'en-US',
      datatype: 'plaintext',
      attributes: {},
      metadata: {},
      body: {
        transUnits: [
          {
            id: 'good_unit',
            source: 'Hello',
            target: 'Bonjour',
            state: 'final',
            attributes: {},
            notes: [],
            altTrans: [],
            inlineElements: [],
            metadata: {}
          },
          {
            id: 'bad_unit',
            source: 'World',
            target: '', // Empty target but marked as final
            state: 'final',
            attributes: {},
            notes: [],
            altTrans: [],
            inlineElements: [],
            metadata: {}
          }
        ],
        groups: [],
        binUnits: [],
        attributes: {},
        getAllTransUnits: function() { return this.transUnits; },
        getTotalSegmentCount: function() { return this.transUnits.length; }
      },
      getAllTransUnits: function() { return this.body.getAllTransUnits(); },
      getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
    }],
    attributes: {},
    metadata: {},
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getCompleteValidatorSet(XLIFFVersion.V1_2, [customRule]);
  const result = ValidationResultAggregator.aggregate(testDoc, validators);
  
  console.log(`   Validators tested: ${validators.length} (including custom business rule)`);
  console.log(`   Issues found: ${result.summary.totalIssues}`);
  console.log(`   Custom rule violations: ${result.errors.filter(e => e.details?.ruleName || e.message.includes('bad_unit')).length}`);
  console.log();
}

async function testValidatorFactory(): Promise<void> {
  console.log('📝 Test 8: Validator Factory');
  
  const xliff12Validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V1_2);
  const xliff20Validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V2_0);
  const mxliffValidators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.MXLIFF);
  const coreValidators = ValidatorFactory.getCoreValidators();
  
  console.log(`   Core validators: ${coreValidators.length}`);
  console.log(`   XLIFF 1.2 validators: ${xliff12Validators.length}`);
  console.log(`   XLIFF 2.0 validators: ${xliff20Validators.length}`);
  console.log(`   MXLIFF validators: ${mxliffValidators.length}`);
  
  // Test custom validator creation
  const customValidator = ValidatorFactory.createCustomValidator(
    'TestValidator',
    'Test custom validator',
    () => []
  );
  
  console.log(`   Custom validator created: ${customValidator.name}`);
  console.log();
}

async function testValidationAggregation(): Promise<void> {
  console.log('📝 Test 9: Validation Result Aggregation');
  
  // Create a document with multiple types of issues
  const testDoc: XLIFFDocument = {
    version: XLIFFVersion.V1_2,
    xmlns: 'urn:oasis:names:tc:xliff:document:1.2',
    files: [
      {
        original: '', // Missing - MAJOR error
        sourceLanguage: 'invalid_lang', // Invalid - MAJOR error  
        targetLanguage: 'en-US', // Same as source - WARNING
        datatype: '', // Missing - MAJOR error
        attributes: {},
        metadata: {},
        body: {
          transUnits: [
            {
              id: '', // Missing - MAJOR error
              source: '', // Empty - MAJOR error
              target: 'Some target',
              state: 'invalid', // Invalid - WARNING
              attributes: {},
              notes: [],
              altTrans: [],
              inlineElements: [],
              metadata: {}
            }
          ],
          groups: [],
          binUnits: [],
          attributes: {},
          getAllTransUnits: function() { return this.transUnits; },
          getTotalSegmentCount: function() { return this.transUnits.length; }
        },
        getAllTransUnits: function() { return this.body.getAllTransUnits(); },
        getTotalSegmentCount: function() { return this.body.getTotalSegmentCount(); }
      }
    ],
    attributes: {},
    metadata: {},
    getTotalSegmentCount: function() { return this.files.reduce((sum, file) => sum + file.getTotalSegmentCount(), 0); }
  };

  const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V1_2);
  const result = ValidationResultAggregator.aggregate(testDoc, validators);
  
  console.log(`   Total issues: ${result.summary.totalIssues}`);
  console.log(`   Critical: ${result.summary.criticalCount}`);
  console.log(`   Major: ${result.summary.majorCount}`);
  console.log(`   Minor: ${result.summary.minorCount}`);
  console.log(`   Warnings: ${result.summary.warningCount}`);
  console.log(`   Valid: ${result.isValid ? '✅' : '❌'}`);
  
  console.log('   Validator breakdown:');
  result.summary.validatorResults.forEach(vr => {
    console.log(`     ${vr.name}: ${vr.errorCount} errors, ${vr.warningCount} warnings`);
  });
  console.log();
}

// Example usage function
export function demonstrateValidation(): void {
  console.log('🔍 XLIFF Validation Framework Demo\n');
  
  console.log('Available Validators:');
  console.log('- StructuralValidator: Validates document structure');
  console.log('- LanguageValidator: Validates language codes');
  console.log('- ContentValidator: Validates content consistency');
  console.log('- ConsistencyValidator: Validates cross-document consistency');
  console.log('- XLIFF12Validator: XLIFF 1.2 specific validation');
  console.log('- XLIFF20Validator: XLIFF 2.0 specific validation');
  console.log('- MXLIFFValidator: Microsoft XLIFF specific validation');
  console.log('- SchemaValidator: XML schema validation');
  console.log('- BusinessRulesValidator: Custom business rules\n');
  
  console.log('Usage Examples:');
  console.log('```typescript');
  console.log('// Get validators for specific version');
  console.log('const validators = ValidatorFactory.getValidatorsForVersion(XLIFFVersion.V1_2);');
  console.log('');
  console.log('// Run validation');
  console.log('const result = ValidationResultAggregator.aggregate(document, validators);');
  console.log('');
  console.log('// Check results');
  console.log('console.log(`Valid: ${result.isValid}`);');
  console.log('console.log(`Errors: ${result.errors.length}`);');
  console.log('console.log(`Warnings: ${result.warnings.length}`);');
  console.log('```\n');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runValidationTests().catch(console.error);
} 