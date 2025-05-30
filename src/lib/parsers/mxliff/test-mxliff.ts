/**
 * Test cases and sample documents for MXLIFF parser
 */

import { MXLIFFParser } from './MXLIFFParser';
import { XLIFFVersion } from '../types';

/**
 * Sample MXLIFF document with Microsoft extensions
 */
export const sampleMXLIFFDocument = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" 
       xmlns:mxliff="urn:microsoft:psi-extension" 
       xmlns:cmxliff="http://schemas.microsoft.com/locstudio/2006/6/lcx">
  <file original="sample.resx" source-language="en-US" target-language="es-ES" 
        datatype="resx" tool-id="Microsoft Localization Studio" 
        tool-name="Microsoft LocStudio" tool-version="8.0">
    <header>
      <prop prop-type="x-filename">sample.resx</prop>
      <prop prop-type="microsoft:tool-version">8.0</prop>
      <note>This is a sample MXLIFF file with Microsoft extensions</note>
    </header>
    <body>
      <trans-unit id="ID_HELLO_WORLD" mxliff:approved="true">
        <source>Hello World!</source>
        <target state="final" mxliff:state="signed-off">¡Hola Mundo!</target>
        <note from="translator">Standard greeting translation</note>
      </trans-unit>
      <trans-unit id="ID_WELCOME_MESSAGE" mxliff:locked="false">
        <source>Welcome to our application</source>
        <target state="translated">Bienvenido a nuestra aplicación</target>
        <alt-trans origin="tm" match-quality="95">
          <source>Welcome to our application</source>
          <target>Bienvenidos a nuestra aplicación</target>
        </alt-trans>
      </trans-unit>
      <group id="MENU_GROUP" restype="menu">
        <trans-unit id="ID_FILE_MENU">
          <source>File</source>
          <target state="final">Archivo</target>
        </trans-unit>
        <trans-unit id="ID_EDIT_MENU">
          <source>Edit</source>
          <target state="needs-review-translation">Editar</target>
        </trans-unit>
      </group>
    </body>
  </file>
