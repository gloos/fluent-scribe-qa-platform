/**
 * Core types and interfaces for XLIFF parser architecture
 * Supports XLIFF 1.2, 2.0, and MXLIFF formats
 */

// Core XLIFF version enumeration
export enum XLIFFVersion {
  V1_2 = '1.2',
  V2_0 = '2.0',
  MXLIFF = 'mxliff'
}

// XLIFF parsing error types
export enum XLIFFErrorType {
  VALIDATION_ERROR = 'validation_error',
  PARSING_ERROR = 'parsing_error',
  SCHEMA_ERROR = 'schema_error',
  UNKNOWN_VERSION = 'unknown_version',
  MALFORMED_XML = 'malformed_xml',
  MISSING_REQUIRED_ELEMENT = 'missing_required_element',
  INVALID_ATTRIBUTE = 'invalid_attribute'
}

// Error severity levels
export enum ErrorSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  WARNING = 'warning'
}

// XLIFF parsing error interface
export interface XLIFFParsingError {
  type: XLIFFErrorType;
  severity: ErrorSeverity;
  message: string;
  location?: {
    line?: number;
    column?: number;
    xpath?: string;
  };
  details?: Record<string, any>;
}

// XLIFF parsing options
export interface XLIFFParsingOptions {
  validateSchema?: boolean;
  strictMode?: boolean;
  preserveWhitespace?: boolean;
  extractMetadata?: boolean;
  includeComments?: boolean;
  customValidators?: XLIFFValidator[];
}

// XLIFF parsing result
export interface XLIFFParsingResult {
  success: boolean;
  document?: XLIFFDocument;
  errors: XLIFFParsingError[];
  warnings: XLIFFParsingError[];
  metadata: {
    version: XLIFFVersion;
    parseTime: number;
    totalSegments: number;
    totalFiles: number;
  };
}

// Core XLIFF element interfaces
export interface XLIFFAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface XLIFFElement {
  tagName: string;
  attributes: XLIFFAttributes;
  textContent?: string;
  children: XLIFFElement[];
  parent?: XLIFFElement;
}

// XLIFF inline element (for tags within segments)
export interface XLIFFInlineElement extends XLIFFElement {
  id?: string;
  ctype?: string; // Content type
  equiv?: string; // Equivalent text
  pos?: 'open' | 'close' | 'both';
}

// XLIFF translation unit interface
export interface XLIFFTransUnit {
  id: string;
  source: string;
  target?: string;
  state?: string;
  approved?: boolean;
  translate?: boolean;
  resname?: string;
  restype?: string;
  extradata?: string;
  help?: string;
  coord?: string;
  font?: string;
  css?: string;
  style?: string;
  equiv?: string;
  attributes: XLIFFAttributes;
  notes: XLIFFNote[];
  altTrans: XLIFFAltTrans[];
  inlineElements: XLIFFInlineElement[];
  metadata: Record<string, any>;
}

// XLIFF note interface
export interface XLIFFNote {
  id?: string;
  from?: string;
  priority?: number;
  lang?: string;
  content: string;
  attributes: XLIFFAttributes;
}

// XLIFF alternative translation interface
export interface XLIFFAltTrans {
  id?: string;
  matchQuality?: number;
  tool?: string;
  origin?: string;
  source?: string;
  target: string;
  attributes: XLIFFAttributes;
}

// XLIFF file interface
export interface XLIFFFile {
  original: string;
  sourceLanguage: string;
  targetLanguage?: string;
  datatype: string;
  tool?: string;
  toolId?: string;
  toolName?: string;
  toolVersion?: string;
  toolCompany?: string;
  buildNum?: string;
  productName?: string;
  productVersion?: string;
  productCompany?: string;
  date?: string;
  header?: XLIFFHeader;
  body: XLIFFBody;
  attributes: XLIFFAttributes;
  metadata: Record<string, any>;
  
  // Methods for working with translation units
  getAllTransUnits(): XLIFFTransUnit[];
  getTotalSegmentCount(): number;
}

// XLIFF header interface
export interface XLIFFHeader {
  skl?: XLIFFSkeleton;
  phaseGroup?: XLIFFPhaseGroup;
  glossary?: XLIFFGlossary;
  reference?: XLIFFReference;
  countGroup?: XLIFFCountGroup;
  toolInfo?: XLIFFToolInfo;
  revisions?: XLIFFRevisions;
  notes: XLIFFNote[];
  properties: Record<string, string>;
  attributes: XLIFFAttributes;
}

