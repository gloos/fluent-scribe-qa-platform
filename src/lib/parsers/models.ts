/**
 * Data model classes for XLIFF parser architecture
 * Provides concrete implementations of XLIFF interfaces
 */

import {
  XLIFFDocument,
  XLIFFFile,
  XLIFFTransUnit,
  XLIFFHeader,
  XLIFFBody,
  XLIFFGroup,
  XLIFFNote,
  XLIFFAltTrans,
  XLIFFBinUnit,
  XLIFFInlineElement,
  XLIFFAttributes,
  XLIFFVersion,
  XLIFFElement
} from './types';

/**
 * Base element class providing common functionality
 */
export class BaseXLIFFElement implements XLIFFElement {
  public tagName: string;
  public attributes: XLIFFAttributes;
  public textContent?: string;
  public children: XLIFFElement[];
  public parent?: XLIFFElement;

  constructor(
    tagName: string,
    attributes: XLIFFAttributes = {},
    textContent?: string
  ) {
    this.tagName = tagName;
    this.attributes = { ...attributes };
    this.textContent = textContent;
    this.children = [];
  }

  /**
   * Add a child element
   */
  addChild(element: XLIFFElement): void {
    element.parent = this;
    this.children.push(element);
  }

  /**
   * Get attribute value with optional default
   */
  getAttribute(name: string, defaultValue?: string | number | boolean): any {
    return this.attributes[name] ?? defaultValue;
  }

  /**
   * Set attribute value
   */
  setAttribute(name: string, value: string | number | boolean): void {
    this.attributes[name] = value;
  }

  /**
   * Find child elements by tag name
   */
  findChildrenByTag(tagName: string): XLIFFElement[] {
    return this.children.filter(child => child.tagName === tagName);
  }

  /**
   * Get first child element by tag name
   */
  findFirstChildByTag(tagName: string): XLIFFElement | undefined {
    return this.children.find(child => child.tagName === tagName);
  }
}

/**
 * XLIFF inline element implementation
 */
export class XLIFFInlineElementModel extends BaseXLIFFElement implements XLIFFInlineElement {
  public id?: string;
  public ctype?: string;
  public equiv?: string;
  public pos?: 'open' | 'close' | 'both';

  constructor(
    tagName: string,
    attributes: XLIFFAttributes = {},
    textContent?: string
  ) {
    super(tagName, attributes, textContent);
    this.id = attributes.id as string;
    this.ctype = attributes.ctype as string;
    this.equiv = attributes.equiv as string;
    this.pos = attributes.pos as 'open' | 'close' | 'both';
  }
}

/**
 * XLIFF note implementation
 */
export class XLIFFNoteModel implements XLIFFNote {
  public id?: string;
  public from?: string;
  public priority?: number;
  public lang?: string;
  public content: string;
  public attributes: XLIFFAttributes;

  constructor(
    content: string,
    attributes: XLIFFAttributes = {}
  ) {
    this.content = content;
    this.attributes = { ...attributes };
    this.id = attributes.id as string;
    this.from = attributes.from as string;
    this.priority = attributes.priority as number;
    this.lang = attributes.lang as string;
  }

  static fromElement(element: XLIFFElement): XLIFFNoteModel {
    return new XLIFFNoteModel(
      element.textContent || '',
      element.attributes
    );
  }
}

/**
 * XLIFF alternative translation implementation
 */
export class XLIFFAltTransModel implements XLIFFAltTrans {
  public id?: string;
  public matchQuality?: number;
  public tool?: string;
  public origin?: string;
  public source?: string;
  public target: string;
  public attributes: XLIFFAttributes;

  constructor(
    target: string,
    attributes: XLIFFAttributes = {}
  ) {
    this.target = target;
    this.attributes = { ...attributes };
    this.id = attributes.id as string;
    this.matchQuality = attributes['match-quality'] as number;
    this.tool = attributes.tool as string;
    this.origin = attributes.origin as string;
    this.source = attributes.source as string;
  }
}

/**
 * XLIFF translation unit implementation
 */
