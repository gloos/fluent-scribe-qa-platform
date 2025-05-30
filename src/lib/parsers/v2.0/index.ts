/**
 * XLIFF 2.0 Parser Module
 * Exports and registers the XLIFF 2.0 parser
 */

export { XLIFF20Parser } from './XLIFF20Parser';

// Register the parser with the factory (this will be imported by the main index)
import { xliffParserFactory } from '../factory';
import { XLIFF20Parser } from './XLIFF20Parser';
import { XLIFFVersion } from '../types';

// Register XLIFF 2.0 parser with priority 200 (high priority)
xliffParserFactory.registerParser(XLIFFVersion.V2_0, XLIFF20Parser, 200); 