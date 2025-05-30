/**
 * XLIFF Parser Library
 * Main entry point for XLIFF parsing functionality
 */

// Core types and interfaces
export * from './types';

// Data models
export * from './models';

// Base classes
export { AbstractXLIFFParser } from './base/AbstractParser';

// Factory and utilities
export { 
  xliffParserFactory, 
  createXLIFFParser, 
  detectXLIFFVersion 
} from './factory';

// Validation framework
export * from './validation';

// Version-specific parsers
export { XLIFF12Parser } from './v1.2';
export { XLIFF20Parser } from './v2.0';

// Import to trigger registration (side effect)
import './v1.2';
import './v2.0';

// Re-export factory instance as default
export { xliffParserFactory as default } from './factory'; 