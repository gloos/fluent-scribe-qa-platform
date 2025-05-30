/**
 * XLIFF 2.0 Parser Test/Demo
 * Contains sample XLIFF 2.0 content for testing the parser
 */

import { XLIFF20Parser } from './XLIFF20Parser';
import { XLIFFParsingOptions } from '../types';

/**
 * Sample XLIFF 2.0 document for testing
 */
export const sampleXLIFF20 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="es">
  <file id="f1" original="sample.txt">
    <header>
      <note>Sample XLIFF 2.0 file for testing</note>
    </header>
    <unit id="1">
      <source>Hello World</source>
      <target state="translated">Hola Mundo</target>
      <notes>
        <note id="n1">Simple greeting translation</note>
      </notes>
    </unit>
    <unit id="2">
      <segment id="2.1">
        <source>Welcome to our application</source>
        <target state="translated">Bienvenido a nuestra aplicación</target>
      </segment>
    </unit>
    <unit id="3">
      <source>Click <pc id="1" canCopy="no" canDelete="no" dataRef="d1">here</pc> to continue</source>
      <target state="new">Haga clic <pc id="1" canCopy="no" canDelete="no" dataRef="d1">aquí</pc> para continuar</target>
    </unit>
    <group id="menu">
      <unit id="4">
        <source>File</source>
        <target state="translated">Archivo</target>
      </unit>
      <unit id="5">
        <source>Edit</source>
        <target state="translated">Editar</target>
      </unit>
    </group>
  </file>
</xliff>`;

/**
 * More complex XLIFF 2.0 document with metadata and inline elements
 */
export const complexXLIFF20 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="fr">
  <file id="complex" original="complex.html" datatype="html">
    <header>
      <note>Complex XLIFF 2.0 with various inline elements</note>
    </header>
    <unit id="title">
      <source>Product <ph id="ph1" dataRef="d1">{productName}</ph> Details</source>
      <target state="translated">Détails du produit <ph id="ph1" dataRef="d1">{productName}</ph></target>
    </unit>
    <unit id="description">
      <segment id="desc1">
        <source>This product has <sc id="bold1" canCopy="no" canDelete="no" dataRef="d2"/>excellent<ec id="bold1" canCopy="no" canDelete="no" dataRef="d3"/> features.</source>
        <target state="needs-review-translation">Ce produit a d'<sc id="bold1" canCopy="no" canDelete="no" dataRef="d2"/>excellentes<ec id="bold1" canCopy="no" canDelete="no" dataRef="d3"/> caractéristiques.</target>
      </segment>
    </unit>
    <unit id="price">
      <source>Price: <ph id="currency" dataRef="d4">$</ph><ph id="amount" dataRef="d5">{price}</ph></source>
      <target state="new">Prix : <ph id="currency" dataRef="d4">€</ph><ph id="amount" dataRef="d5">{price}</ph></target>
    </unit>
  </file>
</xliff>`;

/**
 * Demo function to test XLIFF 2.0 parser
 */
export async function testXLIFF20Parser(): Promise<void> {
  console.log('🧪 Testing XLIFF 2.0 Parser...\n');
  
  const parser = new XLIFF20Parser();
  const options: XLIFFParsingOptions = {
    validateSchema: true,
    extractMetadata: true,
    preserveWhitespace: false
  };

  try {
    console.log('📝 Testing basic XLIFF 2.0 document...');
    const result1 = await parser.parse(sampleXLIFF20, options);
    
    if (result1.success && result1.document) {
      console.log('✅ Basic parsing successful!');
      console.log(`   - Version: ${result1.document.version}`);
      console.log(`   - Files: ${result1.document.files.length}`);
      console.log(`   - Total segments: ${result1.document.getTotalSegmentCount()}`);
      console.log(`   - Parse time: ${result1.metadata.parseTime}ms`);
      
      // Test serialization
      const serialized = parser.serialize(result1.document);
      console.log('✅ Serialization successful!');
      console.log(`   - Output length: ${serialized.length} characters`);
    } else {
      console.log('❌ Basic parsing failed');
      result1.errors.forEach(error => console.log(`   Error: ${error.message}`));
    }

    console.log('\n📝 Testing complex XLIFF 2.0 document...');
    const result2 = await parser.parse(complexXLIFF20, options);
    
    if (result2.success && result2.document) {
      console.log('✅ Complex parsing successful!');
      console.log(`   - Version: ${result2.document.version}`);
      console.log(`   - Files: ${result2.document.files.length}`);
      console.log(`   - Total segments: ${result2.document.getTotalSegmentCount()}`);
      console.log(`   - Parse time: ${result2.metadata.parseTime}ms`);
      
      // Show some translation units
      const allUnits = result2.document.files[0].body.transUnits;
      console.log(`   - Translation units: ${allUnits.length}`);
      allUnits.slice(0, 2).forEach((unit, index) => {
        console.log(`     Unit ${index + 1}: "${unit.source}" -> "${unit.target || '[not translated]'}"`);
      });
    } else {
      console.log('❌ Complex parsing failed');
      result2.errors.forEach(error => console.log(`   Error: ${error.message}`));
    }

    console.log('\n📝 Testing version detection...');
    const canParseBasic = parser.detectVersion(sampleXLIFF20);
    const canParseComplex = parser.detectVersion(complexXLIFF20);
    console.log(`✅ Version detection: Basic=${canParseBasic}, Complex=${canParseComplex}`);

  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }

  console.log('\n🎉 XLIFF 2.0 Parser testing completed!');
}

/**
 * Export parser instance for convenience
 */
export const xliff20Parser = new XLIFF20Parser(); 