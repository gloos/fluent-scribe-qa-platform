import { supabase } from './supabase';
import { createXLIFFParser, XLIFFParsingResult, XLIFFTransUnit, detectXLIFFVersion } from './parsers';

export interface XLIFFSegment {
  segmentNumber: number;
  segmentId?: string;
  sourceText: string;
  targetText?: string;
  state?: string;
  approved?: boolean;
}

export interface ParsedXLIFFData {
  segments: XLIFFSegment[];
  metadata: {
    sourceLanguage: string;
    targetLanguage?: string;
    totalSegments: number;
    originalFileName: string;
    version: string;
    wordCounts: {
      source: number;
      target: number;
    };
  };
}

/**
 * Test XLIFF parser availability and basic functionality
 */
const testXLIFFParser = () => {
  console.log('🧪 Testing XLIFF parser availability...');
  
  // Test basic imports
  console.log('🔧 createXLIFFParser function available:', typeof createXLIFFParser === 'function');
  console.log('🔧 detectXLIFFVersion function available:', typeof detectXLIFFVersion === 'function');
  
  // Test with a simple XLIFF 1.2 snippet
  const simpleXLIFF12 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="test.txt" source-language="en" target-language="de" datatype="plaintext">
    <body>
      <trans-unit id="1">
        <source>Hello World</source>
        <target>Hallo Welt</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

  try {
    const detectedVersion = detectXLIFFVersion(simpleXLIFF12);
    console.log('🔍 Detected XLIFF version for test content:', detectedVersion);
    
    const parser = createXLIFFParser(simpleXLIFF12);
    console.log('✅ Parser creation test successful:', !!parser);
    
    if (parser) {
      console.log('📋 Parser version:', parser.version);
    }
    
  } catch (error) {
    console.error('❌ Parser test failed:', error);
  }
};

/**
 * Parse XLIFF file content and extract segments
 */
