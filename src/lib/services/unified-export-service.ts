/**
 * Unified Export Service
 * 
 * Orchestrates export functionality across multiple formats (PDF, Excel, CSV, JSON)
 * with progress tracking, error handling, and recovery systems.
 */

import PDFExportService, { 
  PDFTemplateOptions, 
  PDFTableData, 
  PDFChartData, 
  PDFSummaryCard 
} from './pdf-export-service';
import ExcelExportService, { 
  ExcelWorkbookOptions, 
  ExcelSheetData,
  ExcelDataTransformation 
} from './excel-export-service';
import JSZip from 'jszip';

export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'zip';

export interface ExportRequest {
  format: ExportFormat;
  filename: string;
  data: ExportDataSource;
  options?: ExportOptions;
}

export interface ExportDataSource {
  type: 'reports' | 'financial' | 'analytics' | 'custom';
  rawData: any[];
  charts?: HTMLElement[];
  metadata?: Record<string, any>;
  aggregations?: Record<string, any>;
}

export interface ExportOptions {
  // Common options
  title?: string;
  subtitle?: string;
  includeCharts?: boolean;
  includeMetadata?: boolean;
  includeAggregations?: boolean;
  dateRange?: { from: string; to: string };
  
  // PDF specific
  pdfOptions?: Partial<PDFTemplateOptions>;
  orientation?: 'portrait' | 'landscape';
  
  // Excel specific
  excelOptions?: Partial<ExcelWorkbookOptions>;
  multiSheet?: boolean;
  
  // Data transformation
  dataTransformation?: ExcelDataTransformation;
  
  // Progress tracking
  onProgress?: (progress: ExportProgress) => void;
  
  // Compression (for zip)
  compression?: {
    level?: number;
    includeFormats?: ExportFormat[];
  };
}

export interface ExportProgress {
  stage: ExportStage;
  percentage: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentStepIndex?: number;
  estimatedTimeRemaining?: number;
  error?: ExportError;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  format: ExportFormat;
  blob?: Blob;
  url?: string;
  size?: number;
  duration?: number;
  error?: ExportError;
  metadata?: {
    recordCount: number;
    sheetCount?: number;
    pageCount?: number;
    chartCount?: number;
  };
}

export interface ExportError {
  code: string;
  message: string;
  details?: any;
  stage?: ExportStage;
  recoverable?: boolean;
  retryCount?: number;
}

export enum ExportStage {
  INITIALIZING = 'initializing',
  VALIDATING_DATA = 'validating_data',
  TRANSFORMING_DATA = 'transforming_data',
  GENERATING_CHARTS = 'generating_charts',
  CREATING_DOCUMENT = 'creating_document',
  APPLYING_FORMATTING = 'applying_formatting',
  FINALIZING = 'finalizing',
  COMPRESSING = 'compressing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export class UnifiedExportService {
  private static instance: UnifiedExportService;
  private pdfService: PDFExportService;
  private excelService: ExcelExportService;
  private currentExport: ExportRequest | null = null;
  private startTime: number = 0;

  private constructor() {
    this.pdfService = PDFExportService.getInstance();
    this.excelService = ExcelExportService.getInstance();
  }

  public static getInstance(): UnifiedExportService {
    if (!UnifiedExportService.instance) {
      UnifiedExportService.instance = new UnifiedExportService();
    }
    return UnifiedExportService.instance;
  }

  /**
   * Main export method that handles all formats
   */
  public async export(request: ExportRequest): Promise<ExportResult> {
    this.currentExport = request;
    this.startTime = Date.now();

    try {
      // Initialize
      this.updateProgress(ExportStage.INITIALIZING, 0, 'Starting export process...');

      // Validate request
      const validation = this.validateRequest(request);
      if (!validation.isValid) {
        throw new Error(`Invalid export request: ${validation.errors.join(', ')}`);
      }

      // Route to appropriate export handler
      let result: ExportResult;
      
      switch (request.format) {
        case 'pdf':
          result = await this.exportToPDF(request);
          break;
        case 'excel':
          result = await this.exportToExcel(request);
          break;
        case 'csv':
          result = await this.exportToCSV(request);
          break;
        case 'json':
          result = await this.exportToJSON(request);
          break;
        case 'zip':
          result = await this.exportToZip(request);
          break;
        default:
          throw new Error(`Unsupported export format: ${request.format}`);
      }

      // Calculate duration
      result.duration = Date.now() - this.startTime;
      
      // Final progress update
      this.updateProgress(ExportStage.COMPLETED, 100, 'Export completed successfully');
      
      return result;

    } catch (error) {
      const exportError: ExportError = {
        code: 'EXPORT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown export error',
        details: error,
        recoverable: this.isRecoverableError(error)
      };

      this.updateProgress(ExportStage.ERROR, 0, 'Export failed', undefined, undefined, undefined, exportError);

      return {
        success: false,
        filename: request.filename,
        format: request.format,
        duration: Date.now() - this.startTime,
        error: exportError
      };
    } finally {
      this.currentExport = null;
    }
  }

