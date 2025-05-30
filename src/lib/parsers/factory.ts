/**
 * XLIFF Parser Factory
 * Detects XLIFF versions and creates appropriate parsers
 */

import {
  XLIFFParser,
  XLIFFParserFactory,
  XLIFFVersion,
  XLIFFParsingError,
  XLIFFErrorType,
  ErrorSeverity
} from './types';

/**
 * Registry entry for parsers
 */
interface ParserRegistryEntry {
  version: XLIFFVersion;
  parserClass: new () => XLIFFParser;
  priority: number; // Higher priority = checked first
}

/**
 * XLIFF Parser Factory Implementation
 */
export class XLIFFParserFactoryImpl implements XLIFFParserFactory {
  private readonly parsers: Map<XLIFFVersion, ParserRegistryEntry> = new Map();
  private readonly versionDetectors: Array<{
    version: XLIFFVersion;
    detector: (xmlContent: string) => boolean;
    priority: number;
  }> = [];

  constructor() {
    this.initializeVersionDetectors();
  }

  /**
   * Create parser for given XML content
   */
  public createParser(xmlContent: string): XLIFFParser | null {
    const version = this.detectVersion(xmlContent);
    if (!version) {
      return null;
    }

    const entry = this.parsers.get(version);
    if (!entry) {
      throw new Error(`No parser registered for XLIFF version: ${version}`);
    }

    return new entry.parserClass();
  }

  /**
   * Detect XLIFF version from XML content
   */
  public detectVersion(xmlContent: string): XLIFFVersion | null {
    if (!xmlContent || xmlContent.trim().length === 0) {
      return null;
    }

    // Sort detectors by priority (highest first)
    const sortedDetectors = [...this.versionDetectors]
      .sort((a, b) => b.priority - a.priority);

    for (const detector of sortedDetectors) {
      try {
        if (detector.detector(xmlContent)) {
          return detector.version;
        }
      } catch (error) {
        // Continue to next detector if this one fails
        console.warn(`Version detector for ${detector.version} failed:`, error);
      }
    }

    return null;
  }

  /**
   * Register a parser for a specific version
   */
  public registerParser(
    version: XLIFFVersion,
    parserClass: new () => XLIFFParser,
    priority = 100
  ): void {
    const entry: ParserRegistryEntry = {
      version,
      parserClass,
      priority
    };

    this.parsers.set(version, entry);

    // Register the parser's version detector if it has one
    const tempParser = new parserClass();
    if (tempParser.detectVersion) {
      this.registerVersionDetector(
        version,
        tempParser.detectVersion.bind(tempParser),
        priority
      );
    }
  }

