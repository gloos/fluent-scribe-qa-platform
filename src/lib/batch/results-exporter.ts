import {
  AggregatedResult,
  ExportFormat,
  ResultsReport,
  ExportConfig,
  ProcessingResult,
  BatchJob,
  BatchProcessingStatus
} from './types';

// Export utilities and formatting
export interface ExportContext {
  timestamp: Date;
  exportedBy?: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  data?: Blob | string | ArrayBuffer;
  filename: string;
  size: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Template engine for customizable export formats
 */
export class ExportTemplate {
  constructor(
    public format: ExportFormat,
    public template: string,
    public variables: Record<string, any> = {}
  ) {}

  render(data: any, context: ExportContext): string {
    let rendered = this.template;
    
    // Replace template variables
    Object.entries(this.variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    });

    // Replace data placeholders
    if (data) {
      rendered = this.renderDataPlaceholders(rendered, data, context);
    }

    return rendered;
  }

  private renderDataPlaceholders(template: string, data: any, context: ExportContext): string {
    // Replace {{data.path}} placeholders
    return template.replace(/\{\{data\.([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

/**
 * JSON exporter with flexible formatting options
 */
export class JSONExporter {
  static export(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext
  ): ExportResult {
    try {
      const exportData = {
        metadata: {
          exportedAt: context.timestamp.toISOString(),
          exportedBy: context.exportedBy || 'system',
          format: 'JSON',
          version: '1.0',
          filters: context.filters || {},
          ...context.metadata
        },
        data
      };

      const jsonString = JSON.stringify(
        exportData,
        null,
        config.jsonOptions?.indent || 2
      );

      const blob = new Blob([jsonString], { type: 'application/json' });
      
      return {
        success: true,
        format: ExportFormat.JSON,
        data: blob,
        filename: config.filename || `results-${Date.now()}.json`,
        size: blob.size,
        metadata: {
          recordCount: Array.isArray(data) ? data.length : 1,
          compressed: false
        }
      };
    } catch (error) {
      return {
        success: false,
        format: ExportFormat.JSON,
        filename: '',
        size: 0,
        error: `JSON export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * CSV exporter with customizable formatting
 */
export class CSVExporter {
  static export(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext
  ): ExportResult {
    try {
      const csvData = this.convertToCSV(data, config);
      const blob = new Blob([csvData], { type: 'text/csv' });

      return {
        success: true,
        format: ExportFormat.CSV,
        data: blob,
        filename: config.filename || `results-${Date.now()}.csv`,
        size: blob.size,
        metadata: {
          rowCount: csvData.split('\n').length - 1,
          columns: config.csvOptions?.columns?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        format: ExportFormat.CSV,
        filename: '',
        size: 0,
        error: `CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static convertToCSV(data: any, config: ExportConfig): string {
    const options = config.csvOptions || {};
    const delimiter = options.delimiter || ',';
    const quote = options.quote || '"';
    const escape = options.escape || '\\';
    const newline = options.newline || '\n';

    if (this.isAggregatedResult(data)) {
      return this.aggregatedResultToCSV(data, delimiter, quote, escape, newline);
    } else if (this.isResultsReport(data)) {
      return this.resultsReportToCSV(data, delimiter, quote, escape, newline);
    } else {
      // Generic object array handling
      return this.genericToCSV(data, delimiter, quote, escape, newline, options.columns);
    }
  }

  private static aggregatedResultToCSV(
    result: AggregatedResult,
    delimiter: string,
    quote: string,
    escape: string,
    newline: string
  ): string {
    const rows: string[] = [];
    
    // Header
    rows.push([
      'BatchId', 'TotalJobs', 'CompletedJobs', 'FailedJobs', 'TotalFiles',
      'TotalSegments', 'TotalWords', 'OverallQualityScore', 'AvgProcessingTime',
      'Throughput', 'ErrorRate', 'CompletionTime'
    ].map(h => this.csvEscape(h, quote, escape)).join(delimiter));

    // Data row
    const row = [
      result.batchId || '',
      result.summary.totalJobs,
      result.summary.completedJobs,
      result.summary.failedJobs,
      result.summary.totalFiles,
      result.summary.totalSegments,
      result.summary.totalWords,
      result.qualityMetrics.overallScore.toFixed(2),
      result.performanceMetrics.averageProcessingTime.toFixed(2),
      result.performanceMetrics.throughputPerHour.toFixed(2),
      (result.summary.failedJobs / result.summary.totalJobs * 100).toFixed(2),
      result.completionTime?.toISOString() || ''
    ].map(v => this.csvEscape(String(v), quote, escape));

    rows.push(row.join(delimiter));
    return rows.join(newline);
  }

  private static resultsReportToCSV(
    report: ResultsReport,
    delimiter: string,
    quote: string,
    escape: string,
    newline: string
  ): string {
    const rows: string[] = [];
    
    // Header
    rows.push(['Section', 'Title', 'Content', 'GeneratedAt'].map(h => 
      this.csvEscape(h, quote, escape)
    ).join(delimiter));

    // Data rows
    report.sections.forEach(section => {
      const row = [
        section.type,
        section.title,
        section.content.replace(/\n/g, ' ').slice(0, 500), // Truncate long content
        report.generatedAt.toISOString()
      ].map(v => this.csvEscape(String(v), quote, escape));
      
      rows.push(row.join(delimiter));
    });

    return rows.join(newline);
  }

  private static genericToCSV(
    data: any,
    delimiter: string,
    quote: string,
    escape: string,
    newline: string,
    columns?: string[]
  ): string {
    if (!Array.isArray(data)) {
      data = [data];
    }

    if (data.length === 0) {
      return '';
    }

    const headers = columns || Object.keys(data[0]);
    const rows: string[] = [];

    // Header row
    rows.push(headers.map(h => this.csvEscape(h, quote, escape)).join(delimiter));

    // Data rows
    data.forEach((item: any) => {
      const row = headers.map(header => {
        const value = item[header];
        return this.csvEscape(String(value || ''), quote, escape);
      });
      rows.push(row.join(delimiter));
    });

    return rows.join(newline);
  }

  private static csvEscape(value: string, quote: string, escape: string): string {
    if (value.includes(quote) || value.includes(',') || value.includes('\n')) {
      return quote + value.replace(new RegExp(quote, 'g'), escape + quote) + quote;
    }
    return value;
  }

  private static isAggregatedResult(data: any): data is AggregatedResult {
    return data && typeof data === 'object' && 'summary' in data && 'qualityMetrics' in data;
  }

  private static isResultsReport(data: any): data is ResultsReport {
    return data && typeof data === 'object' && 'sections' in data && 'generatedAt' in data;
  }
}

/**
 * Excel exporter with worksheet support
 */
export class ExcelExporter {
  static export(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext
  ): ExportResult {
    try {
      // Note: In a real implementation, you would use a library like xlsx or exceljs
      // For now, we'll create a basic CSV-like structure and indicate it needs Excel library
      
      const excelData = this.convertToExcelFormat(data, config);
      const blob = new Blob([excelData], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      return {
        success: true,
        format: ExportFormat.EXCEL,
        data: blob,
        filename: config.filename || `results-${Date.now()}.xlsx`,
        size: blob.size,
        metadata: {
          worksheets: 1,
          note: 'Excel export requires xlsx library integration'
        }
      };
    } catch (error) {
      return {
        success: false,
        format: ExportFormat.EXCEL,
        filename: '',
        size: 0,
        error: `Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static convertToExcelFormat(data: any, config: ExportConfig): string {
    // Placeholder implementation - would use actual Excel library in production
    const csvData = CSVExporter.export(data, config, {
      timestamp: new Date(),
      metadata: { format: 'excel-csv' }
    });
    
    if (csvData.success && csvData.data instanceof Blob) {
      return csvData.data.text().toString();
    }
    
    return 'Excel export placeholder - requires xlsx library integration';
  }
}

/**
 * PDF exporter with customizable templates
 */
export class PDFExporter {
  static export(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext
  ): ExportResult {
    try {
      const htmlContent = this.generateHTML(data, config, context);
      
      // Note: In a real implementation, you would use a library like jsPDF or puppeteer
      // For now, we'll create an HTML representation
      const blob = new Blob([htmlContent], { type: 'text/html' });

      return {
        success: true,
        format: ExportFormat.PDF,
        data: blob,
        filename: config.filename || `results-${Date.now()}.html`, // Would be .pdf with real implementation
        size: blob.size,
        metadata: {
          pages: 1,
          note: 'PDF export requires jsPDF or puppeteer library integration'
        }
      };
    } catch (error) {
      return {
        success: false,
        format: ExportFormat.PDF,
        filename: '',
        size: 0,
        error: `PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static generateHTML(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext
  ): string {
    const template = config.pdfOptions?.template || this.getDefaultTemplate();
    
    if (this.isAggregatedResult(data)) {
      return this.renderAggregatedResultHTML(data, template, context);
    } else if (this.isResultsReport(data)) {
      return this.renderResultsReportHTML(data, template, context);
    }
    
    return this.renderGenericHTML(data, template, context);
  }

  private static getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Batch Processing Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
        .metric h3 { margin: 0 0 5px 0; color: #333; }
        .metric .value { font-size: 1.5em; font-weight: bold; color: #0066cc; }
        .footer { border-top: 1px solid #ddd; padding-top: 10px; margin-top: 30px; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    {{content}}
    <div class="footer">
        Generated on {{timestamp}} by {{exportedBy}}
    </div>
</body>
</html>`;
  }

  private static renderAggregatedResultHTML(
    result: AggregatedResult,
    template: string,
    context: ExportContext
  ): string {
    const content = `
    <div class="header">
        <h1>Batch Processing Results</h1>
        <p>Batch ID: ${result.batchId || 'N/A'}</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="metrics">
            <div class="metric">
                <h3>Total Jobs</h3>
                <div class="value">${result.summary.totalJobs}</div>
            </div>
            <div class="metric">
                <h3>Completed Jobs</h3>
                <div class="value">${result.summary.completedJobs}</div>
            </div>
            <div class="metric">
                <h3>Failed Jobs</h3>
                <div class="value">${result.summary.failedJobs}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${((result.summary.completedJobs / result.summary.totalJobs) * 100).toFixed(1)}%</div>
            </div>
        </div>
    </div>

    <div class="summary">
        <h2>Quality Metrics</h2>
        <div class="metrics">
            <div class="metric">
                <h3>Overall Score</h3>
                <div class="value">${result.qualityMetrics.overallScore.toFixed(1)}</div>
            </div>
            <div class="metric">
                <h3>Error Rate</h3>
                <div class="value">${result.qualityMetrics.errorRate.toFixed(2)}%</div>
            </div>
            <div class="metric">
                <h3>Warning Rate</h3>
                <div class="value">${result.qualityMetrics.warningRate.toFixed(2)}%</div>
            </div>
            <div class="metric">
                <h3>Completion Rate</h3>
                <div class="value">${result.qualityMetrics.completionRate.toFixed(1)}%</div>
            </div>
        </div>
    </div>

    <div class="summary">
        <h2>Performance Metrics</h2>
        <div class="metrics">
            <div class="metric">
                <h3>Avg Processing Time</h3>
                <div class="value">${result.performanceMetrics.averageProcessingTime.toFixed(1)}s</div>
            </div>
            <div class="metric">
                <h3>Throughput</h3>
                <div class="value">${result.performanceMetrics.throughputPerHour.toFixed(0)}/hr</div>
            </div>
            <div class="metric">
                <h3>Peak Memory</h3>
                <div class="value">${result.performanceMetrics.peakMemoryUsage.toFixed(1)}MB</div>
            </div>
        </div>
    </div>`;

    return template
      .replace('{{content}}', content)
      .replace('{{timestamp}}', context.timestamp.toISOString())
      .replace('{{exportedBy}}', context.exportedBy || 'system');
  }

  private static renderResultsReportHTML(
    report: ResultsReport,
    template: string,
    context: ExportContext
  ): string {
    const sectionsHTML = report.sections.map(section => `
      <div class="summary">
        <h2>${section.title}</h2>
        <div>${section.content.replace(/\n/g, '<br>')}</div>
      </div>
    `).join('');

    const content = `
    <div class="header">
        <h1>${report.title}</h1>
        <p>Report Type: ${report.type}</p>
    </div>
    ${sectionsHTML}`;

    return template
      .replace('{{content}}', content)
      .replace('{{timestamp}}', context.timestamp.toISOString())
      .replace('{{exportedBy}}', context.exportedBy || 'system');
  }

  private static renderGenericHTML(
    data: any,
    template: string,
    context: ExportContext
  ): string {
    const content = `
    <div class="header">
        <h1>Export Results</h1>
    </div>
    <div class="summary">
        <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>`;

    return template
      .replace('{{content}}', content)
      .replace('{{timestamp}}', context.timestamp.toISOString())
      .replace('{{exportedBy}}', context.exportedBy || 'system');
  }

  private static isAggregatedResult(data: any): data is AggregatedResult {
    return data && typeof data === 'object' && 'summary' in data && 'qualityMetrics' in data;
  }

  private static isResultsReport(data: any): data is ResultsReport {
    return data && typeof data === 'object' && 'sections' in data && 'generatedAt' in data;
  }
}

/**
 * Main results exporter class that coordinates different format exporters
 */
export class BatchResultsExporter {
  private templates: Map<ExportFormat, ExportTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Export data in the specified format
   */
  async export(
    data: AggregatedResult | ResultsReport,
    config: ExportConfig,
    context: ExportContext = { timestamp: new Date() }
  ): Promise<ExportResult> {
    try {
      switch (config.format) {
        case ExportFormat.JSON:
          return JSONExporter.export(data, config, context);
        
        case ExportFormat.CSV:
          return CSVExporter.export(data, config, context);
        
        case ExportFormat.EXCEL:
          return ExcelExporter.export(data, config, context);
        
        case ExportFormat.PDF:
          return PDFExporter.export(data, config, context);
        
        default:
          throw new Error(`Unsupported export format: ${config.format}`);
      }
    } catch (error) {
      return {
        success: false,
        format: config.format,
        filename: '',
        size: 0,
        error: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Export data in multiple formats
   */
  async exportMultiple(
    data: AggregatedResult | ResultsReport,
    configs: ExportConfig[],
    context: ExportContext = { timestamp: new Date() }
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    
    for (const config of configs) {
      const result = await this.export(data, config, context);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Register a custom template for a format
   */
  registerTemplate(format: ExportFormat, template: ExportTemplate): void {
    this.templates.set(format, template);
  }

  /**
   * Get available export formats
   */
  getAvailableFormats(): ExportFormat[] {
    return Object.values(ExportFormat);
  }

  /**
   * Validate export configuration
   */
  validateConfig(config: ExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.format) {
      errors.push('Export format is required');
    }

    if (!Object.values(ExportFormat).includes(config.format)) {
      errors.push(`Invalid export format: ${config.format}`);
    }

    if (config.filename && !/^[a-zA-Z0-9._-]+$/.test(config.filename)) {
      errors.push('Invalid filename format');
    }

    if (config.csvOptions?.columns && !Array.isArray(config.csvOptions.columns)) {
      errors.push('CSV columns must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private initializeDefaultTemplates(): void {
    // Initialize default templates for each format
    this.templates.set(ExportFormat.JSON, new ExportTemplate(
      ExportFormat.JSON,
      '{{data}}',
      { timestamp: '{{timestamp}}' }
    ));

    this.templates.set(ExportFormat.CSV, new ExportTemplate(
      ExportFormat.CSV,
      'CSV Export Template',
      { delimiter: ',' }
    ));

    this.templates.set(ExportFormat.PDF, new ExportTemplate(
      ExportFormat.PDF,
      PDFExporter['getDefaultTemplate'](),
      { style: 'default' }
    ));
  }
}

// Export default instance
export const resultsExporter = new BatchResultsExporter();

// Export utility functions
export const exportUtils = {
  /**
   * Generate filename with timestamp and format
   */
  generateFilename(prefix: string, format: ExportFormat, timestamp?: Date): string {
    const ts = timestamp || new Date();
    const dateStr = ts.toISOString().slice(0, 10);
    const timeStr = ts.toTimeString().slice(0, 8).replace(/:/g, '-');
    
    const extension = this.getFileExtension(format);
    return `${prefix}-${dateStr}-${timeStr}.${extension}`;
  },

  /**
   * Get file extension for format
   */
  getFileExtension(format: ExportFormat): string {
    const extensions = {
      [ExportFormat.JSON]: 'json',
      [ExportFormat.CSV]: 'csv',
      [ExportFormat.EXCEL]: 'xlsx',
      [ExportFormat.PDF]: 'pdf'
    };
    return extensions[format] || 'txt';
  },

  /**
   * Get MIME type for format
   */
  getMimeType(format: ExportFormat): string {
    const mimeTypes = {
      [ExportFormat.JSON]: 'application/json',
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.PDF]: 'application/pdf'
    };
    return mimeTypes[format] || 'text/plain';
  },

  /**
   * Convert blob to download URL
   */
  createDownloadUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  },

  /**
   * Cleanup download URL
   */
  revokeDownloadUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}; 