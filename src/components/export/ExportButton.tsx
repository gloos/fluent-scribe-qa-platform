/**
 * Export Button Component
 * 
 * Integrated export functionality with support for multiple formats,
 * progress tracking, and user feedback.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  Archive,
  Loader2,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import UnifiedExportService, {
  ExportRequest,
  ExportResult,
  ExportProgress,
  ExportStage,
  ExportFormat
} from '@/lib/services/unified-export-service';
import DownloadHandlerService from '@/lib/services/download-handler-service';

export interface ExportButtonProps {
  data: any[];
  dataType: 'reports' | 'financial' | 'analytics' | 'custom';
  filename?: string;
  title?: string;
  subtitle?: string;
  charts?: HTMLElement[];
  metadata?: Record<string, any>;
  aggregations?: Record<string, any>;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showProgress?: boolean;
  onExportStart?: (format: ExportFormat) => void;
  onExportComplete?: (result: ExportResult) => void;
  onExportError?: (error: Error) => void;
}

interface ExportState {
  isExporting: boolean;
  progress: ExportProgress | null;
  lastResult: ExportResult | null;
  error: string | null;
}

const EXPORT_FORMATS = [
  {
    key: 'pdf' as ExportFormat,
    label: 'PDF Report',
    icon: FileImage,
    description: 'Professional PDF with charts and formatting'
  },
  {
    key: 'excel' as ExportFormat,
    label: 'Excel Workbook',
    icon: FileSpreadsheet,
    description: 'Multi-sheet Excel file with data and analytics'
  },
  {
    key: 'csv' as ExportFormat,
    label: 'CSV Data',
    icon: FileText,
    description: 'Raw data in comma-separated format'
  },
  {
    key: 'json' as ExportFormat,
    label: 'JSON Data',
    icon: FileText,
    description: 'Structured data in JSON format'
  },
  {
    key: 'zip' as ExportFormat,
    label: 'Multi-Format Archive',
    icon: Archive,
    description: 'ZIP file containing all formats'
  }
];

export function ExportButton({
  data,
  dataType,
  filename = 'export',
  title,
  subtitle,
  charts = [],
  metadata = {},
  aggregations = {},
  className = '',
  variant = 'outline',
  size = 'default',
  showProgress = true,
  onExportStart,
  onExportComplete,
  onExportError
}: ExportButtonProps) {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    progress: null,
    lastResult: null,
    error: null
  });

  const exportService = UnifiedExportService.getInstance();
  const downloadService = DownloadHandlerService.getInstance();

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (exportState.isExporting) return;

    try {
      setExportState({
        isExporting: true,
        progress: null,
        lastResult: null,
        error: null
      });

      // Call onExportStart callback
      if (onExportStart) {
        onExportStart(format);
      }

      // Prepare export request
      const exportRequest: ExportRequest = {
        format,
        filename: `${filename}_${new Date().toISOString().split('T')[0]}`,
        data: {
          type: dataType,
          rawData: data,
          charts: charts.length > 0 ? charts : undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          aggregations: Object.keys(aggregations).length > 0 ? aggregations : undefined
        },
        options: {
          title: title || `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Report`,
          subtitle,
          includeCharts: charts.length > 0,
          includeMetadata: Object.keys(metadata).length > 0,
          includeAggregations: Object.keys(aggregations).length > 0,
          onProgress: showProgress ? (progress: ExportProgress) => {
            setExportState(prev => ({
              ...prev,
              progress
            }));
          } : undefined,
          // PDF specific options
          orientation: format === 'pdf' && data.length > 10 ? 'landscape' : 'portrait',
          // Excel specific options
          multiSheet: format === 'excel' && dataType === 'financial',
          // ZIP specific options
          compression: format === 'zip' ? {
            level: 6,
            includeFormats: ['pdf', 'excel', 'csv', 'json']
          } : undefined
        }
      };

      // Perform export
      const result = await exportService.export(exportRequest);

      setExportState(prev => ({
        ...prev,
        isExporting: false,
        lastResult: result,
        progress: null
      }));

      if (result.success && result.blob) {
        // Create secure download
        const downloadLink = await downloadService.createSecureDownload({
          id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filename: result.filename,
          blob: result.blob,
          options: {
            expirationTime: 30 * 60 * 1000, // 30 minutes
            maxDownloads: 5,
            trackDownloads: true,
            forceDownload: true
          }
        });

        // Trigger download
        await downloadService.download(downloadLink.id);

        // Call onExportComplete callback
        if (onExportComplete) {
          onExportComplete(result);
        }

      } else {
        throw new Error(result.error?.message || 'Export failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      
      setExportState(prev => ({
        ...prev,
        isExporting: false,
        error: errorMessage,
        progress: null
      }));

      // Call onExportError callback
      if (onExportError) {
        onExportError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [
    data,
    dataType,
    filename,
    title,
    subtitle,
    charts,
    metadata,
    aggregations,
    showProgress,
    onExportStart,
    onExportComplete,
    onExportError,
    exportState.isExporting
  ]);

  const clearError = useCallback(() => {
    setExportState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  const getProgressMessage = () => {
    if (!exportState.progress) return '';
    
    const { stage, message, percentage } = exportState.progress;
    
    switch (stage) {
      case ExportStage.INITIALIZING:
        return 'Preparing export...';
      case ExportStage.VALIDATING_DATA:
        return 'Validating data...';
      case ExportStage.TRANSFORMING_DATA:
        return 'Processing data...';
      case ExportStage.GENERATING_CHARTS:
        return 'Capturing charts...';
      case ExportStage.CREATING_DOCUMENT:
        return 'Creating document...';
      case ExportStage.APPLYING_FORMATTING:
        return 'Applying formatting...';
      case ExportStage.FINALIZING:
        return 'Finalizing export...';
      case ExportStage.COMPRESSING:
        return 'Compressing files...';
      case ExportStage.COMPLETED:
        return 'Export completed!';
      case ExportStage.ERROR:
        return 'Export failed';
      default:
        return message;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (exportState.isExporting && showProgress) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Button
          variant={variant}
          size={size}
          disabled
          className="w-full"
        >
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exporting...
        </Button>
        
        {exportState.progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{getProgressMessage()}</span>
              <span>{Math.round(exportState.progress.percentage)}%</span>
            </div>
            <Progress value={exportState.progress.percentage} className="h-2" />
            {exportState.progress.estimatedTimeRemaining && (
              <div className="text-xs text-gray-500 text-center">
                Estimated time remaining: {Math.round(exportState.progress.estimatedTimeRemaining / 1000)}s
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={exportState.isExporting || data.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
            {exportState.lastResult && (
              <Badge variant="secondary" className="ml-2">
                <CheckCircle className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            Export Options
            <div className="text-xs text-muted-foreground font-normal">
              {data.length} records • {charts.length} charts
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <DropdownMenuItem
                key={format.key}
                onClick={() => handleExport(format.key)}
                className="cursor-pointer"
              >
                <Icon className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="font-medium">{format.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {format.description}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Error Alert */}
      {exportState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex justify-between items-center">
            <span>{exportState.error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-auto p-1"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Info */}
      {exportState.lastResult && exportState.lastResult.success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Export completed successfully! 
            {exportState.lastResult.size && (
              <span className="ml-1">
                ({formatFileSize(exportState.lastResult.size)})
              </span>
            )}
            {exportState.lastResult.duration && (
              <span className="ml-1">
                in {(exportState.lastResult.duration / 1000).toFixed(1)}s
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default ExportButton; 