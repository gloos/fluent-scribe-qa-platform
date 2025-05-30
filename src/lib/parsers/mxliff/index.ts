/**
 * Microsoft XLIFF (MXLIFF) parser module
 * Provides support for parsing Microsoft XLIFF format files
 */

import { MXLIFFParser } from './MXLIFFParser';
import { xliffParserFactory } from '../factory';
import { XLIFFVersion } from '../types';

// Register the MXLIFF parser with the factory
xliffParserFactory.registerParser(
  XLIFFVersion.MXLIFF,
  MXLIFFParser,
  250 // Between XLIFF 2.0 (300) and XLIFF 1.2 (200)
);

// Export the parser class
export { MXLIFFParser };
export * from './MXLIFFParser'; 