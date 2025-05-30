/**
 * XLIFF 1.2 Parser Implementation
 * Handles parsing of XLIFF 1.2 format files according to the OASIS specification
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
 * XLIFF 1.2 Parser Class
 */
export class XLIFF12Parser extends AbstractXLIFFParser {
  public readonly version = XLIFFVersion.V1_2;
  public readonly supportedNamespaces = [
    'urn:oasis:names:tc:xliff:document:1.2',
    'http://www.w3.org/1999/xhtml',
    'urn:microsoft:psi-extension'
  ];

  /**
   * Detect if content is XLIFF 1.2 format
   */
  public detectVersion(xmlContent: string): boolean {
    const patterns = [
      /version\s*=\s*["']1\.2["']/i,
      /xliff\s+xmlns\s*=\s*["']urn:oasis:names:tc:xliff:document:1\.2["']/i,
      /<!DOCTYPE\s+xliff\s+PUBLIC\s+[^>]*1\.2[^>]*>/i
    ];

    return patterns.some(pattern => pattern.test(xmlContent));
  }

  /**
   * Parse XLIFF 1.2 document from DOM
   */
  protected async parseDocument(
    domDocument: Document,
    context: XLIFFProcessingContext
  ): Promise<XLIFFDocument> {
    const xliffElement = domDocument.documentElement;
    
    if (!xliffElement || xliffElement.tagName !== 'xliff') {
      throw new Error('Root element must be "xliff"');
    }

    // Extract document attributes
    const attributes = this.extractAttributes(xliffElement);
    const document = new XLIFFDocumentModel(XLIFFVersion.V1_2, attributes);

    // Parse all file elements
    const fileElements = this.findChildElements(xliffElement, 'file');
    for (const fileElement of fileElements) {
      const file = await this.parseFile(fileElement, context);
      document.addFile(file);
    }

    return document;
  }

  /**
   * Parse a file element
   */
  private async parseFile(
    fileElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFFile> {
    const attributes = this.extractAttributes(fileElement);
    
    // Required attributes for XLIFF 1.2 file element
    const original = attributes.original;
    const sourceLanguage = attributes['source-language'];
    const datatype = attributes.datatype;

    if (!original) {
      throw new Error('File element must have "original" attribute');
    }
    if (!sourceLanguage) {
      throw new Error('File element must have "source-language" attribute');
    }
    if (!datatype) {
      throw new Error('File element must have "datatype" attribute');
    }

    const file = new XLIFFFileModel(original, sourceLanguage, datatype, attributes);

    // Parse header if present
    const headerElement = this.findFirstChildElement(fileElement, 'header');
    if (headerElement) {
      const header = await this.parseHeader(headerElement, context);
      file.setHeader(header);
    }

    // Parse body (required)
    const bodyElement = this.findFirstChildElement(fileElement, 'body');
    if (!bodyElement) {
      throw new Error('File element must contain a body element');
    }

    const body = await this.parseBody(bodyElement, context);
    file.body = body;

    return file;
  }

  /**
   * Parse header element
   */
  private async parseHeader(
    headerElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFHeader> {
    const attributes = this.extractAttributes(headerElement);
    const header = new XLIFFHeaderModel(attributes);

    // Parse notes
    const noteElements = this.findChildElements(headerElement, 'note');
    for (const noteElement of noteElements) {
      const note = this.parseNote(noteElement);
      header.addNote(note);
    }

    // Parse properties (prop elements)
    const propElements = this.findChildElements(headerElement, 'prop');
    for (const propElement of propElements) {
      const propType = propElement.getAttribute('prop-type');
      const propValue = this.getTextContent(propElement, context.preserveOriginalStructure);
      if (propType) {
        header.setProperty(propType, propValue);
      }
    }

    // TODO: Parse other header elements like phase-group, count-group, etc.
    // These are less commonly used but can be added as needed

    return header;
  }

  /**
   * Parse body element
   */
  private async parseBody(
    bodyElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFBody> {
    const attributes = this.extractAttributes(bodyElement);
    const body = new XLIFFBodyModel(attributes);

    // Parse all child elements in order
    for (let i = 0; i < bodyElement.children.length; i++) {
      const child = bodyElement.children[i];
      
      switch (child.tagName) {
        case 'trans-unit':
          const transUnit = await this.parseTransUnit(child, context);
          body.addTransUnit(transUnit);
          break;
          
        case 'group':
          const group = await this.parseGroup(child, context);
          body.addGroup(group);
          break;
          
        case 'bin-unit':
          // TODO: Implement binary unit parsing if needed
          break;
          
        default:
          // Unknown element - log warning but continue
          console.warn(`Unknown body child element: ${child.tagName}`);
      }
    }

    return body;
  }

  /**
   * Parse group element
   */
  private async parseGroup(
    groupElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFGroup> {
    const attributes = this.extractAttributes(groupElement);
    const group = new XLIFFGroupModel(attributes);

    // Parse notes
    const noteElements = this.findChildElements(groupElement, 'note');
    for (const noteElement of noteElements) {
      const note = this.parseNote(noteElement);
      group.notes.push(note);
    }

    // Parse child elements
    for (let i = 0; i < groupElement.children.length; i++) {
      const child = groupElement.children[i];
      
      switch (child.tagName) {
        case 'trans-unit':
          const transUnit = await this.parseTransUnit(child, context);
          group.addTransUnit(transUnit);
          break;
          
        case 'group':
          const subGroup = await this.parseGroup(child, context);
          group.addSubGroup(subGroup);
          break;
          
        case 'note':
          // Already handled above
          break;
          
        default:
          console.warn(`Unknown group child element: ${child.tagName}`);
      }
    }

    return group;
  }

  /**
   * Parse translation unit element
   */
  private async parseTransUnit(
    transUnitElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFTransUnit> {
    const attributes = this.extractAttributes(transUnitElement);
    const id = attributes.id;

    if (!id) {
      throw new Error('Translation unit must have an "id" attribute');
    }

    // Parse source element (required)
    const sourceElement = this.findFirstChildElement(transUnitElement, 'source');
    if (!sourceElement) {
      throw new Error('Translation unit must contain a source element');
    }

    const sourceText = this.parseSegmentContent(sourceElement, context);

    // Create translation unit
    const transUnit = new XLIFFTransUnitModel(id, sourceText, attributes);

    // Parse target element (optional)
    const targetElement = this.findFirstChildElement(transUnitElement, 'target');
    if (targetElement) {
      const targetText = this.parseSegmentContent(targetElement, context);
      transUnit.target = targetText;
      
      // Extract target-specific attributes
      const targetAttrs = this.extractAttributes(targetElement);
      if (targetAttrs.state) {
        transUnit.state = targetAttrs.state;
      }
    }

    // Parse notes
    const noteElements = this.findChildElements(transUnitElement, 'note');
    for (const noteElement of noteElements) {
      const note = this.parseNote(noteElement);
      transUnit.addNote(note);
    }

    // Parse alternative translations
    const altTransElements = this.findChildElements(transUnitElement, 'alt-trans');
    for (const altTransElement of altTransElements) {
      const altTrans = this.parseAltTrans(altTransElement, context);
      transUnit.addAltTrans(altTrans);
    }

    return transUnit;
  }

  /**
   * Parse segment content (source or target) handling inline elements
   */
  private parseSegmentContent(
    segmentElement: Element,
    context: XLIFFProcessingContext
  ): string {
    let content = '';
    
    for (let i = 0; i < segmentElement.childNodes.length; i++) {
      const node = segmentElement.childNodes[i];
      
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        
        // Handle inline elements
        switch (element.tagName) {
          case 'g': // Generic inline element
          case 'x': // Standalone code
          case 'bx': // Beginning of paired inline element
          case 'ex': // End of paired inline element
          case 'ph': // Placeholder
          case 'it': // Isolated tag
          case 'ut': // Unidentified tag
            content += this.renderInlineElement(element, context);
            break;
            
          default:
            // For unknown inline elements, include their text content
            content += element.textContent || '';
        }
      }
    }

    return context.preserveOriginalStructure ? content : content.trim();
  }

  /**
   * Render inline element back to text representation
   */
  private renderInlineElement(element: Element, context: XLIFFProcessingContext): string {
    const tagName = element.tagName;
    const id = element.getAttribute('id') || '';
    const ctype = element.getAttribute('ctype') || '';
    
    // For standalone elements (x, ph, it)
    if (['x', 'ph', 'it'].includes(tagName)) {
      return `<${id}>`;
    }
    
    // For paired elements (bx, ex)
    if (tagName === 'bx') {
      return `<${id}>`;
    }
    if (tagName === 'ex') {
      return `</${id}>`;
    }
    
    // For generic group (g) - render with nested content
    if (tagName === 'g') {
      let content = `<${id}>`;
      content += element.textContent || '';
      content += `</${id}>`;
      return content;
    }
    
    // For other elements, return their text content with basic markup
    return `<${tagName}${id ? ` id="${id}"` : ''}${ctype ? ` ctype="${ctype}"` : ''}>${element.textContent || ''}</${tagName}>`;
  }

  /**
   * Parse note element
   */
  private parseNote(noteElement: Element): XLIFFNote {
    const attributes = this.extractAttributes(noteElement);
    const content = this.getTextContent(noteElement, false);
    return new XLIFFNoteModel(content, attributes);
  }

  /**
   * Parse alternative translation element
   */
  private parseAltTrans(
    altTransElement: Element,
    context: XLIFFProcessingContext
  ): XLIFFAltTrans {
    const attributes = this.extractAttributes(altTransElement);
    
    // Parse target element within alt-trans
    const targetElement = this.findFirstChildElement(altTransElement, 'target');
    const target = targetElement ? this.parseSegmentContent(targetElement, context) : '';
    
    const altTrans = new XLIFFAltTransModel(target, attributes);
    
    // Parse source element if present
    const sourceElement = this.findFirstChildElement(altTransElement, 'source');
    if (sourceElement) {
      altTrans.source = this.parseSegmentContent(sourceElement, context);
    }
    
    return altTrans;
  }

  /**
   * Serialize document back to XLIFF 1.2 XML
   */
  public serialize(document: XLIFFDocument): string {
    const xmlDoc = new Document();
    
    // Create root xliff element
    const xliffElement = xmlDoc.createElement('xliff');
    xliffElement.setAttribute('version', '1.2');
    xliffElement.setAttribute('xmlns', 'urn:oasis:names:tc:xliff:document:1.2');
    
    // Add other document attributes
    Object.entries(document.attributes).forEach(([key, value]) => {
      if (key !== 'version' && key !== 'xmlns' && value != null) {
        xliffElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize all files
    document.files.forEach(file => {
      const fileElement = this.serializeFile(xmlDoc, file);
      xliffElement.appendChild(fileElement);
    });
    
    xmlDoc.appendChild(xliffElement);
    
    // Return serialized XML
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xmlDoc);
    
    // Add XML declaration
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
  }

  /**
   * Serialize file element
   */
  private serializeFile(xmlDoc: Document, file: XLIFFFile): Element {
    const fileElement = xmlDoc.createElement('file');
    
    // Set required attributes
    fileElement.setAttribute('original', file.original);
    fileElement.setAttribute('source-language', file.sourceLanguage);
    fileElement.setAttribute('datatype', file.datatype);
    
    // Set optional attributes
    if (file.targetLanguage) {
      fileElement.setAttribute('target-language', file.targetLanguage);
    }
    
    Object.entries(file.attributes).forEach(([key, value]) => {
      if (!['original', 'source-language', 'target-language', 'datatype'].includes(key) && value != null) {
        fileElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize header if present
    if (file.header) {
      const headerElement = this.serializeHeader(xmlDoc, file.header);
      fileElement.appendChild(headerElement);
    }
    
    // Serialize body
    const bodyElement = this.serializeBody(xmlDoc, file.body);
    fileElement.appendChild(bodyElement);
    
    return fileElement;
  }

  /**
   * Serialize header element
   */
  private serializeHeader(xmlDoc: Document, header: XLIFFHeader): Element {
    const headerElement = xmlDoc.createElement('header');
    
    // Add header attributes
    Object.entries(header.attributes).forEach(([key, value]) => {
      if (value != null) {
        headerElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize notes
    header.notes.forEach(note => {
      const noteElement = this.serializeNote(xmlDoc, note);
      headerElement.appendChild(noteElement);
    });
    
    // Serialize properties
    Object.entries(header.properties).forEach(([propType, propValue]) => {
      const propElement = xmlDoc.createElement('prop');
      propElement.setAttribute('prop-type', propType);
      propElement.textContent = propValue;
      headerElement.appendChild(propElement);
    });
    
    return headerElement;
  }

  /**
   * Serialize body element
   */
  private serializeBody(xmlDoc: Document, body: XLIFFBody): Element {
    const bodyElement = xmlDoc.createElement('body');
    
    // Add body attributes
    Object.entries(body.attributes).forEach(([key, value]) => {
      if (value != null) {
        bodyElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize translation units
    body.transUnits.forEach(transUnit => {
      const transUnitElement = this.serializeTransUnit(xmlDoc, transUnit);
      bodyElement.appendChild(transUnitElement);
    });
    
    // Serialize groups
    body.groups.forEach(group => {
      const groupElement = this.serializeGroup(xmlDoc, group);
      bodyElement.appendChild(groupElement);
    });
    
    return bodyElement;
  }

  /**
   * Serialize group element
   */
  private serializeGroup(xmlDoc: Document, group: XLIFFGroup): Element {
    const groupElement = xmlDoc.createElement('group');
    
    // Add group attributes
    Object.entries(group.attributes).forEach(([key, value]) => {
      if (value != null) {
        groupElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize notes
    group.notes.forEach(note => {
      const noteElement = this.serializeNote(xmlDoc, note);
      groupElement.appendChild(noteElement);
    });
    
    // Serialize translation units
    group.transUnits.forEach(transUnit => {
      const transUnitElement = this.serializeTransUnit(xmlDoc, transUnit);
      groupElement.appendChild(transUnitElement);
    });
    
    // Serialize sub-groups
    group.subGroups.forEach(subGroup => {
      const subGroupElement = this.serializeGroup(xmlDoc, subGroup);
      groupElement.appendChild(subGroupElement);
    });
    
    return groupElement;
  }

  /**
   * Serialize translation unit element
   */
  private serializeTransUnit(xmlDoc: Document, transUnit: XLIFFTransUnit): Element {
    const transUnitElement = xmlDoc.createElement('trans-unit');
    transUnitElement.setAttribute('id', transUnit.id);
    
    // Add other attributes
    Object.entries(transUnit.attributes).forEach(([key, value]) => {
      if (key !== 'id' && value != null) {
        transUnitElement.setAttribute(key, String(value));
      }
    });
    
    // Serialize source
    const sourceElement = xmlDoc.createElement('source');
    sourceElement.textContent = transUnit.source;
    transUnitElement.appendChild(sourceElement);
    
    // Serialize target if present
    if (transUnit.target) {
      const targetElement = xmlDoc.createElement('target');
      targetElement.textContent = transUnit.target;
      if (transUnit.state) {
        targetElement.setAttribute('state', transUnit.state);
      }
      transUnitElement.appendChild(targetElement);
    }
    
    // Serialize notes
    transUnit.notes.forEach(note => {
      const noteElement = this.serializeNote(xmlDoc, note);
      transUnitElement.appendChild(noteElement);
    });
    
    // Serialize alternative translations
    transUnit.altTrans.forEach(altTrans => {
      const altTransElement = this.serializeAltTrans(xmlDoc, altTrans);
      transUnitElement.appendChild(altTransElement);
    });
    
    return transUnitElement;
  }

  /**
   * Serialize note element
   */
  private serializeNote(xmlDoc: Document, note: XLIFFNote): Element {
    const noteElement = xmlDoc.createElement('note');
    
    // Add note attributes
    Object.entries(note.attributes).forEach(([key, value]) => {
      if (value != null) {
        noteElement.setAttribute(key, String(value));
      }
    });
    
    noteElement.textContent = note.content;
    return noteElement;
  }

  /**
   * Serialize alternative translation element
   */
  private serializeAltTrans(xmlDoc: Document, altTrans: XLIFFAltTrans): Element {
    const altTransElement = xmlDoc.createElement('alt-trans');
    
    // Add attributes
    Object.entries(altTrans.attributes).forEach(([key, value]) => {
      if (value != null) {
        altTransElement.setAttribute(key, String(value));
      }
    });
    
    // Add source if present
    if (altTrans.source) {
      const sourceElement = xmlDoc.createElement('source');
      sourceElement.textContent = altTrans.source;
      altTransElement.appendChild(sourceElement);
    }
    
    // Add target
    const targetElement = xmlDoc.createElement('target');
    targetElement.textContent = altTrans.target;
    altTransElement.appendChild(targetElement);
    
    return altTransElement;
  }

  /**
   * Normalize XLIFF 1.2 document
   */
  public normalizeDocument(document: XLIFFDocument): XLIFFDocument {
    // For XLIFF 1.2, normalization mainly involves ensuring consistent attribute names
    // and handling any legacy format issues
    
    const normalized = new XLIFFDocumentModel(XLIFFVersion.V1_2, { ...document.attributes });
    normalized.originalXML = document.originalXML;
    normalized.metadata = { ...document.metadata };
    
    // Normalize each file
    document.files.forEach(file => {
      const normalizedFile = this.normalizeFile(file);
      normalized.addFile(normalizedFile);
    });
    
    return normalized;
  }

  /**
   * Normalize file element
   */
  private normalizeFile(file: XLIFFFile): XLIFFFile {
    const normalized = new XLIFFFileModel(
      file.original,
      file.sourceLanguage,
      file.datatype,
      { ...file.attributes }
    );
    
    normalized.metadata = { ...file.metadata };
    if (file.header) {
      normalized.setHeader(file.header);
    }
    
    // Normalize body
    const normalizedBody = new XLIFFBodyModel({ ...file.body.attributes });
    
    // Normalize translation units
    file.body.transUnits.forEach(transUnit => {
      const normalizedTransUnit = this.normalizeTransUnit(transUnit);
      normalizedBody.addTransUnit(normalizedTransUnit);
    });
    
    // Normalize groups
    file.body.groups.forEach(group => {
      const normalizedGroup = this.normalizeGroup(group);
      normalizedBody.addGroup(normalizedGroup);
    });
    
    normalized.body = normalizedBody;
    return normalized;
  }

  /**
   * Normalize translation unit
   */
  private normalizeTransUnit(transUnit: XLIFFTransUnit): XLIFFTransUnit {
    const normalized = new XLIFFTransUnitModel(
      transUnit.id,
      transUnit.source,
      { ...transUnit.attributes }
    );
    
    normalized.target = transUnit.target;
    normalized.state = transUnit.state;
    normalized.metadata = { ...transUnit.metadata };
    
    // Copy notes and alt-trans
    transUnit.notes.forEach(note => normalized.addNote(note));
    transUnit.altTrans.forEach(altTrans => normalized.addAltTrans(altTrans));
    transUnit.inlineElements.forEach(element => normalized.addInlineElement(element));
    
    return normalized;
  }

  /**
   * Normalize group
   */
  private normalizeGroup(group: XLIFFGroup): XLIFFGroup {
    const normalized = new XLIFFGroupModel({ ...group.attributes });
    
    // Copy notes
    group.notes.forEach(note => normalized.notes.push(note));
    
    // Normalize translation units
    group.transUnits.forEach(transUnit => {
      const normalizedTransUnit = this.normalizeTransUnit(transUnit);
      normalized.addTransUnit(normalizedTransUnit);
    });
    
    // Normalize sub-groups
    group.subGroups.forEach(subGroup => {
      const normalizedSubGroup = this.normalizeGroup(subGroup);
      normalized.addSubGroup(normalizedSubGroup);
    });
    
    return normalized;
  }

  /**
   * Version-specific validation for XLIFF 1.2
   */
  protected validateVersionSpecific(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    
    // Check for XLIFF 1.2 specific requirements
    if (document.version !== XLIFFVersion.V1_2) {
      errors.push(this.createError(
        XLIFFErrorType.VALIDATION_ERROR,
        ErrorSeverity.CRITICAL,
        'Document version must be 1.2 for XLIFF 1.2 parser'
      ));
    }
    
    // Validate each file for XLIFF 1.2 compliance
    document.files.forEach((file, index) => {
      // Check required attributes
      if (!file.original || !file.sourceLanguage || !file.datatype) {
        errors.push(this.createError(
          XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
          ErrorSeverity.MAJOR,
          `File ${index} missing required attributes (original, source-language, datatype)`
        ));
      }
      
      // Validate translation units
      const allTransUnits = file.getAllTransUnits();
      allTransUnits.forEach((transUnit, unitIndex) => {
        if (!transUnit.id) {
          errors.push(this.createError(
            XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
            ErrorSeverity.MAJOR,
            `Translation unit ${unitIndex} in file ${index} missing required id attribute`
          ));
        }
        
        if (!transUnit.source || transUnit.source.trim().length === 0) {
          errors.push(this.createError(
            XLIFFErrorType.MISSING_REQUIRED_ELEMENT,
            ErrorSeverity.MAJOR,
            `Translation unit ${transUnit.id} in file ${index} missing source content`
          ));
        }
      });
    });
    
    return errors;
  }
} 