  /**
   * Get supported versions
   */
  public getSupportedVersions(): XLIFFVersion[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Register a version detector function
   */
  public registerVersionDetector(
    version: XLIFFVersion,
    detector: (xmlContent: string) => boolean,
    priority = 100
  ): void {
    // Remove existing detector for this version
    const existingIndex = this.versionDetectors.findIndex(d => d.version === version);
    if (existingIndex !== -1) {
      this.versionDetectors.splice(existingIndex, 1);
    }

    this.versionDetectors.push({
      version,
      detector,
      priority
    });
  }

  /**
   * Unregister a parser
   */
  public unregisterParser(version: XLIFFVersion): void {
    this.parsers.delete(version);
    
    // Remove associated detector
    const detectorIndex = this.versionDetectors.findIndex(d => d.version === version);
    if (detectorIndex !== -1) {
      this.versionDetectors.splice(detectorIndex, 1);
    }
  }

  /**
   * Check if a version is supported
   */
  public isVersionSupported(version: XLIFFVersion): boolean {
    return this.parsers.has(version);
  }

  /**
   * Get parser info for debugging
   */
  public getParserInfo(): Array<{
    version: XLIFFVersion;
    priority: number;
    hasDetector: boolean;
  }> {
    return Array.from(this.parsers.entries()).map(([version, entry]) => ({
      version,
      priority: entry.priority,
      hasDetector: this.versionDetectors.some(d => d.version === version)
    }));
  }

  /**
   * Initialize built-in version detectors
   */
  private initializeVersionDetectors(): void {
    // XLIFF 1.2 detector
    this.registerVersionDetector(
      XLIFFVersion.V1_2,
      this.detectXLIFF12.bind(this),
      200
    );

    // XLIFF 2.0 detector
    this.registerVersionDetector(
      XLIFFVersion.V2_0,
      this.detectXLIFF20.bind(this),
      300
    );

    // MXLIFF detector (check before 1.2 as it's based on 1.2)
    this.registerVersionDetector(
      XLIFFVersion.MXLIFF,
      this.detectMXLIFF.bind(this),
      250
    );
  }

  /**
   * Detect XLIFF 1.2 format
   */
  private detectXLIFF12(xmlContent: string): boolean {
    // Check for XLIFF 1.2 specific patterns
    const patterns = [
      /version\s*=\s*["']1\.2["']/i,
      /xliff\s+xmlns\s*=\s*["']urn:oasis:names:tc:xliff:document:1\.2["']/i,
      /<!DOCTYPE\s+xliff\s+PUBLIC\s+[^>]*1\.2[^>]*>/i
    ];

    return patterns.some(pattern => pattern.test(xmlContent));
  }

  /**
   * Detect XLIFF 2.0 format
   */
  private detectXLIFF20(xmlContent: string): boolean {
    // Check for XLIFF 2.0 specific patterns
    const patterns = [
      /version\s*=\s*["']2\.0["']/i,
      /version\s*=\s*["']2\.1["']/i,
      /xliff\s+xmlns\s*=\s*["']urn:oasis:names:tc:xliff:document:2\.0["']/i,
      /xliff\s+xmlns\s*=\s*["']urn:oasis:names:tc:xliff:document:2\.1["']/i,
      /<xliff[^>]+version\s*=\s*["']2\.[01]["'][^>]*>/i
    ];

    return patterns.some(pattern => pattern.test(xmlContent));
  }

  /**
   * Detect MXLIFF (Microsoft XLIFF) format
   */
  private detectMXLIFF(xmlContent: string): boolean {
    // Check for MXLIFF specific patterns
    const patterns = [
      /xmlns:mxliff\s*=\s*["'][^"']*["']/i,
      /mxliff:/i,
      /tool-id\s*=\s*["']Microsoft/i,
      /tool-name\s*=\s*["']Microsoft/i,
      /<mxliff:/i,
      /cmxliff:/i
    ];

    // MXLIFF is usually based on XLIFF 1.2, so also check for that
    const isXliff12Base = this.detectXLIFF12(xmlContent);
    const hasMxliffMarkers = patterns.some(pattern => pattern.test(xmlContent));

    return isXliff12Base && hasMxliffMarkers;
  }

  /**
   * Create parsing error for unsupported versions
   */
  public createUnsupportedVersionError(xmlContent: string): XLIFFParsingError {
    const attemptedVersion = this.detectVersionFromXML(xmlContent);
    
    return {
      type: XLIFFErrorType.UNKNOWN_VERSION,
      severity: ErrorSeverity.CRITICAL,
      message: attemptedVersion 
        ? `Unsupported XLIFF version: ${attemptedVersion}. Supported versions: ${this.getSupportedVersions().join(', ')}`
        : `Unable to detect XLIFF version. Supported versions: ${this.getSupportedVersions().join(', ')}`,
      details: {
        supportedVersions: this.getSupportedVersions(),
        detectedVersion: attemptedVersion
      }
    };
  }

  /**
   * Attempt to extract version string from XML for error reporting
   */
  private detectVersionFromXML(xmlContent: string): string | null {
    const versionMatch = xmlContent.match(/version\s*=\s*["']([^"']+)["']/i);
    return versionMatch ? versionMatch[1] : null;
  }
}

/**
 * Default factory instance
 */
export const xliffParserFactory = new XLIFFParserFactoryImpl();

/**
 * Convenience function to create parser
 */
export function createXLIFFParser(xmlContent: string): XLIFFParser | null {
  return xliffParserFactory.createParser(xmlContent);
}

/**
 * Convenience function to detect version
 */
export function detectXLIFFVersion(xmlContent: string): XLIFFVersion | null {
  return xliffParserFactory.detectVersion(xmlContent);
} 