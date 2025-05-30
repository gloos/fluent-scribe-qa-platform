/**
 * XLIFF 1.2 Parser Module
 * Exports and registers the XLIFF 1.2 parser
 */

export { XLIFF12Parser } from './XLIFF12Parser';

// Register the parser with the factory (this will be imported by the main index)
import { xliffParserFactory } from '../factory';
import { XLIFF12Parser } from './XLIFF12Parser';
import { XLIFFVersion } from '../types';

// Register XLIFF 1.2 parser with priority 200 (high priority)
xliffParserFactory.registerParser(XLIFFVersion.V1_2, XLIFF12Parser, 200); 