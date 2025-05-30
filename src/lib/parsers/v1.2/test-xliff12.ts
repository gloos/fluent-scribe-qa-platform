/**
 * XLIFF 1.2 Parser Test/Demo
 * Contains sample XLIFF 1.2 content for testing the parser
 */

import { XLIFF12Parser } from './XLIFF12Parser';
import { XLIFFParsingOptions } from '../types';

/**
 * Sample XLIFF 1.2 document for testing
 */
export const sampleXLIFF12 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="sample.txt" source-language="en" target-language="es" datatype="plaintext">
    <header>
      <note>Sample XLIFF 1.2 file for testing</note>
      <prop prop-type="x-filename">sample.txt</prop>
    </header>
    <body>
      <trans-unit id="1">
        <source>Hello World</source>
        <target state="translated">Hola Mundo</target>
        <note>Simple greeting</note>
      </trans-unit>
      <trans-unit id="2">
        <source>Welcome to our application</source>
        <target state="new">Bienvenido a nuestra aplicación</target>
      </trans-unit>
      <group id="messages" restype="x-messages">
        <trans-unit id="3">
          <source>Save</source>
          <target state="final">Guardar</target>
        </trans-unit>
        <trans-unit id="4">
          <source>Cancel</source>
          <target state="translated">Cancelar</target>
        </trans-unit>
      </group>
    </body>
  </file>
</xliff>`;

/**
 * Sample XLIFF 1.2 with inline elements
 */
export const sampleXLIFF12WithInlines = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="markup.html" source-language="en" target-language="fr" datatype="html">
    <body>
      <trans-unit id="1">
        <source>Click <g id="1" ctype="link">here</g> to continue</source>
        <target state="translated">Cliquez <g id="1" ctype="link">ici</g> pour continuer</target>
      </trans-unit>
      <trans-unit id="2">
        <source>Enter your <ph id="1" ctype="x-html-input"/>name</source>
        <target state="new">Entrez votre <ph id="1" ctype="x-html-input"/>nom</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

/**
 * Test function to demonstrate parser usage
 */
export async function testXLIFF12Parser(): Promise<void> {
  console.log('Testing XLIFF 1.2 Parser...');
  
  const parser = new XLIFF12Parser();
  
  // Test version detection
  console.log('Testing version detection...');
  const isXliff12 = parser.detectVersion(sampleXLIFF12);
  console.log(`XLIFF 1.2 detected: ${isXliff12}`);
  
  // Test parsing
  console.log('\nTesting parsing...');
  const options: XLIFFParsingOptions = {
    validateSchema: true,
    extractMetadata: true,
    preserveWhitespace: false
  };
  
  try {
    const result = await parser.parse(sampleXLIFF12, options);
    
    console.log(`Parse successful: ${result.success}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Total files: ${result.metadata.totalFiles}`);
    console.log(`Total segments: ${result.metadata.totalSegments}`);
    console.log(`Parse time: ${result.metadata.parseTime}ms`);
    
    if (result.document) {
      const doc = result.document;
      console.log(`\nDocument summary:`);
      console.log(`- Version: ${doc.version}`);
      console.log(`- Files: ${doc.files.length}`);
      console.log(`- Total segments: ${doc.getTotalSegmentCount()}`);
      
      // Display first file details
      if (doc.files.length > 0) {
        const file = doc.files[0];
        console.log(`\nFirst file details:`);
        console.log(`- Original: ${file.original}`);
        console.log(`- Source language: ${file.sourceLanguage}`);
        console.log(`- Target language: ${file.targetLanguage}`);
        console.log(`- Datatype: ${file.datatype}`);
        console.log(`- Translation units: ${file.getAllTransUnits().length}`);
        
        // Display first few translation units
        const transUnits = file.getAllTransUnits();
        console.log(`\nFirst translation units:`);
        transUnits.slice(0, 3).forEach((unit, index) => {
          console.log(`  ${index + 1}. ID: ${unit.id}`);
          console.log(`     Source: "${unit.source}"`);
          console.log(`     Target: "${unit.target || 'N/A'}"`);
          console.log(`     State: ${unit.state || 'N/A'}`);
        });
      }
      
      // Test serialization
      console.log('\nTesting serialization...');
      const serialized = parser.serialize(doc);
      console.log(`Serialized length: ${serialized.length} characters`);
      console.log('Serialization completed successfully');
      
    }
    
  } catch (error) {
    console.error('Parse failed:', error);
  }
  
  // Test with inline elements
  console.log('\n\nTesting with inline elements...');
  try {
    const inlineResult = await parser.parse(sampleXLIFF12WithInlines, options);
    
    if (inlineResult.document && inlineResult.document.files.length > 0) {
      const file = inlineResult.document.files[0];
      const transUnits = file.getAllTransUnits();
      
      console.log(`Translation units with inline elements:`);
      transUnits.forEach((unit, index) => {
        console.log(`  ${index + 1}. ID: ${unit.id}`);
        console.log(`     Source: "${unit.source}"`);
        console.log(`     Target: "${unit.target || 'N/A'}"`);
        console.log(`     Inline elements: ${unit.inlineElements.length}`);
      });
    }
    
  } catch (error) {
    console.error('Inline parsing failed:', error);
  }
  
  console.log('\nXLIFF 1.2 Parser test completed!');
}

// Export for use in development/testing
export { XLIFF12Parser }; 