export class XLIFFTransUnitModel implements XLIFFTransUnit {
  public id: string;
  public source: string;
  public target?: string;
  public state?: string;
  public approved?: boolean;
  public translate?: boolean;
  public resname?: string;
  public restype?: string;
  public extradata?: string;
  public help?: string;
  public coord?: string;
  public font?: string;
  public css?: string;
  public style?: string;
  public equiv?: string;
  public attributes: XLIFFAttributes;
  public notes: XLIFFNote[];
  public altTrans: XLIFFAltTrans[];
  public inlineElements: XLIFFInlineElement[];
  public metadata: Record<string, any>;

  constructor(
    id: string,
    source: string,
    attributes: XLIFFAttributes = {}
  ) {
    this.id = id;
    this.source = source;
    this.attributes = { ...attributes };
    this.notes = [];
    this.altTrans = [];
    this.inlineElements = [];
    this.metadata = {};

    // Extract standard attributes
    this.target = attributes.target as string;
    this.state = attributes.state as string;
    this.approved = attributes.approved as boolean;
    this.translate = attributes.translate as boolean;
    this.resname = attributes.resname as string;
    this.restype = attributes.restype as string;
    this.extradata = attributes.extradata as string;
    this.help = attributes.help as string;
    this.coord = attributes.coord as string;
    this.font = attributes.font as string;
    this.css = attributes.css as string;
    this.style = attributes.style as string;
    this.equiv = attributes.equiv as string;
  }

  /**
   * Add a note to this translation unit
   */
  addNote(note: XLIFFNote): void {
    this.notes.push(note);
  }

  /**
   * Add an alternative translation
   */
  addAltTrans(altTrans: XLIFFAltTrans): void {
    this.altTrans.push(altTrans);
  }

  /**
   * Add an inline element
   */
  addInlineElement(element: XLIFFInlineElement): void {
    this.inlineElements.push(element);
  }

  /**
   * Check if translation unit is approved
   */
  isApproved(): boolean {
    return this.approved === true || this.state === 'final' || this.state === 'signed-off';
  }

  /**
   * Check if translation unit needs translation
   */
  needsTranslation(): boolean {
    return this.translate !== false && (!this.target || this.target.trim() === '');
  }

