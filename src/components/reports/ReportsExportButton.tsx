import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Table, FileSpreadsheet, Settings, FileImage } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ExportConfigModal } from './ExportConfigModal';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface ReportFile {
  id: string;
  name: string;
  uploadedAt: string;
  completedAt: string;
  segments: number;
  errors: number;
  score: number;
  status: "pending" | "processing" | "completed" | "failed";
  language: string;
  fileType: string;
  fileSize: number;
  modelUsed?: string;
}

interface ReportsExportButtonProps {
  data: ReportFile[];
  filteredData: ReportFile[];
  isFiltering: boolean;
}

export const ReportsExportButton: React.FC<ReportsExportButtonProps> = ({
  data,
  filteredData,
  isFiltering,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const exportData = isFiltering ? filteredData : data;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const exportToJSON = () => {
    const exportPayload = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        isFiltered: isFiltering,
        exportType: 'reports'
      },
      data: exportData
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    downloadFile(blob, `reports-export-${Date.now()}.json`);
  };

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Name',
      'Uploaded At',
      'Completed At',
      'Status',
      'Language',
      'File Type',
      'File Size',
      'Segments',
      'Errors',
      'Score',
      'Model Used'
    ];

    const csvRows = [
      headers.join(','),
      ...exportData.map(report => [
        `"${report.id}"`,
        `"${report.name}"`,
        `"${formatDate(report.uploadedAt)}"`,
        `"${formatDate(report.completedAt)}"`,
        `"${report.status}"`,
        `"${report.language}"`,
        `"${report.fileType}"`,
        `"${formatFileSize(report.fileSize)}"`,
        report.segments,
        report.errors,
        report.score,
        `"${report.modelUsed || 'N/A'}"`
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    downloadFile(blob, `reports-export-${Date.now()}.csv`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Quality Assessment Reports', 20, 20);
    
    // Add export metadata
    doc.setFontSize(10);
    doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total records: ${exportData.length}`, 20, 35);
    doc.text(`Export type: ${isFiltering ? 'Filtered' : 'All'} Reports`, 20, 40);
    
    // Prepare table data
    const headers = [
      'Name', 'Status', 'Language', 'Type', 'Size', 
      'Segments', 'Errors', 'Score', 'Model'
    ];
    
    const rows = exportData.map(report => [
      report.name.length > 30 ? report.name.substring(0, 27) + '...' : report.name,
      report.status,
      report.language,
      report.fileType,
      formatFileSize(report.fileSize),
      report.segments.toString(),
      report.errors.toString(),
      report.score.toString(),
      report.modelUsed || 'N/A'
    ]);

    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 50,
      theme: 'grid',
      styles: { 
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Name column wider
        1: { cellWidth: 20 }, // Status
        2: { cellWidth: 25 }, // Language
        3: { cellWidth: 15 }, // Type
        4: { cellWidth: 20 }, // Size
        5: { cellWidth: 15 }, // Segments
        6: { cellWidth: 15 }, // Errors
        7: { cellWidth: 15 }, // Score
        8: { cellWidth: 20 }, // Model
      }
    });

    // Add footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    // Save the PDF
    doc.save(`reports-export-${Date.now()}.pdf`);
  };

  const exportToTrueExcel = () => {
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data for the main sheet
    const worksheetData = [
      [
        'ID', 'Name', 'Uploaded At', 'Completed At', 'Status', 
        'Language', 'File Type', 'File Size (Bytes)', 'Segments', 
        'Errors', 'Score', 'Model Used'
      ],
      ...exportData.map(report => [
        report.id,
        report.name,
        formatDate(report.uploadedAt),
        formatDate(report.completedAt),
        report.status,
        report.language,
        report.fileType,
        report.fileSize,
        report.segments,
        report.errors,
        report.score,
        report.modelUsed || 'N/A'
      ])
    ];

    // Create the main worksheet
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 30 }, // Name
      { wch: 15 }, // Uploaded At
      { wch: 15 }, // Completed At
      { wch: 12 }, // Status
      { wch: 15 }, // Language
      { wch: 12 }, // File Type
      { wch: 15 }, // File Size
      { wch: 10 }, // Segments
      { wch: 8 },  // Errors
      { wch: 8 },  // Score
      { wch: 15 }  // Model
    ];
    ws['!cols'] = colWidths;

    // Add the main sheet
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');

    // Create a summary sheet
    const completedCount = exportData.filter(r => r.status === 'completed').length;
    const pendingCount = exportData.filter(r => r.status === 'processing' || r.status === 'pending').length;
    const failedCount = exportData.filter(r => r.status === 'failed').length;
    const avgScore = exportData.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.score, 0) / completedCount || 0;

    const summaryData = [
      ['Report Summary'],
      [''],
      ['Metric', 'Value'],
      ['Total Reports', exportData.length],
      ['Completed Reports', completedCount],
      ['Pending Reports', pendingCount],
      ['Failed Reports', failedCount],
      ['Average Score', avgScore.toFixed(2)],
      [''],
      ['Export Information'],
      ['Exported At', new Date().toISOString()],
      ['Export Type', isFiltering ? 'Filtered' : 'All Reports'],
      ['Filter Applied', isFiltering ? 'Yes' : 'No']
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 15 }];
    
    // Style the summary sheet header
    if (summaryWs['A1']) {
      summaryWs['A1'].s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center' }
      };
    }

    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Save the workbook
    XLSX.writeFile(wb, `reports-export-${Date.now()}.xlsx`);
  };

  const exportToExcel = () => {
    // Legacy Excel export method - now redirects to true Excel
    exportToTrueExcel();
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'json' | 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    
    try {
      switch (format) {
        case 'json':
          exportToJSON();
          break;
        case 'csv':
          exportToCSV();
          break;
        case 'excel':
          exportToTrueExcel();
          break;
        case 'pdf':
          exportToPDF();
          break;
      }

      toast({
        title: "Export successful",
        description: `Reports exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdvancedExport = async (config: any) => {
    setIsExporting(true);
    
    try {
      let fileBlob: Blob;
      let fileName: string;
      
      // Generate the base filename
      const timestamp = Date.now();
      const baseFileName = config.filename || `reports-export-${timestamp}`;
      
      // Create the appropriate file based on format
      switch (config.format) {
        case 'json':
          const jsonData = createAdvancedJSONExport(config);
          fileBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
          fileName = `${baseFileName}.json`;
          break;
        case 'csv':
          const csvContent = createAdvancedCSVExport(config);
          fileBlob = new Blob([csvContent], { type: 'text/csv' });
          fileName = `${baseFileName}.csv`;
          break;
        case 'excel':
          const excelBlob = await createAdvancedExcelExport(config);
          fileBlob = excelBlob;
          fileName = `${baseFileName}.xlsx`;
          break;
        case 'pdf':
          const pdfBlob = await createAdvancedPDFExport(config);
          fileBlob = pdfBlob;
          fileName = `${baseFileName}.pdf`;
          break;
        default:
          throw new Error(`Unsupported format: ${config.format}`);
      }
      
      // Handle compression if requested
      if (config.compression) {
        const zip = new JSZip();
        zip.file(fileName, fileBlob);
        
        // Add metadata file if requested
        if (config.includeMetadata) {
          const metadata = {
            exportedAt: new Date().toISOString(),
            format: config.format,
            totalRecords: exportData.length,
            isFiltered: isFiltering,
            selectedColumns: config.columns,
            exportConfiguration: config
          };
          zip.file('export-metadata.json', JSON.stringify(metadata, null, 2));
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipBlob, `${baseFileName}.zip`);
      } else {
        downloadFile(fileBlob, fileName);
      }

      toast({
        title: "Export successful",
        description: `Reports exported as ${config.format.toUpperCase()}${config.compression ? ' (compressed)' : ''} with custom settings`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const createAdvancedJSONExport = (config: any) => {
    const baseData = {
      metadata: config.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        isFiltered: isFiltering,
        exportType: 'reports',
        selectedColumns: config.columns,
        configuration: config
      } as any : undefined,
      data: exportData.map(report => {
        const filteredReport: any = {};
        config.columns.forEach((column: string) => {
          if (column in report) {
            filteredReport[column] = (report as any)[column];
          }
        });
        return filteredReport;
      })
    };

    if (config.includeFilters && isFiltering) {
      baseData.metadata = { 
        ...baseData.metadata, 
        appliedFilters: { isFiltered: true, description: "Data has been filtered" }
      };
    }

    return baseData;
  };

  const createAdvancedCSVExport = (config: any) => {
    const headers = config.columns.map((col: string) => COLUMN_LABELS[col] || col);
    const delimiter = config.csvDelimiter || ',';
    
    const rows = [
      headers.join(delimiter),
      ...exportData.map((report: any) => 
        config.columns.map((col: string) => {
          let value = report[col];
          if (col === 'uploadedAt' || col === 'completedAt') {
            value = formatDateForConfig(value, config.dateFormat, config.customDateFormat);
          } else if (col === 'fileSize') {
            value = formatFileSize(value);
          }
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(delimiter)
      )
    ];

    let csvContent = rows.join('\n');
    
    if (config.includeMetadata) {
      const metadata = [
        `# Export Metadata`,
        `# Generated: ${new Date().toISOString()}`,
        `# Records: ${exportData.length}`,
        `# Format: CSV`,
        `# Columns: ${config.columns.length}`,
        ``,
        csvContent
      ].join('\n');
      csvContent = metadata;
    }

    return csvContent;
  };

  const createAdvancedExcelExport = async (config: any) => {
    const wb = XLSX.utils.book_new();
    
    // Main data sheet
    const worksheetData = [
      config.columns.map((col: string) => COLUMN_LABELS[col] || col),
      ...exportData.map((report: any) => 
        config.columns.map((col: string) => {
          let value = report[col];
          if (col === 'uploadedAt' || col === 'completedAt') {
            value = formatDateForConfig(value, config.dateFormat, config.customDateFormat);
          } else if (col === 'fileSize') {
            value = report[col]; // Keep as number for Excel
          }
          return value;
        })
      )
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths based on content
    const colWidths = config.columns.map((col: string) => {
      switch (col) {
        case 'name': return { wch: 30 };
        case 'id': return { wch: 10 };
        case 'uploadedAt':
        case 'completedAt': return { wch: 15 };
        default: return { wch: 12 };
      }
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Reports Data');
    
    // Add metadata sheet if requested
    if (config.includeMetadata) {
      const metadataSheet = [
        ['Export Information'],
        ['Generated At', new Date().toISOString()],
        ['Total Records', exportData.length],
        ['Format', 'Excel (.xlsx)'],
        ['Columns Included', config.columns.length],
        ['Filtered Data', isFiltering ? 'Yes' : 'No'],
        [''],
        ['Selected Columns'],
        ...config.columns.map((col: string) => [col, COLUMN_LABELS[col] || col])
      ];
      
      const metaWs = XLSX.utils.aoa_to_sheet(metadataSheet);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Export Info');
    }

    return new Promise<Blob>((resolve) => {
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      resolve(blob);
    });
  };

  const createAdvancedPDFExport = async (config: any) => {
    const doc = new jsPDF(
      config.pdfOptions?.orientation || 'portrait',
      'mm',
      config.pdfOptions?.pageSize || 'a4'
    );
    
    // Add title and metadata
    doc.setFontSize(20);
    doc.text('Quality Assessment Reports', 20, 20);
    
    if (config.includeMetadata) {
      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDateForConfig(new Date().toISOString(), config.dateFormat, config.customDateFormat)}`, 20, 30);
      doc.text(`Total records: ${exportData.length}`, 20, 35);
      doc.text(`Export type: ${isFiltering ? 'Filtered' : 'All'} Reports`, 20, 40);
      doc.text(`Columns: ${config.columns.length} selected`, 20, 45);
    }
    
    // Prepare table data with selected columns
    const headers = config.columns.map((col: string) => COLUMN_LABELS[col] || col);
    const rows = exportData.map((report: any) => 
      config.columns.map((col: string) => {
        let value = report[col];
        if (col === 'name' && typeof value === 'string' && value.length > 25) {
          value = value.substring(0, 22) + '...';
        } else if (col === 'uploadedAt' || col === 'completedAt') {
          value = formatDateForConfig(value, config.dateFormat, config.customDateFormat);
        } else if (col === 'fileSize') {
          value = formatFileSize(value);
        }
        return value?.toString() || '';
      })
    );

    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: config.includeMetadata ? 55 : 30,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    return new Promise<Blob>((resolve) => {
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    });
  };

  const formatDateForConfig = (dateString: string, format: string, customFormat?: string) => {
    const date = new Date(dateString);
    switch (format) {
      case 'iso':
        return date.toISOString().split('T')[0];
      case 'local':
        return date.toLocaleDateString();
      case 'custom':
        // Simple custom format implementation
        return customFormat ? date.toLocaleDateString() : date.toLocaleDateString();
      default:
        return date.toLocaleDateString();
    }
  };

  // Add COLUMN_LABELS constant
  const COLUMN_LABELS: Record<string, string> = {
    id: 'Report ID',
    name: 'File Name',
    uploadedAt: 'Upload Date',
    completedAt: 'Completion Date',
    status: 'Status',
    language: 'Language Pair',
    fileType: 'File Type',
    fileSize: 'File Size',
    segments: 'Segment Count',
    errors: 'Error Count',
    score: 'Quality Score',
    modelUsed: 'AI Model Used'
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isExporting || exportData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            Export {isFiltering ? 'Filtered' : 'All'} Reports
            <div className="text-xs text-muted-foreground font-normal">
              {exportData.length} record{exportData.length !== 1 ? 's' : ''}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
            <FileImage className="h-4 w-4 mr-2" />
            PDF Format
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel Format
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            <Table className="h-4 w-4 mr-2" />
            CSV Format
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('json')}>
            <FileText className="h-4 w-4 mr-2" />
            JSON Format
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowConfigDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Export Options
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportConfigModal
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        onExport={handleAdvancedExport}
        recordCount={exportData.length}
      />
    </>
  );
}; 