</xliff>`;

/**
 * Complex MXLIFF document with inline elements and Microsoft-specific markup
 */
export const complexMXLIFFDocument = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" 
       xmlns:mxliff="urn:microsoft:psi-extension"
       xmlns:microsoft="http://www.microsoft.com/locstudio">
  <file original="complex.xml" source-language="en" target-language="de" 
        datatype="xml" tool-id="Microsoft" tool-name="Microsoft Translator">
    <header>
      <prop prop-type="microsoft:project-id">12345</prop>
      <mxliff:metadata>
        <mxliff:project-version>2.1</mxliff:project-version>
      </mxliff:metadata>
    </header>
    <body>
      <trans-unit id="complex_text" microsoft:complexity="high">
        <source>Click <g id="1" ctype="bold">here</g> to <ph id="2">{action}</ph> the file.</source>
        <target state="translated">Klicken Sie <g id="1" ctype="bold">hier</g>, um die Datei zu <ph id="2">{action}</ph>.</target>
        <note priority="1">Contains placeholders and formatting</note>
      </trans-unit>
      <trans-unit id="error_message" mxliff:category="error">
        <source>Error: The operation failed with code <x id="error_code"/>.</source>
        <target state="needs-translation">Error: Die Operation schlug fehl mit Code <x id="error_code"/>.</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

/**
 * Test the MXLIFF parser with sample documents
 */
export async function testMXLIFFParser(): Promise<void> {
  console.log('Testing MXLIFF Parser...\n');

  const parser = new MXLIFFParser();

  // Test 1: Version detection
  console.log('1. Testing version detection...');
  console.log('Sample MXLIFF:', parser.detectVersion(sampleMXLIFFDocument));
  console.log('Complex MXLIFF:', parser.detectVersion(complexMXLIFFDocument));
  console.log('Regular XLIFF 1.2:', parser.detectVersion(`<?xml version="1.0"?>
    <xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
      <file original="test.txt" source-language="en" datatype="plaintext">
        <body><trans-unit id="1"><source>Test</source></trans-unit></body>
      </file>
    </xliff>`));
  console.log();

  // Test 2: Parse sample document
  try {
    console.log('2. Testing sample document parsing...');
    const result1 = await parser.parse(sampleMXLIFFDocument);
    
    if (!result1.success || !result1.document) {
      console.error('Failed to parse sample document:', result1.errors);
      return;
    }
    
    const document1 = result1.document;
    console.log(`Version: ${document1.version}`);
    console.log(`Files: ${document1.files.length}`);
    console.log(`Total segments: ${document1.getTotalSegmentCount()}`);
    
    const file = document1.files[0];
    console.log(`File original: ${file.original}`);
    console.log(`Source language: ${file.sourceLanguage}`);
    console.log(`Target language: ${file.targetLanguage}`);
    console.log(`Tool: ${file.toolName} (${file.toolId})`);
    
    const allUnits = file.getAllTransUnits();
    console.log(`Translation units: ${allUnits.length}`);
    
    allUnits.forEach((unit, i) => {
      console.log(`  Unit ${i + 1}: "${unit.source}" -> "${unit.target}" (${unit.state})`);
      if (unit.notes.length > 0) {
        console.log(`    Note: ${unit.notes[0].content}`);
      }
    });
    console.log();
    
  } catch (error) {
    console.error('Error parsing sample document:', error);
  }

  // Test 3: Parse complex document
  try {
    console.log('3. Testing complex document parsing...');
    const result2 = await parser.parse(complexMXLIFFDocument);
    
    if (!result2.success || !result2.document) {
      console.error('Failed to parse complex document:', result2.errors);
      return;
    }
    
    const document2 = result2.document;
    const file2 = document2.files[0];
    const complexUnits = file2.getAllTransUnits();
    
    console.log(`Complex document units: ${complexUnits.length}`);
    
    complexUnits.forEach((unit, i) => {
      console.log(`  Unit ${i + 1} (${unit.id}): "${unit.source}"`);
      if (unit.target) {
        console.log(`    -> "${unit.target}" (${unit.state})`);
      }
    });
    console.log();
    
  } catch (error) {
    console.error('Error parsing complex document:', error);
  }

  // Test 4: Serialization round-trip
  try {
    console.log('4. Testing serialization round-trip...');
    const result3 = await parser.parse(sampleMXLIFFDocument);
    
    if (!result3.success || !result3.document) {
      console.error('Failed to parse for serialization test:', result3.errors);
      return;
    }
    
    const document3 = result3.document;
    const serialized = parser.serialize(document3);
    
    console.log('Original size:', sampleMXLIFFDocument.length);
    console.log('Serialized size:', serialized.length);
    
    // Try to parse the serialized version
    const reparsedResult = await parser.parse(serialized);
    if (reparsedResult.success && reparsedResult.document) {
      console.log('Round-trip successful:', reparsedResult.document.files.length === document3.files.length);
    } else {
      console.log('Round-trip failed:', reparsedResult.errors);
    }
    console.log();
    
  } catch (error) {
    console.error('Error in serialization round-trip:', error);
  }

  // Test 5: Normalization
  try {
    console.log('5. Testing MXLIFF normalization...');
    const result4 = await parser.parse(sampleMXLIFFDocument);
    
    if (!result4.success || !result4.document) {
      console.error('Failed to parse for normalization test:', result4.errors);
      return;
    }
    
    const mxliffDoc = result4.document;
    const normalized = parser.normalizeDocument(mxliffDoc);
    
    console.log('Original version:', mxliffDoc.version);
    console.log('Normalized version:', normalized.version);
    console.log('Microsoft metadata removed:', !JSON.stringify(normalized).includes('microsoft'));
    console.log();
    
  } catch (error) {
    console.error('Error in normalization:', error);
  }

  console.log('MXLIFF Parser testing completed!');
}

/**
 * Run tests if this file is executed directly
 */
if (require.main === module) {
  testMXLIFFParser().catch(console.error);
} 