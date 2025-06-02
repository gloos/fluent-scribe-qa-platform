/**
 * Excel Export Service
 * 
 * Provides comprehensive Excel export functionality with data transformation,
 * formatting, styling, and multi-sheet support.
 */

import * as XLSX from 'xlsx';

export interface ExcelWorkbookOptions {
  filename: string;
  creator?: string;
  title?: string;
  subject?: string;
  description?: string;
  keywords?: string[];
  category?: string;
  company?: string;
}

export interface ExcelSheetData {
  name: string;
  data: any[][];
  headers?: string[];
  metadata?: Record<string, any>;
  formatting?: ExcelSheetFormatting;
  charts?: ExcelChartConfig[];
}

export interface ExcelSheetFormatting {
  headerStyle?: ExcelCellStyle;
  dataStyle?: ExcelCellStyle;
  alternateRowStyle?: ExcelCellStyle;
  columnWidths?: number[];
  freezePanes?: { row: number; col: number };
  autoFilter?: boolean;
  title?: {
    text: string;
    style?: ExcelCellStyle;
    merge?: { startCol: number; endCol: number };
  };
}

export interface ExcelCellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    color?: string;
    name?: string;
  };
  fill?: {
    type?: 'solid' | 'gradient';
    color?: string;
    backgroundColor?: string;
  };
  border?: {
    top?: ExcelBorderStyle;
    bottom?: ExcelBorderStyle;
    left?: ExcelBorderStyle;
    right?: ExcelBorderStyle;
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle' | 'bottom';
    wrapText?: boolean;
  };
  numberFormat?: string;
}

export interface ExcelBorderStyle {
  style: 'thin' | 'medium' | 'thick' | 'dotted' | 'dashed';
  color: string;
}

export interface ExcelChartConfig {
  type: 'column' | 'line' | 'pie' | 'bar' | 'scatter';
  title: string;
  dataRange: string;
  position: { x: number; y: number; width: number; height: number };
}

export interface ExcelDataTransformation {
  columnMappings?: Record<string, string>;
  dataFormatters?: Record<string, (value: any) => any>;
  validators?: Record<string, (value: any) => boolean>;
  aggregations?: Record<string, 'sum' | 'average' | 'count' | 'min' | 'max'>;
  sortBy?: { column: string; order: 'asc' | 'desc' }[];
  filters?: Record<string, any>;
}

export class ExcelExportService {
  private static instance: ExcelExportService;
  private workbook: XLSX.WorkBook;

  private constructor() {
    this.workbook = XLSX.utils.book_new();
  }

  public static getInstance(): ExcelExportService {
    if (!ExcelExportService.instance) {
      ExcelExportService.instance = new ExcelExportService();
    }
    return ExcelExportService.instance;
  }

  /**
   * Initialize a new workbook with options
   */
  public initializeWorkbook(options: ExcelWorkbookOptions): void {
    this.workbook = XLSX.utils.book_new();
    
    // Set workbook properties
    this.workbook.Props = {
      Title: options.title || options.filename,
      Subject: options.subject || 'Export from QA Platform',
      Author: options.creator || 'QA Platform',
      Manager: '',
      Company: options.company || 'QA Platform',
      Category: options.category || 'Report',
      Keywords: options.keywords?.join(', ') || '',
      Comments: options.description || '',
      LastAuthor: options.creator || 'QA Platform',
      CreatedDate: new Date(),
      ModifiedDate: new Date()
    };
  }

