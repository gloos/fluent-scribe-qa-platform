/**
 * PDF Export Service
 * 
 * Provides comprehensive PDF export functionality with standardized templates
 * for various types of reports and data exports.
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

export interface PDFTemplateOptions {
  title: string;
  subtitle?: string;
  metadata?: Record<string, string>;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  includeHeader?: boolean;
  includeFooter?: boolean;
  headerLogo?: string;
  footerText?: string;
  watermark?: string;
}

export interface PDFTableData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  styles?: {
    headerStyles?: Record<string, any>;
    bodyStyles?: Record<string, any>;
    columnStyles?: Record<number, any>;
    theme?: 'plain' | 'striped' | 'grid';
  };
}

export interface PDFChartData {
  element: HTMLElement;
  title?: string;
  width?: number;
  height?: number;
  scale?: number;
}

export interface PDFSummaryCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
}

export class PDFExportService {
  private static instance: PDFExportService;
  private doc: jsPDF;
  private pageHeight: number;
  private pageWidth: number;
  private currentY: number;
  private margin: number;
  private headerHeight: number;
  private footerHeight: number;

  private constructor() {
    this.doc = new jsPDF('portrait', 'mm', 'a4');
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.currentY = 20;
    this.margin = 20;
    this.headerHeight = 40;
    this.footerHeight = 20;
  }

  public static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  /**
   * Initialize a new PDF document with template options
   */
  public initializeDocument(options: PDFTemplateOptions): void {
    this.doc = new jsPDF(
      options.orientation || 'portrait',
      'mm',
      options.format || 'a4'
    );
    
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.currentY = this.margin;

    if (options.includeHeader !== false) {
      this.addHeader(options);
    }

    if (options.includeFooter !== false) {
      this.addFooter(options);
    }

    if (options.watermark) {
      this.addWatermark(options.watermark);
    }
  }

  /**
   * Add a standard header to the PDF
   */
  private addHeader(options: PDFTemplateOptions): void {
    const headerY = this.margin;
    
    // Header background
    this.doc.setFillColor(248, 250, 252); // slate-50
    this.doc.rect(0, 0, this.pageWidth, this.headerHeight, 'F');

    // Header border
    this.doc.setDrawColor(226, 232, 240); // slate-200
    this.doc.setLineWidth(0.5);
    this.doc.line(0, this.headerHeight, this.pageWidth, this.headerHeight);

    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42); // slate-900
    this.doc.text(options.title, this.margin, headerY + 20);

    // Subtitle
    if (options.subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(71, 85, 105); // slate-600
      this.doc.text(options.subtitle, this.margin, headerY + 30);
    }

    // Company logo placeholder (if headerLogo provided)
    if (options.headerLogo) {
      // TODO: Add logo implementation when needed
      this.doc.setFontSize(10);
      this.doc.setTextColor(100, 116, 139); // slate-500
      this.doc.text('Logo', this.pageWidth - this.margin - 20, headerY + 15);
    }

    this.currentY = this.headerHeight + 10;
  }

  /**
   * Add a standard footer to the PDF
   */
  private addFooter(options: PDFTemplateOptions): void {
    const footerY = this.pageHeight - this.footerHeight;
    
    // Footer border
    this.doc.setDrawColor(226, 232, 240); // slate-200
    this.doc.setLineWidth(0.5);
    this.doc.line(0, footerY, this.pageWidth, footerY);

    // Footer text
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 116, 139); // slate-500
    
    const footerText = options.footerText || 'Generated by QA Platform';
    this.doc.text(footerText, this.margin, footerY + 10);

    // Page number
    const pageNumber = `Page ${this.doc.getCurrentPageInfo().pageNumber}`;
    const pageNumberWidth = this.doc.getTextWidth(pageNumber);
    this.doc.text(pageNumber, this.pageWidth - this.margin - pageNumberWidth, footerY + 10);

    // Generation date
    const generatedDate = `Generated: ${new Date().toLocaleString()}`;
    const dateWidth = this.doc.getTextWidth(generatedDate);
    this.doc.text(generatedDate, (this.pageWidth - dateWidth) / 2, footerY + 10);
  }

  /**
   * Add a watermark to the PDF
   */
  private addWatermark(text: string): void {
    this.doc.setFontSize(80);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(240, 240, 240);
    
    // Rotate and center the watermark
    const centerX = this.pageWidth / 2;
    const centerY = this.pageHeight / 2;
    
    this.doc.saveGraphicsState();
    
    // Rotate 45 degrees
    this.doc.text(text, centerX, centerY, {
      angle: 45,
      align: 'center',
      baseline: 'middle'
    });
    
    this.doc.restoreGraphicsState();
  }

  /**
   * Add metadata section to the PDF
   */
  public addMetadata(metadata: Record<string, string>): void {
    if (Object.keys(metadata).length === 0) return;

    this.checkPageBreak(60);

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42); // slate-900
    this.doc.text('Report Details', this.margin, this.currentY);
    this.currentY += 15;

    const metadataRows = Object.entries(metadata).map(([key, value]) => [
      key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value
    ]);

    this.doc.autoTable({
      head: [['Property', 'Value']],
      body: metadataRows,
      startY: this.currentY,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: [15, 23, 42], // slate-900
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [71, 85, 105], // slate-600
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 100 }
      },
      margin: { left: this.margin, right: this.margin }
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  /**
   * Add summary cards section
   */
  public addSummaryCards(cards: PDFSummaryCard[]): void {
    if (cards.length === 0) return;

    this.checkPageBreak(100);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42); // slate-900
    this.doc.text('Key Metrics', this.margin, this.currentY);
    this.currentY += 15;

    const cardsPerRow = 2;
    const cardWidth = (this.pageWidth - this.margin * 2 - 10) / cardsPerRow;
    const cardHeight = 35;

    for (let i = 0; i < cards.length; i += cardsPerRow) {
      this.checkPageBreak(cardHeight + 10);

      for (let j = 0; j < cardsPerRow && i + j < cards.length; j++) {
        const card = cards[i + j];
        const x = this.margin + j * (cardWidth + 10);
        const y = this.currentY;

        // Card background
        this.doc.setFillColor(249, 250, 251); // gray-50
        this.doc.setDrawColor(229, 231, 235); // gray-200
        this.doc.setLineWidth(0.5);
        this.doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

        // Card title
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(107, 114, 128); // gray-500
        this.doc.text(card.title, x + 5, y + 10);

        // Card value
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(17, 24, 39); // gray-900
        this.doc.text(card.value.toString(), x + 5, y + 22);

        // Card subtitle
        if (card.subtitle) {
          this.doc.setFontSize(8);
          this.doc.setFont('helvetica', 'normal');
          this.doc.setTextColor(107, 114, 128); // gray-500
          this.doc.text(card.subtitle, x + 5, y + 30);
        }

        // Trend indicator
        if (card.trend) {
          const trendColor: [number, number, number] = card.trend.isPositive ? [34, 197, 94] : [239, 68, 68]; // green-500 or red-500
          this.doc.setTextColor(trendColor[0], trendColor[1], trendColor[2]);
          this.doc.setFontSize(8);
          const trendText = `${card.trend.isPositive ? '+' : ''}${card.trend.value}% ${card.trend.label}`;
          this.doc.text(trendText, x + cardWidth - 5 - this.doc.getTextWidth(trendText), y + 30);
        }
      }

      this.currentY += cardHeight + 15;
    }
  }

  /**
   * Add a table to the PDF
   */
  public addTable(tableData: PDFTableData): void {
    this.checkPageBreak(50);

    if (tableData.title) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(15, 23, 42); // slate-900
      this.doc.text(tableData.title, this.margin, this.currentY);
      this.currentY += 15;
    }

    const defaultStyles = {
      theme: 'striped',
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [55, 65, 81], // gray-700
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // gray-50
      },
      ...tableData.styles
    };

    this.doc.autoTable({
      head: [tableData.headers],
      body: tableData.rows,
      startY: this.currentY,
      margin: { left: this.margin, right: this.margin },
      ...defaultStyles
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  /**
   * Add a chart to the PDF by capturing HTML element
   */
  public async addChart(chartData: PDFChartData): Promise<void> {
    this.checkPageBreak(120);

    if (chartData.title) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(15, 23, 42); // slate-900
      this.doc.text(chartData.title, this.margin, this.currentY);
      this.currentY += 15;
    }

    try {
      const canvas = await html2canvas(chartData.element, {
        height: chartData.height || 400,
        width: chartData.width || 800,
        scale: chartData.scale || 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = chartData.width ? (chartData.width * 0.264583) / 2 : 100; // Convert px to mm
      const imgHeight = chartData.height ? (chartData.height * 0.264583) / 2 : 60;

      // Center the image
      const centerX = (this.pageWidth - imgWidth) / 2;
      
      this.doc.addImage(imgData, 'PNG', centerX, this.currentY, imgWidth, imgHeight);
      this.currentY += imgHeight + 15;
    } catch (error) {
      console.warn('Could not capture chart as image:', error);
      
      // Add placeholder text
      this.doc.setFontSize(10);
      this.doc.setTextColor(107, 114, 128); // gray-500
      this.doc.text('Chart could not be captured', this.margin, this.currentY);
      this.currentY += 15;
    }
  }

  /**
   * Add a section separator
   */
  public addSectionSeparator(title?: string): void {
    this.currentY += 10;
    this.checkPageBreak(30);

    // Separator line
    this.doc.setDrawColor(226, 232, 240); // slate-200
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);

    if (title) {
      this.currentY += 15;
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(15, 23, 42); // slate-900
      this.doc.text(title, this.margin, this.currentY);
      this.currentY += 10;
    } else {
      this.currentY += 10;
    }
  }

  /**
   * Check if we need a page break and add one if necessary
   */
  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - this.footerHeight - 10) {
      this.doc.addPage();
      this.currentY = this.headerHeight + 10;
    }
  }

  /**
   * Generate and download the PDF
   */
  public download(filename: string): void {
    const sanitizedFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    this.doc.save(`${sanitizedFilename}.pdf`);
  }

  /**
   * Get the PDF as a blob for further processing
   */
  public getBlob(): Blob {
    return this.doc.output('blob');
  }

  /**
   * Get the PDF as a data URL
   */
  public getDataURL(): string {
    return this.doc.output('dataurlstring');
  }

  /**
   * Reset the service for a new document
   */
  public reset(): void {
    this.doc = new jsPDF('portrait', 'mm', 'a4');
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.currentY = 20;
  }
}

export default PDFExportService; 