  /**
   * Get word count for source text
   */
  getSourceWordCount(): number {
    return this.source.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get word count for target text
   */
  getTargetWordCount(): number {
    if (!this.target) return 0;
    return this.target.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

/**
 * XLIFF group implementation
 */
export class XLIFFGroupModel implements XLIFFGroup {
  public id?: string;
  public datatype?: string;
  public restype?: string;
  public resname?: string;
  public extradata?: string;
  public help?: string;
  public coord?: string;
  public font?: string;
  public css?: string;
  public style?: string;
  public translate?: boolean;
  public reformat?: string;
  public transUnits: XLIFFTransUnit[];
  public subGroups: XLIFFGroup[];
  public attributes: XLIFFAttributes;
  public notes: XLIFFNote[];

  constructor(attributes: XLIFFAttributes = {}) {
    this.attributes = { ...attributes };
    this.transUnits = [];
    this.subGroups = [];
    this.notes = [];

    // Extract standard attributes
    this.id = attributes.id as string;
    this.datatype = attributes.datatype as string;
    this.restype = attributes.restype as string;
    this.resname = attributes.resname as string;
    this.extradata = attributes.extradata as string;
    this.help = attributes.help as string;
    this.coord = attributes.coord as string;
    this.font = attributes.font as string;
    this.css = attributes.css as string;
    this.style = attributes.style as string;
    this.translate = attributes.translate as boolean;
    this.reformat = attributes.reformat as string;
  }

  /**
   * Add a translation unit to this group
   */
  addTransUnit(transUnit: XLIFFTransUnit): void {
    this.transUnits.push(transUnit);
  }

  /**
   * Add a sub-group to this group
   */
  addSubGroup(group: XLIFFGroup): void {
    this.subGroups.push(group);
  }

  /**
   * Get all translation units including those in sub-groups
   */
  getAllTransUnits(): XLIFFTransUnit[] {
    const allUnits = [...this.transUnits];
    for (const subGroup of this.subGroups) {
      allUnits.push(...subGroup.transUnits);
    }
    return allUnits;
  }
}

/**
 * XLIFF body implementation
 */
export class XLIFFBodyModel implements XLIFFBody {
  public transUnits: XLIFFTransUnit[];
  public groups: XLIFFGroup[];
  public binUnits: XLIFFBinUnit[];
  public attributes: XLIFFAttributes;

  constructor(attributes: XLIFFAttributes = {}) {
    this.attributes = { ...attributes };
    this.transUnits = [];
    this.groups = [];
    this.binUnits = [];
  }

  /**
   * Add a translation unit
   */
  addTransUnit(transUnit: XLIFFTransUnit): void {
    this.transUnits.push(transUnit);
  }

  /**
   * Add a group
   */
  addGroup(group: XLIFFGroup): void {
    this.groups.push(group);
  }

  /**
   * Add a binary unit
   */
  addBinUnit(binUnit: XLIFFBinUnit): void {
    this.binUnits.push(binUnit);
  }

  /**
   * Get all translation units from body and groups
   */
  getAllTransUnits(): XLIFFTransUnit[] {
    const allUnits = [...this.transUnits];
    for (const group of this.groups) {
      if (group instanceof XLIFFGroupModel) {
        allUnits.push(...group.getAllTransUnits());
      } else {
        allUnits.push(...group.transUnits);
      }
    }
    return allUnits;
  }

  /**
   * Get total segment count
   */
  getTotalSegmentCount(): number {
    return this.getAllTransUnits().length;
  }
}

/**
 * XLIFF header implementation
 */
export class XLIFFHeaderModel implements XLIFFHeader {
  public skl?: any;
  public phaseGroup?: any;
  public glossary?: any;
  public reference?: any;
  public countGroup?: any;
  public toolInfo?: any;
  public revisions?: any;
  public notes: XLIFFNote[];
  public properties: Record<string, string>;
  public attributes: XLIFFAttributes;

  constructor(attributes: XLIFFAttributes = {}) {
    this.attributes = { ...attributes };
    this.notes = [];
    this.properties = {};
  }

  /**
   * Add a note to the header
   */
  addNote(note: XLIFFNote): void {
    this.notes.push(note);
  }

  /**
   * Set a property
   */
  setProperty(name: string, value: string): void {
    this.properties[name] = value;
  }

  /**
   * Get a property
   */
  getProperty(name: string, defaultValue?: string): string | undefined {
    return this.properties[name] ?? defaultValue;
  }
}

/**
 * XLIFF file implementation
 */
export class XLIFFFileModel implements XLIFFFile {
  public original: string;
  public sourceLanguage: string;
  public targetLanguage?: string;
  public datatype: string;
  public tool?: string;
  public toolId?: string;
  public toolName?: string;
  public toolVersion?: string;
  public toolCompany?: string;
  public buildNum?: string;
  public productName?: string;
  public productVersion?: string;
  public productCompany?: string;
  public date?: string;
  public header?: XLIFFHeader;
  public body: XLIFFBody;
  public attributes: XLIFFAttributes;
  public metadata: Record<string, any>;

  constructor(
    original: string,
    sourceLanguage: string,
    datatype: string,
    attributes: XLIFFAttributes = {}
  ) {
    this.original = original;
    this.sourceLanguage = sourceLanguage;
    this.datatype = datatype;
    this.attributes = { ...attributes };
    this.metadata = {};
    this.body = new XLIFFBodyModel();

    // Extract standard attributes
    this.targetLanguage = attributes['target-language'] as string;
    this.tool = attributes.tool as string;
    this.toolId = attributes['tool-id'] as string;
    this.toolName = attributes['tool-name'] as string;
    this.toolVersion = attributes['tool-version'] as string;
    this.toolCompany = attributes['tool-company'] as string;
    this.buildNum = attributes['build-num'] as string;
    this.productName = attributes['product-name'] as string;
    this.productVersion = attributes['product-version'] as string;
    this.productCompany = attributes['product-company'] as string;
    this.date = attributes.date as string;
  }

  /**
   * Set the header
   */
  setHeader(header: XLIFFHeader): void {
    this.header = header;
  }

  /**
   * Get all translation units from this file
   */
  getAllTransUnits(): XLIFFTransUnit[] {
    return this.body.getAllTransUnits();
  }

  /**
   * Get total segment count for this file
   */
  getTotalSegmentCount(): number {
    return this.body.getTotalSegmentCount();
  }

  /**
   * Get word count statistics
   */
  getWordCountStats(): { source: number; target: number } {
    const allUnits = this.getAllTransUnits();
    return {
      source: allUnits.reduce((sum, unit) => {
        if (unit instanceof XLIFFTransUnitModel) {
          return sum + unit.getSourceWordCount();
        }
        return sum + (unit.source?.split(/\s+/).length || 0);
      }, 0),
      target: allUnits.reduce((sum, unit) => {
        if (unit instanceof XLIFFTransUnitModel) {
          return sum + unit.getTargetWordCount();
        }
        return sum + (unit.target?.split(/\s+/).length || 0);
      }, 0)
    };
  }
}

/**
 * XLIFF document implementation
 */
export class XLIFFDocumentModel implements XLIFFDocument {
  public version: XLIFFVersion;
  public xmlns?: string;
  public files: XLIFFFile[];
  public attributes: XLIFFAttributes;
  public metadata: Record<string, any>;
  public originalXML?: string;

  constructor(
    version: XLIFFVersion,
    attributes: XLIFFAttributes = {}
  ) {
    this.version = version;
    this.attributes = { ...attributes };
    this.files = [];
    this.metadata = {};
    this.xmlns = attributes.xmlns as string;
  }

  /**
   * Add a file to the document
   */
  addFile(file: XLIFFFile): void {
    this.files.push(file);
  }

  /**
   * Get all translation units from all files
   */
  getAllTransUnits(): XLIFFTransUnit[] {
    const allUnits: XLIFFTransUnit[] = [];
    for (const file of this.files) {
      allUnits.push(...file.body.getAllTransUnits());
    }
    return allUnits;
  }

  /**
   * Get total segment count across all files
   */
  getTotalSegmentCount(): number {
    return this.files.reduce((total, file) => {
      if (file instanceof XLIFFFileModel) {
        return total + file.getTotalSegmentCount();
      }
      return total + file.body.getAllTransUnits().length;
    }, 0);
  }

  /**
   * Get total word count statistics
   */
  getTotalWordCounts(): { source: number; target: number } {
    return this.files.reduce(
      (totals, file) => {
        if (file instanceof XLIFFFileModel) {
          const fileCounts = file.getWordCountStats();
          totals.source += fileCounts.source;
          totals.target += fileCounts.target;
        } else {
          // Fallback for non-model files
          const allUnits = file.body.getAllTransUnits();
          totals.source += allUnits.reduce(
            (sum, unit) => sum + (unit.source?.split(/\s+/).length || 0),
            0
          );
          totals.target += allUnits.reduce(
            (sum, unit) => sum + (unit.target?.split(/\s+/).length || 0),
            0
          );
        }
        return totals;
      },
      { source: 0, target: 0 }
    );
  }

  /**
   * Find file by original name
   */
  findFileByOriginal(original: string): XLIFFFile | undefined {
    return this.files.find(file => file.original === original);
  }

  /**
   * Get document summary
   */
  getSummary(): {
    version: XLIFFVersion;
    fileCount: number;
    totalSegments: number;
    wordCounts: { source: number; target: number };
    languages: { source: Set<string>; target: Set<string> };
  } {
    const wordCounts = this.getTotalWordCounts();
    const sourceLanguages = new Set<string>();
    const targetLanguages = new Set<string>();

    this.files.forEach(file => {
      sourceLanguages.add(file.sourceLanguage);
      if (file.targetLanguage) {
        targetLanguages.add(file.targetLanguage);
      }
    });

    return {
      version: this.version,
      fileCount: this.files.length,
      totalSegments: this.getTotalSegmentCount(),
      wordCounts,
      languages: {
        source: sourceLanguages,
        target: targetLanguages
      }
    };
  }
} 