  /**
   * Transform raw data according to transformation rules
   */
  public transformData(
    data: any[],
    transformation: ExcelDataTransformation = {}
  ): any[][] {
    let transformedData = [...data];

    // Apply filters
    if (transformation.filters) {
      transformedData = transformedData.filter(row => {
        return Object.entries(transformation.filters!).every(([key, value]) => {
          if (typeof row === 'object' && row !== null) {
            return row[key] === value;
          }
          return true;
        });
      });
    }

    // Apply sorting
    if (transformation.sortBy && transformation.sortBy.length > 0) {
      transformedData.sort((a, b) => {
        for (const sort of transformation.sortBy!) {
          const aVal = typeof a === 'object' ? a[sort.column] : a;
          const bVal = typeof b === 'object' ? b[sort.column] : b;
          
          if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
          if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Convert to 2D array format
    const result: any[][] = [];
    
    if (transformedData.length > 0) {
      // Determine if data is objects or arrays
      const firstRow = transformedData[0];
      if (typeof firstRow === 'object' && !Array.isArray(firstRow)) {
        // Object format - extract values
        transformedData.forEach(row => {
          const rowValues: any[] = [];
          Object.entries(row).forEach(([key, value]) => {
            // Apply column mapping if provided
            const mappedKey = transformation.columnMappings?.[key] || key;
            
            // Apply data formatter if provided
            const formatter = transformation.dataFormatters?.[key];
            const formattedValue = formatter ? formatter(value) : value;
            
            rowValues.push(formattedValue);
          });
          result.push(rowValues);
        });
      } else {
        // Already array format
        result.push(...transformedData);
      }
    }

    return result;
  }

  /**
   * Validate data integrity
   */
  public validateData(
    data: any[][],
    transformation: ExcelDataTransformation = {}
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Data must be an array');
      return { isValid: false, errors };
    }

    // Check for empty data
    if (data.length === 0) {
      errors.push('Data array is empty');
      return { isValid: false, errors };
    }

    // Validate each row
    data.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) {
        errors.push(`Row ${rowIndex + 1} is not an array`);
        return;
      }

      // Apply validators if provided
      if (transformation.validators) {
        row.forEach((cell, cellIndex) => {
          const columnKey = `col_${cellIndex}`;
          const validator = transformation.validators![columnKey];
          if (validator && !validator(cell)) {
            errors.push(`Invalid value in row ${rowIndex + 1}, column ${cellIndex + 1}: ${cell}`);
          }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create formatted column headers
   */
  private createFormattedHeaders(headers: string[]): string[] {
    return headers.map(header => {
      // Convert camelCase to Title Case
      return header
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    });
  }

  /**
   * Apply cell formatting to worksheet
   */
  private applyFormatting(
    worksheet: XLSX.WorkSheet,
    data: any[][],
    formatting: ExcelSheetFormatting
  ): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Set column widths
    if (formatting.columnWidths) {
      worksheet['!cols'] = formatting.columnWidths.map(width => ({ width }));
    } else {
      // Auto-size columns based on content
      const maxWidths: number[] = [];
      for (let col = 0; col <= range.e.c; col++) {
        let maxWidth = 10; // minimum width
        for (let row = 0; row <= range.e.r; row++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellRef];
          if (cell && cell.v) {
            const cellLength = cell.v.toString().length;
            maxWidth = Math.max(maxWidth, Math.min(cellLength, 50)); // max width 50
          }
        }
        maxWidths.push(maxWidth);
      }
      worksheet['!cols'] = maxWidths.map(width => ({ width }));
    }

    // Set freeze panes
    if (formatting.freezePanes) {
      worksheet['!freeze'] = {
        xSplit: formatting.freezePanes.col,
        ySplit: formatting.freezePanes.row
      };
    }

    // Set auto filter
    if (formatting.autoFilter) {
      worksheet['!autofilter'] = { ref: worksheet['!ref'] };
    }
  }

  /**
   * Add a sheet to the workbook
   */
  public addSheet(sheetData: ExcelSheetData): void {
    const { name, data, headers, formatting, metadata } = sheetData;

    // Validate data
    const validation = this.validateData(data);
    if (!validation.isValid) {
      console.warn('Data validation failed:', validation.errors);
    }

    // Prepare the sheet data
    let sheetRows: any[][] = [];

    // Add title if specified
    if (formatting?.title) {
      sheetRows.push([formatting.title.text]);
      sheetRows.push([]); // Empty row
    }

    // Add headers
    if (headers && headers.length > 0) {
      const formattedHeaders = this.createFormattedHeaders(headers);
      sheetRows.push(formattedHeaders);
    }

    // Add data rows
    sheetRows.push(...data);

    // Add metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      sheetRows.push([]); // Empty row
      sheetRows.push(['Metadata']);
      Object.entries(metadata).forEach(([key, value]) => {
        sheetRows.push([key, value]);
      });
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

    // Apply formatting
    if (formatting) {
      this.applyFormatting(worksheet, sheetRows, formatting);
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(this.workbook, worksheet, name);
  }

  /**
   * Add a summary sheet with aggregated data
   */
  public addSummarySheet(
    summaryData: { title: string; value: any; description?: string }[],
    sheetName = 'Summary'
  ): void {
    const summaryRows: any[][] = [
      ['Report Summary'],
      [],
      ['Metric', 'Value', 'Description']
    ];

    summaryData.forEach(item => {
      summaryRows.push([
        item.title,
        item.value,
        item.description || ''
      ]);
    });

    // Add generation info
    summaryRows.push([]);
    summaryRows.push(['Generated At', new Date().toISOString()]);
    summaryRows.push(['Generated By', 'QA Platform Export Service']);

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);

    // Apply summary formatting
    const formatting: ExcelSheetFormatting = {
      columnWidths: [30, 20, 50],
      autoFilter: false,
      freezePanes: { row: 3, col: 0 }
    };

    this.applyFormatting(worksheet, summaryRows, formatting);
    XLSX.utils.book_append_sheet(this.workbook, worksheet, sheetName);
  }

  /**
   * Generate aggregated statistics for numerical data
   */
  public generateStatistics(
    data: any[][],
    numericColumns: number[]
  ): { column: number; stats: { sum: number; avg: number; min: number; max: number; count: number } }[] {
    return numericColumns.map(colIndex => {
      const values = data
        .map(row => row[colIndex])
        .filter(val => val !== null && val !== undefined && !isNaN(Number(val)))
        .map(val => Number(val));

      if (values.length === 0) {
        return {
          column: colIndex,
          stats: { sum: 0, avg: 0, min: 0, max: 0, count: 0 }
        };
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      return {
        column: colIndex,
        stats: { sum, avg, min, max, count: values.length }
      };
    });
  }

  /**
   * Export workbook as Excel file
   */
  public download(filename: string): void {
    const sanitizedFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(this.workbook, `${sanitizedFilename}.xlsx`);
  }

  /**
   * Get workbook as ArrayBuffer
   */
  public getArrayBuffer(): ArrayBuffer {
    return XLSX.write(this.workbook, { bookType: 'xlsx', type: 'array' });
  }

  /**
   * Get workbook as Blob
   */
  public getBlob(): Blob {
    const arrayBuffer = this.getArrayBuffer();
    return new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Reset the service for a new workbook
   */
  public reset(): void {
    this.workbook = XLSX.utils.book_new();
  }

  /**
   * Get sheet names
   */
  public getSheetNames(): string[] {
    return this.workbook.SheetNames;
  }

  /**
   * Remove a sheet
   */
  public removeSheet(sheetName: string): boolean {
    const index = this.workbook.SheetNames.indexOf(sheetName);
    if (index !== -1) {
      this.workbook.SheetNames.splice(index, 1);
      delete this.workbook.Sheets[sheetName];
      return true;
    }
    return false;
  }

  /**
   * Create a formatted financial report sheet
   */
  public addFinancialReportSheet(
    data: {
      revenue: any[];
      subscriptions: any[];
      payments: any[];
      usage: any[];
    },
    dateRange: { from: string; to: string }
  ): void {
    // Revenue sheet
    if (data.revenue.length > 0) {
      this.addSheet({
        name: 'Revenue',
        data: data.revenue,
        headers: ['Date', 'Amount', 'Currency', 'Plan', 'Customer'],
        formatting: {
          headerStyle: {
            font: { bold: true, color: '#FFFFFF' },
            fill: { type: 'solid', color: '#3B82F6' }
          },
          columnWidths: [15, 12, 10, 15, 25],
          autoFilter: true,
          freezePanes: { row: 1, col: 0 }
        },
        metadata: {
          'Date Range': `${dateRange.from} to ${dateRange.to}`,
          'Total Records': data.revenue.length.toString(),
          'Export Date': new Date().toISOString()
        }
      });
    }

    // Subscriptions sheet
    if (data.subscriptions.length > 0) {
      this.addSheet({
        name: 'Subscriptions',
        data: data.subscriptions,
        headers: ['Customer', 'Plan', 'Status', 'Start Date', 'Amount', 'Currency'],
        formatting: {
          headerStyle: {
            font: { bold: true, color: '#FFFFFF' },
            fill: { type: 'solid', color: '#10B981' }
          },
          columnWidths: [25, 15, 12, 15, 12, 10],
          autoFilter: true,
          freezePanes: { row: 1, col: 0 }
        }
      });
    }

    // Payments sheet
    if (data.payments.length > 0) {
      this.addSheet({
        name: 'Payments',
        data: data.payments,
        headers: ['Date', 'Customer', 'Amount', 'Status', 'Method', 'Invoice'],
        formatting: {
          headerStyle: {
            font: { bold: true, color: '#FFFFFF' },
            fill: { type: 'solid', color: '#8B5CF6' }
          },
          columnWidths: [15, 25, 12, 12, 15, 20],
          autoFilter: true,
          freezePanes: { row: 1, col: 0 }
        }
      });
    }

    // Usage sheet
    if (data.usage.length > 0) {
      this.addSheet({
        name: 'Usage',
        data: data.usage,
        headers: ['Date', 'Customer', 'Words Processed', 'Cost', 'Processing Type'],
        formatting: {
          headerStyle: {
            font: { bold: true, color: '#FFFFFF' },
            fill: { type: 'solid', color: '#F59E0B' }
          },
          columnWidths: [15, 25, 18, 12, 20],
          autoFilter: true,
          freezePanes: { row: 1, col: 0 }
        }
      });
    }
  }
}

export default ExcelExportService; 