/**
 * Microsoft XLIFF (MXLIFF) Parser Implementation
 * Handles parsing of Microsoft XLIFF format files with Microsoft-specific extensions
 * Based on XLIFF 1.2 with Microsoft enhancements
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
 * Microsoft-specific XLIFF extensions and namespaces
 */
export interface MXLIFFExtensions {
  microsoftNamespaces: Record<string, string>;
  customMetadata: Record<string, any>;
  stateExtensions: Record<string, string>;
  inlineExtensions: MXLIFFInlineExtension[];
}

/**
 * Microsoft-specific inline extension
 */
export interface MXLIFFInlineExtension {
  id: string;
  type: string;
  mxliffType?: string;
  microsoftId?: string;
  content?: string;
  attributes: Record<string, string>;
}

/**
 * Microsoft XLIFF Parser Class
 */
export class MXLIFFParser extends AbstractXLIFFParser {
  public readonly version = XLIFFVersion.MXLIFF;
  public readonly supportedNamespaces = [
    'urn:oasis:names:tc:xliff:document:1.2',
    'http://www.w3.org/1999/xhtml',
    'urn:microsoft:psi-extension',
    'http://schemas.microsoft.com/locstudio/2006/6/lcx',
    'http://www.microsoft.com/locstudio',
    'mxliff'
  ];

  // Microsoft-specific state mappings
  private readonly microsoftStates = {
    'new': 'new',
    'needs-translation': 'needs-translation',
    'needs-l10n': 'needs-l10n',
    'needs-adaptation': 'needs-adaptation', 
    'translated': 'translated',
    'needs-review-translation': 'needs-review-translation',
    'needs-review-adaptation': 'needs-review-adaptation',
    'needs-review-l10n': 'needs-review-l10n',
    'final': 'final',
    'signed-off': 'signed-off',
    'locked': 'locked',
    'rejected': 'rejected'
  };