  /**
   * Export to PDF format
   */
  private async exportToPDF(request: ExportRequest): Promise<ExportResult> {
    this.updateProgress(ExportStage.VALIDATING_DATA, 10, 'Validating PDF export data...');
    
    const { data, options } = request;
    
    // Initialize PDF document
    const pdfOptions: PDFTemplateOptions = {
      title: options?.title || 'QA Platform Report',
      subtitle: options?.subtitle,
      orientation: options?.orientation || 'portrait',
      includeHeader: true,
      includeFooter: true,
      footerText: 'Generated by QA Platform',
      ...options?.pdfOptions
    };

    this.pdfService.reset();
    this.pdfService.initializeDocument(pdfOptions);

    this.updateProgress(ExportStage.TRANSFORMING_DATA, 25, 'Processing data for PDF...');

    // Add metadata if requested
    if (options?.includeMetadata && data.metadata) {
      this.pdfService.addMetadata(data.metadata);
    }

    // Add summary cards if we have aggregations
    if (options?.includeAggregations && data.aggregations) {
      const summaryCards: PDFSummaryCard[] = Object.entries(data.aggregations).map(([key, value]) => ({
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: typeof value === 'number' ? value.toLocaleString() : value,
        subtitle: this.getAggregationSubtitle(key, value)
      }));
      this.pdfService.addSummaryCards(summaryCards);
    }

    this.updateProgress(ExportStage.CREATING_DOCUMENT, 40, 'Creating PDF structure...');

    // Add main data table
    if (data.rawData && data.rawData.length > 0) {
      const tableData = this.convertToTableData(data.rawData, data.type);
      this.pdfService.addTable(tableData);
    }

    // Add charts if requested
    if (options?.includeCharts && data.charts && data.charts.length > 0) {
      this.updateProgress(ExportStage.GENERATING_CHARTS, 60, 'Capturing charts...');
      
      let chartIndex = 0;
      for (const chart of data.charts) {
        this.updateProgress(
          ExportStage.GENERATING_CHARTS, 
          60 + (chartIndex / data.charts.length) * 20, 
          `Capturing chart ${chartIndex + 1} of ${data.charts.length}...`
        );
        
        const chartData: PDFChartData = {
          element: chart,
          title: `Chart ${chartIndex + 1}`,
          width: 800,
          height: 400,
          scale: 2
        };
        
        await this.pdfService.addChart(chartData);
        chartIndex++;
      }
    }

    this.updateProgress(ExportStage.FINALIZING, 90, 'Finalizing PDF...');

    // Generate result
    const blob = this.pdfService.getBlob();
    
    return {
      success: true,
      filename: `${request.filename}.pdf`,
      format: 'pdf',
      blob,
      size: blob.size,
      metadata: {
        recordCount: data.rawData.length,
        chartCount: data.charts?.length || 0
      }
    };
  }

