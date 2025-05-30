/**
 * Dedicated Logging System for XLIFF Parsers
 * Provides structured logging with multiple formatters and performance tracking
 */

import { EnhancedXLIFFError } from './errors';

/**
 * Log levels for parser operations
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  category?: string;
  parser?: string;
  version?: string;
  operation?: string;
  duration?: number;
  memoryUsage?: number;
  metadata?: Record<string, any>;
  error?: EnhancedXLIFFError;
  correlationId?: string;
}

/**
 * Log formatter interface
 */
export interface LogFormatter {
  format(entry: LogEntry): string;
}

/**
 * Log destination interface
 */
export interface LogDestination {
  write(formattedLog: string): void;
  flush?(): void;
}

/**
 * Console formatter with colors and emojis
 */
export class ConsoleFormatter implements LogFormatter {
  private readonly levelEmojis: Record<LogLevel, string> = {
    [LogLevel.TRACE]: '🔍',
    [LogLevel.DEBUG]: '🐛',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.FATAL]: '💀'
  };

  private readonly levelColors: Record<LogLevel, string> = {
    [LogLevel.TRACE]: '\x1b[90m',   // Gray
    [LogLevel.DEBUG]: '\x1b[36m',   // Cyan
    [LogLevel.INFO]: '\x1b[32m',    // Green
    [LogLevel.WARN]: '\x1b[33m',    // Yellow
    [LogLevel.ERROR]: '\x1b[31m',   // Red
    [LogLevel.FATAL]: '\x1b[35m'    // Magenta
  };

  private readonly reset = '\x1b[0m';

  format(entry: LogEntry): string {
    const emoji = this.levelEmojis[entry.level];
    const color = this.levelColors[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];

    let formatted = `${color}${emoji} [${timestamp}] ${levelName}${this.reset}`;

    if (entry.parser) {
      formatted += ` [${entry.parser}${entry.version ? `@${entry.version}` : ''}]`;
    }

    if (entry.category) {
      formatted += ` [${entry.category}]`;
    }

    formatted += `: ${entry.message}`;

    if (entry.operation && entry.duration !== undefined) {
      formatted += ` (${entry.operation}: ${entry.duration}ms)`;
    }

    if (entry.memoryUsage) {
      formatted += ` [Memory: ${(entry.memoryUsage / 1024 / 1024).toFixed(2)}MB]`;
    }

    if (entry.correlationId) {
      formatted += ` [ID: ${entry.correlationId.substring(0, 8)}]`;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += `\n  📋 Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      formatted += `\n  🔍 Error Details:`;
      formatted += `\n    Code: ${entry.error.errorCode}`;
      formatted += `\n    Category: ${entry.error.category}`;
      formatted += `\n    Phase: ${entry.error.phase}`;
      formatted += `\n    Recoverable: ${entry.error.recoverable}`;
      
      if (entry.error.location.line) {
        formatted += `\n    Location: Line ${entry.error.location.line}${entry.error.location.column ? `, Column ${entry.error.location.column}` : ''}`;
      }
      
      if (entry.error.location.xpath) {
        formatted += `\n    XPath: ${entry.error.location.xpath}`;
      }
    }

    return formatted;
  }
}

/**
 * JSON formatter for structured logging
 */
export class JSONFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: new Date(entry.timestamp).toISOString(),
      level: LogLevel[entry.level],
      levelCode: entry.level,
      message: entry.message,
      parser: entry.parser,
      version: entry.version,
      category: entry.category,
      operation: entry.operation,
      duration: entry.duration,
      memoryUsage: entry.memoryUsage,
      correlationId: entry.correlationId,
      metadata: entry.metadata,
      error: entry.error ? {
        type: entry.error.type,
        errorCode: entry.error.errorCode,
        category: entry.error.category,
        severity: entry.error.severity,
        phase: entry.error.phase,
        recoverable: entry.error.recoverable,
        location: entry.error.location,
        context: entry.error.context
      } : undefined
    });
  }
}

/**
 * Console destination
 */
export class ConsoleDestination implements LogDestination {
  write(formattedLog: string): void {
    console.log(formattedLog);
  }
}

/**
 * Buffer destination for testing and debugging
 */
export class BufferDestination implements LogDestination {
  private buffer: string[] = [];

  write(formattedLog: string): void {
    this.buffer.push(formattedLog);
  }

  getBuffer(): string[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  flush(): void {
    this.buffer = [];
  }
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  formatter: LogFormatter;
  destinations: LogDestination[];
  enablePerformanceTracking: boolean;
  enableErrorAggregation: boolean;
  maxErrorHistory: number;
}

/**
 * Main XLIFF Logger class
 */
export class XLIFFLogger {
  private static instance: XLIFFLogger;
  private config: LoggerConfig;
  private errorHistory: EnhancedXLIFFError[] = [];

  private constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      formatter: new ConsoleFormatter(),
      destinations: [new ConsoleDestination()],
      enablePerformanceTracking: true,
      enableErrorAggregation: true,
      maxErrorHistory: 1000,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): XLIFFLogger {
    if (!XLIFFLogger.instance) {
      XLIFFLogger.instance = new XLIFFLogger(config);
    }
    return XLIFFLogger.instance;
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log a message at the specified level
   */
  log(level: LogLevel, message: string, metadata?: Partial<LogEntry>): void {
    if (level < this.config.level) {
      return; // Skip if below minimum level
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      memoryUsage: this.config.enablePerformanceTracking ? this.getMemoryUsage() : undefined,
      ...metadata
    };

    // Aggregate errors if enabled
    if (this.config.enableErrorAggregation && entry.error) {
      this.addToErrorHistory(entry.error);
    }

    const formatted = this.config.formatter.format(entry);
    this.config.destinations.forEach(dest => dest.write(formatted));
  }

  /**
   * Convenience methods for different log levels
   */
  trace(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  debug(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  fatal(message: string, metadata?: Partial<LogEntry>): void {
    this.log(LogLevel.FATAL, message, metadata);
  }

  /**
   * Log an enhanced XLIFF error
   */
  logError(error: EnhancedXLIFFError, correlationId?: string): void {
    const level = this.mapSeverityToLogLevel(error.severity);
    this.log(level, error.message, {
      error,
      correlationId,
      parser: error.context.parser,
      version: error.context.version,
      category: error.category,
      operation: error.context.processingStep
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.info(`Performance: ${operation} completed`, {
      operation,
      duration,
      category: 'performance',
      metadata
    });
  }

  /**
   * Log parser lifecycle events
   */
  logParserEvent(parser: string, version: string, event: string, metadata?: Record<string, any>): void {
    this.info(`Parser ${event}`, {
      parser,
      version,
      category: 'lifecycle',
      operation: event,
      metadata
    });
  }

  /**
   * Get aggregated error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: EnhancedXLIFFError[];
  } {
    const stats = {
      total: this.errorHistory.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recent: this.errorHistory.slice(-10)
    };

    this.errorHistory.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Flush all destinations
   */
  flush(): void {
    this.config.destinations.forEach(dest => {
      if (dest.flush) {
        dest.flush();
      }
    });
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    // Browser environment fallback
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    
    return 0;
  }

  private mapSeverityToLogLevel(severity: string): LogLevel {
    switch (severity.toLowerCase()) {
      case 'critical': return LogLevel.FATAL;
      case 'major': return LogLevel.ERROR;
      case 'minor': return LogLevel.WARN;
      case 'warning': return LogLevel.WARN;
      default: return LogLevel.INFO;
    }
  }

  private addToErrorHistory(error: EnhancedXLIFFError): void {
    this.errorHistory.push(error);
    
    // Trim history if it exceeds max size
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
    }
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private startMemory: number;
  private operation: string;
  private logger: XLIFFLogger;

  constructor(operation: string, logger?: XLIFFLogger) {
    this.operation = operation;
    this.logger = logger || XLIFFLogger.getInstance();
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsage();
  }

  /**
   * End timing and log results
   */
  end(metadata?: Record<string, any>): number {
    const duration = performance.now() - this.startTime;
    const endMemory = this.getMemoryUsage();
    const memoryDelta = endMemory - this.startMemory;

    this.logger.logPerformance(this.operation, duration, {
      memoryStart: this.startMemory,
      memoryEnd: endMemory,
      memoryDelta,
      ...metadata
    });

    return duration;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    // Browser environment fallback
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    
    return 0;
  }
}

// Export singleton instance for convenience
export const xliffLogger = XLIFFLogger.getInstance(); 