  /**
   * Detect if content is MXLIFF format
   */
  public detectVersion(xmlContent: string): boolean {
    // First check if it's XLIFF 1.2 based
    const xliff12Patterns = [
      /version\s*=\s*["']1\.2["']/i,
      /xliff\s+xmlns\s*=\s*["']urn:oasis:names:tc:xliff:document:1\.2["']/i
    ];

    const isXliff12Base = xliff12Patterns.some(pattern => pattern.test(xmlContent));
    
    if (!isXliff12Base) {
      return false;
    }

    // Check for Microsoft-specific patterns
    const mxliffPatterns = [
      /xmlns:mxliff\s*=\s*["'][^"']*["']/i,
      /mxliff:/i,
      /tool-id\s*=\s*["']Microsoft/i,
      /tool-name\s*=\s*["']Microsoft/i,
      /<mxliff:/i,
      /xmlns:[^=]*=\s*["']http:\/\/schemas\.microsoft\.com/i,
      /xmlns:[^=]*=\s*["']http:\/\/www\.microsoft\.com\/locstudio/i,
      /microsoft\./i
    ];

    return mxliffPatterns.some(pattern => pattern.test(xmlContent));
  }

  /**
   * Parse MXLIFF document from DOM
   */
  protected async parseDocument(
    domDocument: Document,
    context: XLIFFProcessingContext
  ): Promise<XLIFFDocument> {
    const xliffElement = domDocument.documentElement;
    
    if (!xliffElement || xliffElement.tagName !== 'xliff') {
      throw new Error('Root element must be "xliff"');
    }

    // Extract document attributes and Microsoft extensions
    const attributes = this.extractAttributes(xliffElement);
    const extensions = this.extractMicrosoftExtensions(xliffElement);
    
    const document = new XLIFFDocumentModel(XLIFFVersion.MXLIFF, attributes);
    
    // Store Microsoft extensions in metadata
    document.metadata.microsoftExtensions = extensions;

    // Parse all file elements
    const fileElements = this.findChildElements(xliffElement, 'file');
    for (const fileElement of fileElements) {
      const file = await this.parseFile(fileElement, context);
      document.addFile(file);
    }

    return document;
  }

  /**
   * Parse a file element with Microsoft extensions
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

    // Extract Microsoft-specific metadata
    const microsoftMetadata = this.extractMicrosoftFileMetadata(fileElement);
    file.metadata.microsoft = microsoftMetadata;

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
   * Parse header element with Microsoft extensions
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

    // Store Microsoft-specific header extensions in the header properties
    const msExtensions = this.extractMicrosoftHeaderExtensions(headerElement);
    for (const [key, value] of Object.entries(msExtensions)) {
      header.setProperty(`microsoft:${key}`, JSON.stringify(value));
    }

    return header;
  }

  /**
   * Parse body element with Microsoft extensions
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
          // Handle binary units with Microsoft extensions
          break;
          
        default:
          // Check for Microsoft-specific elements
          if (child.tagName.startsWith('mxliff:') || 
              child.namespaceURI && child.namespaceURI.includes('microsoft')) {
            // Store Microsoft-specific elements in body attributes
            const msKey = `microsoft:${child.tagName}`;
            body.attributes[msKey] = this.serializeElement(child);
          } else {
            console.warn(`Unknown body child element: ${child.tagName}`);
          }
      }
    }

    return body;
  }

  /**
   * Parse translation unit with Microsoft extensions
   */
  private async parseTransUnit(
    transUnitElement: Element,
    context: XLIFFProcessingContext
  ): Promise<XLIFFTransUnit> {
    const attributes = this.extractAttributes(transUnitElement);
    
    const id = attributes.id;
    if (!id) {
      throw new Error('trans-unit element must have an "id" attribute');
    }

    // Parse source first
    const sourceElement = this.findFirstChildElement(transUnitElement, 'source');
    if (!sourceElement) {
      throw new Error('trans-unit must contain a source element');
    }
    const sourceText = this.parseSegmentContent(sourceElement, context);

    const transUnit = new XLIFFTransUnitModel(id, sourceText, attributes);

    // Parse target
    const targetElement = this.findFirstChildElement(transUnitElement, 'target');
    if (targetElement) {
      transUnit.target = this.parseSegmentContent(targetElement, context);
      
      // Extract Microsoft-specific state information
      const state = targetElement.getAttribute('state') || 
                   targetElement.getAttribute('mxliff:state') ||
                   targetElement.getAttribute('microsoft:state');
      
      if (state && this.microsoftStates[state]) {
        transUnit.state = this.microsoftStates[state];
      }
      
      // Extract additional Microsoft attributes
      const msAttributes = this.extractMicrosoftTargetAttributes(targetElement);
      transUnit.metadata.microsoft = { ...transUnit.metadata.microsoft, ...msAttributes };
    }

    // Parse notes
    const noteElements = this.findChildElements(transUnitElement, 'note');
    for (const noteElement of noteElements) {
      const note = this.parseNote(noteElement);
      transUnit.addNote(note);
    }

    // Parse alt-trans elements
    const altTransElements = this.findChildElements(transUnitElement, 'alt-trans');
    for (const altTransElement of altTransElements) {
      const altTrans = this.parseAltTrans(altTransElement, context);
      transUnit.addAltTrans(altTrans);
    }

    // Extract Microsoft-specific metadata
    const microsoftMetadata = this.extractMicrosoftTransUnitMetadata(transUnitElement);
    transUnit.metadata.microsoft = { ...transUnit.metadata.microsoft, ...microsoftMetadata };

    return transUnit;
  }

  /**
   * Parse segment content with Microsoft inline extensions
   */
  private parseSegmentContent(element: Element, context: XLIFFProcessingContext): string {
    let content = '';
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        
        // Handle standard inline elements and Microsoft extensions
        if (this.isInlineElement(el)) {
          const inlineElement = this.parseInlineElement(el, context);
          content += this.serializeInlineElement(inlineElement);
        } else if (el.tagName.startsWith('mxliff:') || 
                   (el.namespaceURI && el.namespaceURI.includes('microsoft'))) {
          // Handle Microsoft-specific inline elements
          const msInline = this.parseMicrosoftInlineElement(el, context);
          content += this.serializeMicrosoftInlineElement(msInline);
        } else {
          content += this.getTextContent(el, context.preserveOriginalStructure);
        }
      }
    }
    
    return content;
  }

  /**
   * Serialize document back to MXLIFF XML format
   */
  public serialize(document: XLIFFDocument): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    
    // Build root element with Microsoft namespaces
    const rootAttrs = this.serializeAttributes(document.attributes);
    const nsDeclarations = this.buildMicrosoftNamespaceDeclarations(document);
    
    xml += `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2"${nsDeclarations}${rootAttrs}>\n`;
    
    // Serialize files
    for (const file of document.files) {
      xml += this.serializeFile(file, 1);
    }
    
    xml += '</xliff>\n';
    
    return xml;
  }

  /**
   * Normalize MXLIFF document to standard XLIFF format
   */
  public normalizeDocument(document: XLIFFDocument): XLIFFDocument {
    // Create a copy of the document without Microsoft extensions
    const normalized = new XLIFFDocumentModel(XLIFFVersion.V1_2, { ...document.attributes });
    
    for (const file of document.files) {
      const normalizedFile = this.normalizeFile(file);
      normalized.addFile(normalizedFile);
    }
    
    return normalized;
  }

  /**
   * Version-specific validation for MXLIFF
   */
  protected validateVersionSpecific(document: XLIFFDocument): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    
    // Validate Microsoft-specific elements
    for (const file of document.files) {
      errors.push(...this.validateMicrosoftExtensions(file));
    }
    
    return errors;
  }

  // Helper methods for Microsoft-specific processing

  /**
   * Extract Microsoft extensions from root element
   */
  private extractMicrosoftExtensions(element: Element): MXLIFFExtensions {
    const extensions: MXLIFFExtensions = {
      microsoftNamespaces: {},
      customMetadata: {},
      stateExtensions: {},
      inlineExtensions: []
    };
    
    // Extract namespace declarations
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith('xmlns:') && 
          (attr.value.includes('microsoft') || attr.value.includes('mxliff'))) {
        extensions.microsoftNamespaces[attr.name] = attr.value;
      }
    }
    
    return extensions;
  }