  /**
   * Export to Excel format
   */
  private async exportToExcel(request: ExportRequest): Promise<ExportResult> {
    this.updateProgress(ExportStage.VALIDATING_DATA, 10, 'Validating Excel export data...');
    
    const { data, options } = request;
    
    // Initialize Excel workbook
    const excelOptions: ExcelWorkbookOptions = {
      filename: request.filename,
      title: options?.title || 'QA Platform Report',
      creator: 'QA Platform',
      company: 'QA Platform',
      ...options?.excelOptions
    };

    this.excelService.reset();
    this.excelService.initializeWorkbook(excelOptions);

    this.updateProgress(ExportStage.TRANSFORMING_DATA, 25, 'Processing data for Excel...');

    // Transform data if needed
    let transformedData = data.rawData;
    if (options?.dataTransformation) {
      transformedData = this.excelService.transformData(data.rawData, options.dataTransformation);
    }

    this.updateProgress(ExportStage.CREATING_DOCUMENT, 40, 'Creating Excel sheets...');

    // Handle different data types
    if (data.type === 'financial') {
      this.addFinancialSheets(transformedData, options);
    } else if (options?.multiSheet) {
      this.addMultipleSheets(transformedData, data.type, options);
    } else {
      this.addSingleSheet(transformedData, data.type, options);
    }

    // Add summary sheet if aggregations exist
    if (options?.includeAggregations && data.aggregations) {
      this.updateProgress(ExportStage.APPLYING_FORMATTING, 70, 'Adding summary sheet...');
      
      const summaryData = Object.entries(data.aggregations).map(([key, value]) => ({
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value,
        description: this.getAggregationDescription(key, value)
      }));
      
      this.excelService.addSummarySheet(summaryData);
    }

    this.updateProgress(ExportStage.FINALIZING, 90, 'Finalizing Excel workbook...');

    // Generate result
    const blob = this.excelService.getBlob();
    
    return {
      success: true,
      filename: `${request.filename}.xlsx`,
      format: 'excel',
      blob,
      size: blob.size,
      metadata: {
        recordCount: data.rawData.length,
        sheetCount: this.excelService.getSheetNames().length
      }
    };
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(request: ExportRequest): Promise<ExportResult> {
    this.updateProgress(ExportStage.TRANSFORMING_DATA, 25, 'Converting data to CSV...');
    
    const { data } = request;
    
    // Convert data to CSV format
    let csvContent = '';
    
    if (data.rawData && data.rawData.length > 0) {
      // Determine headers
      const firstRow = data.rawData[0];
      let headers: string[] = [];
      
      if (typeof firstRow === 'object' && !Array.isArray(firstRow)) {
        headers = Object.keys(firstRow);
        csvContent += headers.join(',') + '\n';
        
        // Add data rows
        data.rawData.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            // Escape CSV values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          csvContent += values.join(',') + '\n';
        });
      } else {
        // Array format
        data.rawData.forEach(row => {
          if (Array.isArray(row)) {
            const values = row.map(value => {
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            });
            csvContent += values.join(',') + '\n';
          }
        });
      }
    }