// XLIFF body interface
export interface XLIFFBody {
  transUnits: XLIFFTransUnit[];
  groups: XLIFFGroup[];
  binUnits: XLIFFBinUnit[];
  attributes: XLIFFAttributes;
  
  // Methods for working with all translation units
  getAllTransUnits(): XLIFFTransUnit[];
  getTotalSegmentCount(): number;
}

// XLIFF group interface (for organizing trans-units)
export interface XLIFFGroup {
  id?: string;
  datatype?: string;
  restype?: string;
  resname?: string;
  extradata?: string;
  help?: string;
  coord?: string;
  font?: string;
  css?: string;
  style?: string;
  translate?: boolean;
  reformat?: string;
  transUnits: XLIFFTransUnit[];
  subGroups: XLIFFGroup[];
  attributes: XLIFFAttributes;
  notes: XLIFFNote[];
}

// XLIFF binary unit interface
export interface XLIFFBinUnit {
  id: string;
  mimeType: string;
  restype?: string;
  resname?: string;
  binSource?: XLIFFBinSource;
  binTarget?: XLIFFBinTarget;
  attributes: XLIFFAttributes;
}

// Additional header elements (simplified interfaces)
export interface XLIFFSkeleton {
  href?: string;
  content?: string;
}

export interface XLIFFPhaseGroup {
  phases: Array<{
    name: string;
    processName: string;
    company?: string;
    tool?: string;
    date?: string;
    jobId?: string;
    contact?: string;
  }>;
}

export interface XLIFFGlossary {
  href?: string;
  content?: string;
}

export interface XLIFFReference {
  href?: string;
  content?: string;
}

export interface XLIFFCountGroup {
  counts: Array<{
    countType: string;
    phaseGroup?: string;
    unit: string;
    count: number;
  }>;
}

export interface XLIFFToolInfo {
  toolId: string;
  toolName: string;
  toolVersion?: string;
  toolCompany?: string;
}

export interface XLIFFRevisions {
  revisions: Array<{
    tool: string;
    date: string;
    version: string;
    originator?: string;
  }>;
}

export interface XLIFFBinSource {
  href?: string;
  content?: string;
}

export interface XLIFFBinTarget {
  href?: string;
  content?: string;
  mimeType?: string;
}

// XLIFF document interface (top-level)
export interface XLIFFDocument {
  version: XLIFFVersion;
  xmlns?: string;
  files: XLIFFFile[];
  attributes: XLIFFAttributes;
  metadata: Record<string, any>;
  originalXML?: string; // Store original XML for debugging
  
  // Methods for working with all files and segments
  getTotalSegmentCount(): number;
}

// Abstract parser interface
export interface XLIFFParser {
  readonly version: XLIFFVersion;
  readonly supportedNamespaces: string[];
  
  parse(xmlContent: string, options?: XLIFFParsingOptions): Promise<XLIFFParsingResult>;
  validate(document: XLIFFDocument): XLIFFParsingError[];
  serialize(document: XLIFFDocument): string;
  
  // Version-specific methods
  detectVersion(xmlContent: string): boolean;
  normalizeDocument(document: XLIFFDocument): XLIFFDocument;
}

// Validator interface
export interface XLIFFValidator {
  name: string;
  description: string;
  validate(document: XLIFFDocument): XLIFFParsingError[];
}

// Parser factory interface
export interface XLIFFParserFactory {
  createParser(xmlContent: string): XLIFFParser | null;
  detectVersion(xmlContent: string): XLIFFVersion | null;
  registerParser(version: XLIFFVersion, parserClass: new () => XLIFFParser): void;
  getSupportedVersions(): XLIFFVersion[];
}

// Processing context for advanced parsing features
export interface XLIFFProcessingContext {
  preserveOriginalStructure: boolean;
  extractAllMetadata: boolean;
  validateAgainstSchema: boolean;
  customNamespaces: Record<string, string>;
  errorHandler?: (error: XLIFFParsingError) => void;
  progressCallback?: (progress: number) => void;
} 