export const parseXLIFFFile = async (
  fileContent: string, 
  fileName: string
): Promise<ParsedXLIFFData> => {
  try {
    console.log('🔍 Starting XLIFF parsing for:', fileName);
    console.log('📊 File content length:', fileContent.length, 'characters');
    console.log('📄 File content preview:', fileContent.substring(0, 200) + '...');

    // Run parser test first
    testXLIFFParser();

    // Check if createXLIFFParser is available
    if (typeof createXLIFFParser !== 'function') {
      throw new Error('createXLIFFParser function is not available - import issue?');
    }

    // Try to detect version first
    console.log('🔍 Detecting XLIFF version...');
    const detectedVersion = detectXLIFFVersion(fileContent);
    console.log('📋 Detected XLIFF version:', detectedVersion);

    // Create parser for the XLIFF content
    console.log('🔧 Creating XLIFF parser...');
    const parser = createXLIFFParser(fileContent);
    if (!parser) {
      throw new Error(`Unable to detect XLIFF version or unsupported format. Detected version: ${detectedVersion}`);
    }

    console.log('✅ XLIFF parser created, version:', parser.version);

    // Parse the XLIFF document
    console.log('📖 Parsing XLIFF document...');
    const result: XLIFFParsingResult = await parser.parse(fileContent);
    
    console.log('📊 Parse result:', {
      success: result.success,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      hasDocument: !!result.document
    });
    
    if (!result.success || !result.document) {
      const errorMessages = result.errors.map(e => e.message).join('; ');
      const warningMessages = result.warnings.map(w => w.message).join('; ');
      console.error('❌ XLIFF parsing failed:', {
        errors: result.errors,
        warnings: result.warnings
      });
      throw new Error(`XLIFF parsing failed: ${errorMessages}${warningMessages ? '; Warnings: ' + warningMessages : ''}`);
    }

    const document = result.document;
    
    console.log('✅ XLIFF document parsed successfully');
    console.log('📊 Parse result metadata:', result.metadata);
    console.log('📁 Document files count:', document.files.length);

    // Extract all translation units from all files
    const allTransUnits: XLIFFTransUnit[] = [];
    
    for (const file of document.files) {
      console.log('📄 Processing file:', file.original, 'Language:', file.sourceLanguage, '->', file.targetLanguage);
      const fileTransUnits = file.getAllTransUnits();
      console.log('📝 Found', fileTransUnits.length, 'translation units in file');
      allTransUnits.push(...fileTransUnits);
    }
    
    console.log(`📝 Found ${allTransUnits.length} translation units across ${document.files.length} files`);

    // Convert to our segment format
    const segments: XLIFFSegment[] = allTransUnits.map((unit, index) => ({
      segmentNumber: index + 1,
      segmentId: unit.id,
      sourceText: unit.source || '',
      targetText: unit.target || '',
      state: unit.state || 'new',
      approved: unit.approved || false
    }));

    console.log('📊 Converted to', segments.length, 'segments');

    // Extract metadata
    const firstFile = document.files[0]; // Use first file for metadata
    
    // Calculate word counts
    const wordCounts = {
      source: allTransUnits.reduce((total, unit) => total + (unit.source?.split(/\s+/).length || 0), 0),
      target: allTransUnits.reduce((total, unit) => total + (unit.target?.split(/\s+/).length || 0), 0)
    };
    
    const metadata = {
      sourceLanguage: firstFile?.sourceLanguage || 'unknown',
      targetLanguage: firstFile?.targetLanguage || 'unknown',
      totalSegments: segments.length,
      originalFileName: fileName,
      version: document.version,
      wordCounts
    };

    console.log('✅ XLIFF parsing completed successfully');
    console.log('📊 Metadata:', metadata);

    return {
      segments,
      metadata
    };

  } catch (error) {
    console.error('❌ Error parsing XLIFF file:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      fileName,
      fileContentLength: fileContent.length
    });
    throw new Error(`Failed to parse XLIFF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Fetch XLIFF file content from Supabase storage
 */
export const fetchXLIFFFileContent = async (filePath: string): Promise<string> => {
  try {
    console.log('📥 Fetching XLIFF file content from:', filePath);

    const { data, error } = await supabase.storage
      .from('qa-files')
      .download(filePath);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No file data received');
    }

    // Convert blob to text
    const content = await data.text();
    
    console.log('✅ XLIFF file content fetched successfully');
    console.log('📊 Content size:', content.length, 'characters');

    return content;

  } catch (error) {
    console.error('❌ Error fetching XLIFF file content:', error);
    throw new Error(`Failed to fetch file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Store parsed segments in the database
 */
export const storeSegmentsInDatabase = async (
  sessionId: string,
  segments: XLIFFSegment[]
): Promise<void> => {
  try {
    console.log('💾 Storing', segments.length, 'segments in database for session:', sessionId);

    // Prepare segments for database insertion
    const segmentRows = segments.map(segment => ({
      session_id: sessionId,
      segment_number: segment.segmentNumber,
      segment_id: segment.segmentId,
      source_text: segment.sourceText,
      target_text: segment.targetText,
      state: segment.state,
      approved: segment.approved || false,
      needs_review: false, // Will be set by QA analysis
      
      // Default QA analysis values - will be updated by actual analysis
      severity: null,
      category: null,
      issue_description: null,
      suggestion: null,
      confidence_score: null,
      mqm_score: null
    }));

    // Insert segments in batch
    const { error } = await supabase
      .from('qa_segments')
      .insert(segmentRows);

    if (error) {
      throw new Error(`Database insertion failed: ${error.message}`);
    }

    console.log('✅ Segments stored successfully in database');

  } catch (error) {
    console.error('❌ Error storing segments in database:', error);
    throw new Error(`Failed to store segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Parse XLIFF and store segments - main workflow function
 */
export const processXLIFFFileForSession = async (
  sessionId: string,
  filePath: string,
  fileName: string
): Promise<ParsedXLIFFData> => {
  try {
    console.log('🚀 Starting XLIFF processing workflow for session:', sessionId);

    // 1. Fetch file content from storage
    const fileContent = await fetchXLIFFFileContent(filePath);

    // 2. Parse XLIFF content
    const parsedData = await parseXLIFFFile(fileContent, fileName);

    // 3. Store segments in database
    await storeSegmentsInDatabase(sessionId, parsedData.segments);

    // 4. Update QA session with additional metadata
    const { error: updateError } = await supabase
      .from('qa_sessions')
      .update({
        analysis_results: {
          ...parsedData.metadata,
          segmentCount: parsedData.segments.length,
          sourceLanguage: parsedData.metadata.sourceLanguage,
          targetLanguage: parsedData.metadata.targetLanguage,
          xliffVersion: parsedData.metadata.version
        }
      })
      .eq('id', sessionId);

    if (updateError) {
      console.warn('⚠️ Failed to update QA session metadata:', updateError);
    }

    console.log('🎉 XLIFF processing workflow completed successfully');
    return parsedData;

  } catch (error) {
    console.error('❌ XLIFF processing workflow failed:', error);
    throw error;
  }
};

/**
 * Fetch segments for a QA session from database
 */
export const fetchSegmentsForSession = async (sessionId: string): Promise<XLIFFSegment[]> => {
  try {
    console.log('📥 Fetching segments for session:', sessionId);

    const { data: segments, error } = await supabase
      .from('qa_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('segment_number');

    if (error) {
      throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    console.log('✅ Fetched', segments?.length || 0, 'segments from database');

    return (segments || []).map(segment => ({
      segmentNumber: segment.segment_number,
      segmentId: segment.segment_id,
      sourceText: segment.source_text,
      targetText: segment.target_text,
      state: segment.state,
      approved: segment.approved
    }));

  } catch (error) {
    console.error('❌ Error fetching segments:', error);
    throw error;
  }
}; 