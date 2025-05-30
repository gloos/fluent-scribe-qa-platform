/**
 * XLIFF 2.0 Parser Implementation
 * Handles parsing of XLIFF 2.0 format files according to the OASIS specification
 * Key differences from 1.2: unit-based structure, modules, segments, different namespace
 */

import {
  XLIFFVersion,
  XLIFFDocument,
  XLIFFFile,
  XLIFFTransUnit,
  XLIFFHeader,
  XLIFFBody,
  XLIFFGroup,
  XLIFFNote,
  XLIFFAltTrans,
  XLIFFInlineElement,
  XLIFFParsingError,
  XLIFFErrorType,
  ErrorSeverity,
  XLIFFProcessingContext,
  XLIFFAttributes
} from '../types';

import { AbstractXLIFFParser } from '../base/AbstractParser';

import {
  XLIFFDocumentModel,
  XLIFFFileModel,
  XLIFFTransUnitModel,
  XLIFFHeaderModel,
  XLIFFBodyModel,
  XLIFFGroupModel,
  XLIFFNoteModel,
  XLIFFAltTransModel,
  XLIFFInlineElementModel
} from '../models';

/**
 * XLIFF 2.0 Parser Class
 */
export class XLIFF20Parser extends AbstractXLIFFParser {
  public readonly version = XLIFFVersion.V2_0;
  public readonly supportedNamespaces = ['urn:oasis:names:tc:xliff:document:2.0'];
  
  constructor() {
    super();
  }

  /**
   * Detect if content is XLIFF 2.0 format
   */
  public detectVersion(xmlContent: string): boolean {
    // Check for XLIFF 2.0 namespace and version
    const xliff20Patterns = [
      /xmlns="urn:oasis:names:tc:xliff:document:2\.0"/,
      /version="2\.0"/,
      /<xliff[^>]+version="2\.0"/,
      /<xliff[^>]+xmlns="urn:oasis:names:tc:xliff:document:2\.0"/
    ];

    return xliff20Patterns.some(pattern => pattern.test(xmlContent));
  }

  /**
   * Normalize document to standard format
   */
  public normalizeDocument(document: XLIFFDocument): XLIFFDocument {
    // Create a deep copy for normalization
    const normalized = JSON.parse(JSON.stringify(document));
    
    // Ensure all required fields are present
    normalized.version = XLIFFVersion.V2_0;
    if (!normalized.attributes) normalized.attributes = {};
    if (!normalized.metadata) normalized.metadata = {};
    
    // Normalize files
    normalized.files.forEach((file: any) => {
      if (!file.attributes) file.attributes = {};
      if (!file.metadata) file.metadata = {};
      if (!file.body) file.body = { transUnits: [], groups: [], binUnits: [], attributes: {} };
    });
    
    return normalized;
  }