    this.updateProgress(ExportStage.FINALIZING, 90, 'Creating CSV file...');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    return {
      success: true,
      filename: `${request.filename}.csv`,
      format: 'csv',
      blob,
      size: blob.size,
      metadata: {
        recordCount: data.rawData.length
      }
    };
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(request: ExportRequest): Promise<ExportResult> {
    this.updateProgress(ExportStage.TRANSFORMING_DATA, 25, 'Converting data to JSON...');
    
    const { data, options } = request;
    
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportType: data.type,
        title: options?.title || 'QA Platform Export',
        recordCount: data.rawData.length,
        ...(data.metadata || {})
      },
      data: data.rawData,
      ...(options?.includeAggregations && data.aggregations ? { aggregations: data.aggregations } : {}),
      ...(options?.dateRange ? { dateRange: options.dateRange } : {})
    };

    this.updateProgress(ExportStage.FINALIZING, 90, 'Creating JSON file...');

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    
    return {
      success: true,
      filename: `${request.filename}.json`,
      format: 'json',
      blob,
      size: blob.size,
      metadata: {
        recordCount: data.rawData.length
      }
    };
  }

  /**
   * Export to ZIP format with multiple formats
   */
  private async exportToZip(request: ExportRequest): Promise<ExportResult> {
    this.updateProgress(ExportStage.INITIALIZING, 5, 'Preparing multi-format export...');
    
    const zip = new JSZip();
    const { options } = request;
    const formats: ExportFormat[] = options?.compression?.includeFormats || ['pdf', 'excel', 'csv', 'json'];
    
    let completedFormats = 0;
    const totalFormats = formats.length;

    for (const format of formats) {
      this.updateProgress(
        ExportStage.CREATING_DOCUMENT, 
        10 + (completedFormats / totalFormats) * 70, 
        `Creating ${format.toUpperCase()} export...`
      );

      try {
        const formatRequest: ExportRequest = {
          ...request,
          format,
          filename: `${request.filename}_${format}`
        };

        const result = await this.export(formatRequest);
        
        if (result.success && result.blob) {
          zip.file(`${request.filename}.${format === 'excel' ? 'xlsx' : format}`, result.blob);
        }
      } catch (error) {
        console.warn(`Failed to create ${format} export:`, error);
      }

      completedFormats++;
    }

    this.updateProgress(ExportStage.COMPRESSING, 85, 'Compressing files...');

    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: options?.compression?.level || 6
      }
    });

    return {
      success: true,
      filename: `${request.filename}.zip`,
      format: 'zip',
      blob: zipBlob,
      size: zipBlob.size,
      metadata: {
        recordCount: request.data.rawData.length
      }
    };
  }

  /**
   * Helper methods
   */
  private validateRequest(request: ExportRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.filename) {
      errors.push('Filename is required');
    }

    if (!request.data || !request.data.rawData) {
      errors.push('Data is required');
    }

    if (!['pdf', 'excel', 'csv', 'json', 'zip'].includes(request.format)) {
      errors.push('Invalid export format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private updateProgress(
    stage: ExportStage,
    percentage: number,
    message: string,
    currentStep?: string,
    totalSteps?: number,
    currentStepIndex?: number,
    error?: ExportError
  ): void {
    if (this.currentExport?.options?.onProgress) {
      const progress: ExportProgress = {
        stage,
        percentage: Math.min(100, Math.max(0, percentage)),
        message,
        currentStep,
        totalSteps,
        currentStepIndex,
        error
      };

      // Estimate time remaining
      if (percentage > 0 && percentage < 100) {
        const elapsed = Date.now() - this.startTime;
        const estimatedTotal = (elapsed / percentage) * 100;
        progress.estimatedTimeRemaining = estimatedTotal - elapsed;
      }

      this.currentExport.options.onProgress(progress);
    }
  }

  private convertToTableData(data: any[], type: string): PDFTableData {
    if (data.length === 0) {
      return { headers: [], rows: [] };
    }

    const firstRow = data[0];
    
    if (typeof firstRow === 'object' && !Array.isArray(firstRow)) {
      const headers = Object.keys(firstRow);
      const rows = data.map(row => headers.map(header => row[header]));
      
      return {
        headers,
        rows,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Data`
      };
    }

    return {
      headers: [],
      rows: data,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Data`
    };
  }

  private addFinancialSheets(data: any[], options?: ExportOptions): void {
    // Implementation for financial-specific sheets
    this.excelService.addFinancialReportSheet(
      {
        revenue: data.filter(item => item.type === 'revenue'),
        subscriptions: data.filter(item => item.type === 'subscription'),
        payments: data.filter(item => item.type === 'payment'),
        usage: data.filter(item => item.type === 'usage')
      },
      options?.dateRange || { from: '', to: '' }
    );
  }

  private addMultipleSheets(data: any[], type: string, options?: ExportOptions): void {
    // Group data by some criteria and create multiple sheets
    const groupedData = this.groupDataForSheets(data, type);
    
    Object.entries(groupedData).forEach(([sheetName, sheetData]) => {
      const sheetConfig: ExcelSheetData = {
        name: sheetName,
        data: sheetData,
        headers: this.extractHeaders(sheetData),
        formatting: {
          autoFilter: true,
          freezePanes: { row: 1, col: 0 }
        }
      };
      
      this.excelService.addSheet(sheetConfig);
    });
  }

  private addSingleSheet(data: any[], type: string, options?: ExportOptions): void {
    const sheetConfig: ExcelSheetData = {
      name: type.charAt(0).toUpperCase() + type.slice(1),
      data: this.excelService.transformData(data, options?.dataTransformation),
      headers: this.extractHeaders(data),
      formatting: {
        autoFilter: true,
        freezePanes: { row: 1, col: 0 },
        columnWidths: this.calculateColumnWidths(data)
      }
    };
    
    this.excelService.addSheet(sheetConfig);
  }

  private groupDataForSheets(data: any[], type: string): Record<string, any[]> {
    // Default grouping logic - can be customized based on type
    return { [type]: data };
  }

  private extractHeaders(data: any[]): string[] {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    if (typeof firstRow === 'object' && !Array.isArray(firstRow)) {
      return Object.keys(firstRow);
    }
    
    return [];
  }

  private calculateColumnWidths(data: any[]): number[] {
    if (data.length === 0) return [];
    
    const headers = this.extractHeaders(data);
    return headers.map(() => 15); // Default width
  }

  private getAggregationSubtitle(key: string, value: any): string {
    if (typeof value === 'number') {
      return `${value >= 0 ? '+' : ''}${value}%`;
    }
    return '';
  }

  private getAggregationDescription(key: string, value: any): string {
    return `Aggregated value for ${key}`;
  }

  private isRecoverableError(error: any): boolean {
    // Determine if the error is recoverable
    if (error instanceof Error) {
      return !error.message.includes('Invalid') && !error.message.includes('missing');
    }
    return false;
  }

  /**
   * Download helper that automatically triggers file download
   */
  public async downloadFile(result: ExportResult): Promise<void> {
    if (!result.success || !result.blob) {
      throw new Error('Cannot download failed export result');
    }

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Retry export with exponential backoff
   */
  public async retryExport(
    request: ExportRequest, 
    maxRetries = 3, 
    baseDelay = 1000
  ): Promise<ExportResult> {
    let lastError: ExportError | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.export(request);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = {
          code: 'RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
          retryCount: attempt
        };
      }

      if (attempt < maxRetries && lastError?.recoverable !== false) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      filename: request.filename,
      format: request.format,
      error: lastError || {
        code: 'MAX_RETRIES_EXCEEDED',
        message: 'Maximum retry attempts exceeded'
      }
    };
  }
}

export default UnifiedExportService; 