  /**
   * Extract Microsoft-specific file metadata
   */
  private extractMicrosoftFileMetadata(element: Element): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract Microsoft-specific attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.includes('microsoft') || attr.name.includes('mxliff')) {
        metadata[attr.name] = attr.value;
      }
    }
    
    return metadata;
  }

  /**
   * Extract Microsoft header extensions
   */
  private extractMicrosoftHeaderExtensions(element: Element): Record<string, any> {
    const extensions: Record<string, any> = {};
    
    // Look for Microsoft-specific elements in header
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      if (child.tagName.startsWith('mxliff:') || 
          (child.namespaceURI && child.namespaceURI.includes('microsoft'))) {
        extensions[child.tagName] = this.serializeElement(child);
      }
    }
    
    return extensions;
  }

  /**
   * Extract Microsoft target attributes
   */
  private extractMicrosoftTargetAttributes(element: Element): Record<string, any> {
    const attributes: Record<string, any> = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.includes('microsoft') || attr.name.includes('mxliff')) {
        attributes[attr.name] = attr.value;
      }
    }
    
    return attributes;
  }

  /**
   * Extract Microsoft trans-unit metadata
   */
  private extractMicrosoftTransUnitMetadata(element: Element): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract Microsoft-specific attributes and child elements
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.includes('microsoft') || attr.name.includes('mxliff')) {
        metadata[attr.name] = attr.value;
      }
    }
    
    return metadata;
  }

  /**
   * Parse Microsoft-specific inline elements
   */
  private parseMicrosoftInlineElement(element: Element, context: XLIFFProcessingContext): MXLIFFInlineExtension {
    const attributes = this.extractAttributes(element);
    
    return {
      id: element.getAttribute('id') || '',
      type: element.tagName,
      mxliffType: element.getAttribute('mxliff:type'),
      microsoftId: element.getAttribute('microsoft:id'),
      content: this.getTextContent(element, context.preserveOriginalStructure),
      attributes
    };
  }

  /**
   * Serialize Microsoft inline element
   */
  private serializeMicrosoftInlineElement(element: MXLIFFInlineExtension): string {
    const attrs = this.serializeAttributes(element.attributes);
    return `<${element.type}${attrs}>${element.content || ''}</${element.type}>`;
  }

  /**
   * Build Microsoft namespace declarations
   */
  private buildMicrosoftNamespaceDeclarations(document: XLIFFDocument): string {
    let declarations = '';
    
    const extensions = document.metadata.microsoftExtensions as MXLIFFExtensions;
    if (extensions && extensions.microsoftNamespaces) {
      for (const [prefix, uri] of Object.entries(extensions.microsoftNamespaces)) {
        declarations += ` ${prefix}="${uri}"`;
      }
    }
    
    // Add common Microsoft namespaces if not present
    if (!declarations.includes('xmlns:mxliff')) {
      declarations += ' xmlns:mxliff="urn:microsoft:psi-extension"';
    }
    
    return declarations;
  }

  /**
   * Validate Microsoft extensions
   */
  private validateMicrosoftExtensions(file: XLIFFFile): XLIFFParsingError[] {
    const errors: XLIFFParsingError[] = [];
    
    // Validate Microsoft-specific constraints
    // This can be extended based on specific MXLIFF validation requirements
    
    return errors;
  }

  /**
   * Normalize file by removing Microsoft extensions
   */
  private normalizeFile(file: XLIFFFile): XLIFFFile {
    // Create normalized version without Microsoft-specific attributes
    const normalizedAttrs = this.filterMicrosoftAttributes(file.attributes);
    const normalizedFile = new XLIFFFileModel(
      file.original,
      file.sourceLanguage,
      file.datatype,
      normalizedAttrs
    );
    
    if (file.targetLanguage) {
      normalizedFile.targetLanguage = file.targetLanguage;
    }
    
    // Normalize header
    if (file.header) {
      normalizedFile.setHeader(this.normalizeHeader(file.header));
    }
    
    // Normalize body
    normalizedFile.body = this.normalizeBody(file.body);
    
    return normalizedFile;
  }

  /**
   * Normalize header by removing Microsoft extensions
   */
  private normalizeHeader(header: XLIFFHeader): XLIFFHeader {
    const normalizedAttrs = this.filterMicrosoftAttributes(header.attributes);
    const normalizedHeader = new XLIFFHeaderModel(normalizedAttrs);
    
    // Copy standard properties and notes
    for (const [key, value] of Object.entries(header.properties)) {
      if (!key.includes('microsoft') && !key.includes('mxliff')) {
        normalizedHeader.setProperty(key, value);
      }
    }
    
    for (const note of header.notes) {
      normalizedHeader.addNote(note);
    }
    
    return normalizedHeader;
  }

  /**
   * Normalize body by removing Microsoft extensions
   */
  private normalizeBody(body: XLIFFBody): XLIFFBody {
    const normalizedAttrs = this.filterMicrosoftAttributes(body.attributes);
    const normalizedBody = new XLIFFBodyModel(normalizedAttrs);
    
    // Normalize trans-units
    for (const transUnit of body.transUnits) {
      const normalizedTransUnit = this.normalizeTransUnit(transUnit);
      normalizedBody.addTransUnit(normalizedTransUnit);
    }
    
    // Normalize groups
    for (const group of body.groups) {
      const normalizedGroup = this.normalizeGroup(group);
      normalizedBody.addGroup(normalizedGroup);
    }
    
    return normalizedBody;
  }

  /**
   * Normalize trans-unit by removing Microsoft extensions
   */
  private normalizeTransUnit(transUnit: XLIFFTransUnit): XLIFFTransUnit {
    const normalizedAttrs = this.filterMicrosoftAttributes(transUnit.attributes);
    const normalizedTransUnit = new XLIFFTransUnitModel(transUnit.id, transUnit.source, normalizedAttrs);
    
    normalizedTransUnit.target = transUnit.target;
    normalizedTransUnit.state = transUnit.state;
    normalizedTransUnit.approved = transUnit.approved;
    normalizedTransUnit.translate = transUnit.translate;
    
    // Copy standard properties
    for (const note of transUnit.notes) {
      normalizedTransUnit.addNote(note);
    }
    
    for (const altTrans of transUnit.altTrans) {
      normalizedTransUnit.addAltTrans(altTrans);
    }
    
    return normalizedTransUnit;
  }

  /**
   * Filter out Microsoft-specific attributes
   */
  private filterMicrosoftAttributes(attributes: Record<string, string | number | boolean>): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      if (!key.includes('microsoft') && !key.includes('mxliff') && !key.startsWith('xmlns:mxliff')) {
        filtered[key] = String(value);
      }
    }
    
    return filtered;
  }

  // Utility methods that override base class methods with proper types

  /**
   * Check if element is an inline element
   */
  protected isInlineElement(element: Element): boolean {
    const inlineTags = ['g', 'x', 'bx', 'ex', 'bpt', 'ept', 'ph', 'it', 'mrk', 'sub'];
    return inlineTags.includes(element.tagName);
  }

  /**
   * Parse inline element
   */
  protected parseInlineElement(element: Element, context: XLIFFProcessingContext): XLIFFInlineElement {
    const attributes = this.extractAttributes(element);
    
    return new XLIFFInlineElementModel(
      element.tagName,
      attributes,
      this.getTextContent(element, context.preserveOriginalStructure)
    );
  }

  /**
   * Serialize inline element
   */
  protected serializeInlineElement(element: XLIFFInlineElement): string {
    const attrs = this.serializeAttributes(element.attributes);
    if (element.textContent) {
      return `<${element.tagName}${attrs}>${element.textContent}</${element.tagName}>`;
    } else {
      return `<${element.tagName}${attrs}/>`;
    }
  }

  /**
   * Parse note element
   */
  protected parseNote(element: Element): XLIFFNote {
    const attributes = this.extractAttributes(element);
    const content = element.textContent || '';
    
    return new XLIFFNoteModel(content, attributes);
  }

  /**
   * Parse alt-trans element
   */
  protected parseAltTrans(element: Element, context: XLIFFProcessingContext): XLIFFAltTrans {
    const attributes = this.extractAttributes(element);
    
    const sourceElement = this.findFirstChildElement(element, 'source');
    const targetElement = this.findFirstChildElement(element, 'target');
    
    const source = sourceElement ? this.parseSegmentContent(sourceElement, context) : '';
    const target = targetElement ? this.parseSegmentContent(targetElement, context) : '';
    
    const altTrans = new XLIFFAltTransModel(target, attributes);
    if (source) {
      altTrans.source = source;
    }
    return altTrans;
  }

  /**
   * Parse group element
   */
  protected async parseGroup(element: Element, context: XLIFFProcessingContext): Promise<XLIFFGroup> {
    const attributes = this.extractAttributes(element);
    const group = new XLIFFGroupModel(attributes);
    
    // Parse child elements
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      
      switch (child.tagName) {
        case 'trans-unit':
          const transUnit = await this.parseTransUnit(child, context);
          group.addTransUnit(transUnit);
          break;
          
        case 'group':
          const nestedGroup = await this.parseGroup(child, context);
          group.addSubGroup(nestedGroup);
          break;
      }
    }
    
    return group;
  }

  /**
   * Normalize group by removing Microsoft extensions
   */
  private normalizeGroup(group: XLIFFGroup): XLIFFGroup {
    const normalizedAttrs = this.filterMicrosoftAttributes(group.attributes);
    const normalizedGroup = new XLIFFGroupModel(normalizedAttrs);
    
    // Normalize child trans-units
    for (const transUnit of group.transUnits) {
      const normalizedTransUnit = this.normalizeTransUnit(transUnit);
      normalizedGroup.addTransUnit(normalizedTransUnit);
    }
    
    // Normalize child groups
    for (const childGroup of group.subGroups) {
      const normalizedChildGroup = this.normalizeGroup(childGroup);
      normalizedGroup.addSubGroup(normalizedChildGroup);
    }
    
    return normalizedGroup;
  }

  /**
   * Serialize attributes to string
   */
  protected serializeAttributes(attributes: Record<string, string | number | boolean>): string {
    let result = '';
    
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        result += ` ${key}="${this.escapeXML(String(value))}"`;
      }
    }
    
    return result;
  }

  /**
   * Serialize file to XML
   */
  private serializeFile(file: XLIFFFile, indent: number): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<file${this.serializeAttributes(file.attributes)}>\n`;
    
    if (file.header) {
      xml += this.serializeHeader(file.header, indent + 1);
    }
    
    xml += this.serializeBody(file.body, indent + 1);
    xml += `${indentStr}</file>\n`;
    
    return xml;
  }

  /**
   * Serialize header to XML
   */
  private serializeHeader(header: XLIFFHeader, indent: number): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<header${this.serializeAttributes(header.attributes)}>\n`;
    
    // Serialize properties
    for (const [key, value] of Object.entries(header.properties)) {
      xml += `${indentStr}  <prop prop-type="${this.escapeXML(key)}">${this.escapeXML(value)}</prop>\n`;
    }
    
    // Serialize notes
    for (const note of header.notes) {
      xml += `${indentStr}  <note${this.serializeAttributes(note.attributes)}>${this.escapeXML(note.content)}</note>\n`;
    }
    
    xml += `${indentStr}</header>\n`;
    
    return xml;
  }

  /**
   * Serialize body to XML
   */
  private serializeBody(body: XLIFFBody, indent: number): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<body${this.serializeAttributes(body.attributes)}>\n`;
    
    // Serialize groups and trans-units
    for (const group of body.groups) {
      xml += this.serializeGroup(group, indent + 1);
    }
    
    for (const transUnit of body.transUnits) {
      xml += this.serializeTransUnit(transUnit, indent + 1);
    }
    
    xml += `${indentStr}</body>\n`;
    
    return xml;
  }

  /**
   * Serialize group to XML
   */
  private serializeGroup(group: XLIFFGroup, indent: number): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<group${this.serializeAttributes(group.attributes)}>\n`;
    
    for (const childGroup of group.subGroups) {
      xml += this.serializeGroup(childGroup, indent + 1);
    }
    
    for (const transUnit of group.transUnits) {
      xml += this.serializeTransUnit(transUnit, indent + 1);
    }
    
    xml += `${indentStr}</group>\n`;
    
    return xml;
  }

  /**
   * Serialize trans-unit to XML
   */
  private serializeTransUnit(transUnit: XLIFFTransUnit, indent: number): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<trans-unit${this.serializeAttributes(transUnit.attributes)}>\n`;
    
    xml += `${indentStr}  <source>${this.escapeXML(transUnit.source)}</source>\n`;
    
    if (transUnit.target) {
      const targetAttrs = transUnit.state ? ` state="${transUnit.state}"` : '';
      xml += `${indentStr}  <target${targetAttrs}>${this.escapeXML(transUnit.target)}</target>\n`;
    }
    
    for (const note of transUnit.notes) {
      xml += `${indentStr}  <note${this.serializeAttributes(note.attributes)}>${this.escapeXML(note.content)}</note>\n`;
    }
    
    for (const altTrans of transUnit.altTrans) {
      xml += `${indentStr}  <alt-trans${this.serializeAttributes(altTrans.attributes)}>\n`;
      if (altTrans.source) {
        xml += `${indentStr}    <source>${this.escapeXML(altTrans.source)}</source>\n`;
      }
      xml += `${indentStr}    <target>${this.escapeXML(altTrans.target)}</target>\n`;
      xml += `${indentStr}  </alt-trans>\n`;
    }
    
    xml += `${indentStr}</trans-unit>\n`;
    
    return xml;
  }

  /**
   * Serialize element to string
   */
  private serializeElement(element: Element): string {
    return element.outerHTML;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Create parsing error
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
      details
    };
  }
} 