  /**
   * Version-specific validation for XLIFF 2.0
   */
  protected validateVersionSpecific(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    
    // Validate XLIFF 2.0 specific requirements
    if (document.version !== XLIFFVersion.V2_0) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.MAJOR,
        'Document version must be 2.0 for XLIFF 2.0 parser'
      ));
    }
    
    // Validate files have required XLIFF 2.0 attributes
    document.files.forEach((file, index) => {
      if (!file.attributes?.id) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          `File ${index + 1} missing required 'id' attribute (XLIFF 2.0 requirement)`
        ));
      }
    });
    
    return errors;
  }

  /**
   * Parse XLIFF 2.0 document
   */
  protected async parseDocument(xmlDoc: Document, context: XLIFFProcessingContext): Promise<XLIFFDocument> {
    const root = xmlDoc.documentElement;
    
    if (root.tagName !== 'xliff') {
      throw this.createError(
        XLIFFErrorType.PARSING_ERROR,
        ErrorSeverity.CRITICAL,
        'Invalid XLIFF 2.0 document: root element must be <xliff>'
      );
    }

    // Validate XLIFF 2.0 namespace
    const namespace = root.getAttribute('xmlns');
    if (namespace !== 'urn:oasis:names:tc:xliff:document:2.0') {
      // Note: We'll create warnings instead of throwing errors for namespace issues
      console.warn(`Invalid XLIFF 2.0 namespace: ${namespace}`);
    }

    // Create document model with version
    const document = new XLIFFDocumentModel(XLIFFVersion.V2_0);
    document.version = XLIFFVersion.V2_0;
    document.attributes = this.extractAttributes(root);

    // Parse file elements
    const fileElements = Array.from(root.querySelectorAll(':scope > file'));
    for (const fileElement of fileElements) {
      try {
        const file = await this.parseFile(fileElement, context);
        document.files.push(file);
      } catch (error) {
        console.error(`Error parsing file element: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return document;
  }

  /**
   * Parse XLIFF 2.0 file element
   */
  protected async parseFile(fileElement: Element, context: XLIFFProcessingContext): Promise<XLIFFFile> {
    // Required attributes for XLIFF 2.0
    const id = fileElement.getAttribute('id');
    if (!id) {
      throw this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.CRITICAL,
        'XLIFF 2.0 file element missing required id attribute'
      );
    }
    
    const original = fileElement.getAttribute('original') || '';
    const sourceLanguage = fileElement.getAttribute('srcLang') || ''; // Note: srcLang in 2.0
    const datatype = fileElement.getAttribute('datatype') || 'plaintext';
    
    // Create file with constructor parameters
    const file = new XLIFFFileModel(original, sourceLanguage, datatype);
    
    // Set XLIFF 2.0 specific attributes
    file.attributes.id = id;
    file.targetLanguage = fileElement.getAttribute('trgLang') || ''; // Note: trgLang in 2.0
    file.attributes = { ...file.attributes, ...this.extractAttributes(fileElement) };

    // Parse header if present
    const headerElement = fileElement.querySelector(':scope > header');
    if (headerElement) {
      file.header = await this.parseHeader(headerElement, context);
    }

    // Parse skeleton if present (XLIFF 2.0 feature)
    const skeletonElement = fileElement.querySelector(':scope > skeleton');
    if (skeletonElement) {
      // Store skeleton in metadata since it's not in the standard interface
      file.metadata.skeleton = await this.parseSkeleton(skeletonElement, context);
    }

    // Parse units (XLIFF 2.0 uses units instead of trans-units)
    const unitElements = Array.from(fileElement.querySelectorAll(':scope > unit'));
    for (const unitElement of unitElements) {
      try {
        const unit = await this.parseUnit(unitElement, context);
        file.body.transUnits.push(unit);
      } catch (error) {
        console.error(`Error parsing unit element: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Parse groups if present
    const groupElements = Array.from(fileElement.querySelectorAll(':scope > group'));
    for (const groupElement of groupElements) {
      try {
        const group = await this.parseGroup(groupElement, context);
        file.body.groups.push(group);
      } catch (error) {
        console.warn(`Error parsing group element: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return file;
  }

  /**
   * Parse XLIFF 2.0 header element
   */
  protected async parseHeader(headerElement: Element, context: XLIFFProcessingContext): Promise<XLIFFHeader> {
    const header = new XLIFFHeaderModel();
    header.attributes = this.extractAttributes(headerElement);

    // Parse notes
    const noteElements = Array.from(headerElement.querySelectorAll('note'));
    for (const noteElement of noteElements) {
      const note = await this.parseNote(noteElement, context);
      header.notes.push(note);
    }

    // Parse metadata (XLIFF 2.0 feature) - store in properties since metadata doesn't exist on interface
    const metaElements = Array.from(headerElement.querySelectorAll('mda\\:metadata meta, metadata meta'));
    for (const metaElement of metaElements) {
      const meta = this.parseMetadata(metaElement, context);
      if (meta) {
        header.properties[meta.type] = meta.value;
      }
    }

    return header;
  }

  /**
   * Parse XLIFF 2.0 unit element (equivalent to trans-unit in 1.2)
   */
  protected async parseUnit(unitElement: Element, context: XLIFFProcessingContext): Promise<XLIFFTransUnit> {
    // Required id attribute
    const id = unitElement.getAttribute('id');
    if (!id) {
      throw this.createError(
        XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
        ErrorSeverity.CRITICAL,
        'XLIFF 2.0 unit element missing required id attribute',
        { line: 0 }
      );
    }
    
    // Create unit with required parameters
    const unit = new XLIFFTransUnitModel(id, ''); // Will set source below
    unit.attributes = this.extractAttributes(unitElement);

    // Parse segments (XLIFF 2.0 feature - units contain segments)
    const segmentElements = Array.from(unitElement.querySelectorAll(':scope > segment'));
    if (segmentElements.length > 0) {
      // Units with segments
      for (const segmentElement of segmentElements) {
        const segment = this.parseSegment(segmentElement, context);
        if (segment) {
          // For compatibility, we'll treat the first segment as the main source/target
          if (!unit.source && segment.source) {
            unit.source = segment.source;
          }
          if (!unit.target && segment.target) {
            unit.target = segment.target;
            unit.state = segment.state;
          }
        }
      }
    } else {
      // Direct source/target in unit (simpler case)
      const sourceElement = unitElement.querySelector(':scope > source');
      const targetElement = unitElement.querySelector(':scope > target');
      
      if (sourceElement) {
        unit.source = this.parseInlineContent(sourceElement, context);
      }
      
      if (targetElement) {
        unit.target = this.parseInlineContent(targetElement, context);
        unit.state = targetElement.getAttribute('state') || 'new';
      }
    }

    // Parse notes
    const noteElements = Array.from(unitElement.querySelectorAll(':scope > notes > note'));
    for (const noteElement of noteElements) {
      const note = await this.parseNote(noteElement, context);
      unit.notes.push(note);
    }

    return unit;
  }

  /**
   * Parse XLIFF 2.0 segment element
   */
  protected parseSegment(segmentElement: Element, context: XLIFFProcessingContext): any {
    const segment: any = {
      id: segmentElement.getAttribute('id') || '',
      state: segmentElement.getAttribute('state') || 'initial'
    };

    const sourceElement = segmentElement.querySelector(':scope > source');
    const targetElement = segmentElement.querySelector(':scope > target');

    if (sourceElement) {
      segment.source = this.parseInlineContent(sourceElement, context);
    }

    if (targetElement) {
      segment.target = this.parseInlineContent(targetElement, context);
    }

    return segment;
  }

  /**
   * Parse skeleton element (XLIFF 2.0 feature)
   */
  protected async parseSkeleton(skeletonElement: Element, context: XLIFFProcessingContext): Promise<any> {
    return {
      href: skeletonElement.getAttribute('href'),
      content: skeletonElement.textContent || ''
    };
  }

  /**
   * Parse metadata element (XLIFF 2.0 feature)
   */
  protected parseMetadata(metaElement: Element, context: XLIFFProcessingContext): any {
    const type = metaElement.getAttribute('type');
    if (!type) return null;

    return {
      type,
      value: metaElement.textContent || ''
    };
  }

  /**
   * Parse XLIFF 2.0 group element
   */
  protected async parseGroup(groupElement: Element, context: XLIFFProcessingContext): Promise<XLIFFGroup> {
    const group = new XLIFFGroupModel();
    group.id = groupElement.getAttribute('id') || '';
    group.attributes = this.extractAttributes(groupElement);

    // Parse units in group
    const unitElements = Array.from(groupElement.querySelectorAll(':scope > unit'));
    for (const unitElement of unitElements) {
      try {
        const unit = await this.parseUnit(unitElement, context);
        group.transUnits.push(unit);
      } catch (error) {
        console.error(`Error parsing unit in group: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return group;
  }

  /**
   * Parse XLIFF 2.0 note element
   */
  protected async parseNote(noteElement: Element, context: XLIFFProcessingContext): Promise<XLIFFNote> {
    const note = new XLIFFNoteModel();
    note.id = noteElement.getAttribute('id') || '';
    note.content = noteElement.textContent || '';
    note.attributes = this.extractAttributes(noteElement);
    return note;
  }

  /**
   * Parse inline content for XLIFF 2.0 (handles different inline elements)
   */
  protected parseInlineContent(element: Element, context: XLIFFProcessingContext): string {
    let content = '';
    
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as Element;
        
        // Handle XLIFF 2.0 inline elements
        switch (elem.tagName) {
          case 'cp': // Code point
            content += elem.getAttribute('hex') ? 
              String.fromCharCode(parseInt(elem.getAttribute('hex')!, 16)) : 
              elem.textContent || '';
            break;
          case 'ph': // Placeholder
            content += `<${elem.getAttribute('id') || 'ph'}>`;
            break;
          case 'pc': // Paired code
            content += `<${elem.getAttribute('id') || 'pc'}>${this.parseInlineContent(elem, context)}</${elem.getAttribute('id') || 'pc'}>`;
            break;
          case 'sc': // Start code
            content += `<${elem.getAttribute('id') || 'sc'}>`;
            break;
          case 'ec': // End code
            content += `</${elem.getAttribute('id') || 'ec'}>`;
            break;
          case 'mrk': // Marker
            content += this.parseInlineContent(elem, context);
            break;
          case 'sm': // Start marker
          case 'em': // End marker
            content += this.parseInlineContent(elem, context);
            break;
          default:
            content += elem.textContent || '';
        }
      }
    }
    
    return content;
  }

  /**
   * Serialize document back to XLIFF 2.0 XML
   */
  public serialize(document: XLIFFDocument): string {
    const xmlDoc = new Document();
    
    // Create root xliff element with XLIFF 2.0 namespace
    const xliffElement = xmlDoc.createElement('xliff');
    xliffElement.setAttribute('version', '2.0');
    xliffElement.setAttribute('xmlns', 'urn:oasis:names:tc:xliff:document:2.0');
    xliffElement.setAttribute('srcLang', document.attributes.sourceLanguage || 'en');
    
    if (document.attributes.targetLanguage) {
      xliffElement.setAttribute('trgLang', document.attributes.targetLanguage);
    }
    
    // Add other document attributes
    Object.entries(document.attributes).forEach(([key, value]) => {
      if (!['version', 'xmlns', 'sourceLanguage', 'targetLanguage'].includes(key) && value != null) {
        xliffElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize all files
    document.files.forEach(file => {
      const fileElement = this.serializeFile(xmlDoc, file);
      xliffElement.appendChild(fileElement);
    });
    
    xmlDoc.appendChild(xliffElement);
    
    return new XMLSerializer().serializeToString(xmlDoc);
  }

  /**
   * Serialize file element for XLIFF 2.0
   */
  protected serializeFile(xmlDoc: Document, file: XLIFFFile): Element {
    const fileElement = xmlDoc.createElement('file');
    
    // Required attributes - get id from attributes
    const fileId = file.attributes.id || 'f1';
    fileElement.setAttribute('id', String(fileId));
    if (file.original) fileElement.setAttribute('original', file.original);
    if (file.sourceLanguage) fileElement.setAttribute('srcLang', file.sourceLanguage);
    if (file.targetLanguage) fileElement.setAttribute('trgLang', file.targetLanguage);
    if (file.datatype) fileElement.setAttribute('datatype', file.datatype);
    
    // Add other attributes, ensuring all values are strings
    Object.entries(file.attributes).forEach(([key, value]) => {
      if (!['id', 'original', 'srcLang', 'trgLang', 'datatype'].includes(key) && value != null) {
        fileElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize header
    if (file.header) {
      const headerElement = this.serializeHeader(xmlDoc, file.header);
      fileElement.appendChild(headerElement);
    }
    
    // Serialize units (not trans-units in XLIFF 2.0)
    file.body.transUnits.forEach(unit => {
      const unitElement = this.serializeUnit(xmlDoc, unit);
      fileElement.appendChild(unitElement);
    });
    
    // Serialize groups
    file.body.groups.forEach(group => {
      const groupElement = this.serializeGroup(xmlDoc, group);
      fileElement.appendChild(groupElement);
    });
    
    return fileElement;
  }

  /**
   * Serialize unit element for XLIFF 2.0
   */
  protected serializeUnit(xmlDoc: Document, unit: XLIFFTransUnit): Element {
    const unitElement = xmlDoc.createElement('unit');
    unitElement.setAttribute('id', unit.id);
    
    // Add attributes
    Object.entries(unit.attributes).forEach(([key, value]) => {
      if (key !== 'id' && value != null) {
        unitElement.setAttribute(key, String(value));
      }
    });
    
    // Add source
    if (unit.source) {
      const sourceElement = xmlDoc.createElement('source');
      sourceElement.textContent = unit.source;
      unitElement.appendChild(sourceElement);
    }
    
    // Add target
    if (unit.target) {
      const targetElement = xmlDoc.createElement('target');
      targetElement.textContent = unit.target;
      if (unit.state) {
        targetElement.setAttribute('state', unit.state);
      }
      unitElement.appendChild(targetElement);
    }
    
    // Add notes
    if (unit.notes.length > 0) {
      const notesElement = xmlDoc.createElement('notes');
      unit.notes.forEach(note => {
        const noteElement = this.serializeNote(xmlDoc, note);
        notesElement.appendChild(noteElement);
      });
      unitElement.appendChild(notesElement);
    }
    
    return unitElement;
  }

  /**
   * Serialize header for XLIFF 2.0
   */
  protected serializeHeader(xmlDoc: Document, header: XLIFFHeader): Element {
    const headerElement = xmlDoc.createElement('header');
    
    // Add attributes
    Object.entries(header.attributes).forEach(([key, value]) => {
      if (value != null) {
        headerElement.setAttribute(key, String(value));
      }
    });
    
    // Add notes
    header.notes.forEach(note => {
      const noteElement = this.serializeNote(xmlDoc, note);
      headerElement.appendChild(noteElement);
    });
    
    return headerElement;
  }

  /**
   * Serialize group for XLIFF 2.0
   */
  protected serializeGroup(xmlDoc: Document, group: XLIFFGroup): Element {
    const groupElement = xmlDoc.createElement('group');
    
    if (group.id) {
      groupElement.setAttribute('id', group.id);
    }
    
    // Add attributes
    Object.entries(group.attributes).forEach(([key, value]) => {
      if (key !== 'id' && value != null) {
        groupElement.setAttribute(key, String(value));
      }
    });
    
    // Add units
    group.transUnits.forEach(unit => {
      const unitElement = this.serializeUnit(xmlDoc, unit);
      groupElement.appendChild(unitElement);
    });
    
    return groupElement;
  }

  /**
   * Serialize note for XLIFF 2.0
   */
  protected serializeNote(xmlDoc: Document, note: XLIFFNote): Element {
    const noteElement = xmlDoc.createElement('note');
    
    if (note.id) {
      noteElement.setAttribute('id', note.id);
    }
    
    // Add attributes
    Object.entries(note.attributes).forEach(([key, value]) => {
      if (key !== 'id' && value != null) {
        noteElement.setAttribute(key, String(value));
      }
    });
    
    noteElement.textContent = note.content;
    
    return noteElement;
  }
} 