import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Download, FileText, Settings, FileImage, FileSpreadsheet, Table } from 'lucide-react';

interface ExportConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (config: ExportConfiguration) => void;
  recordCount: number;
}

interface ExportConfiguration {
  format: 'json' | 'csv' | 'excel' | 'pdf';
  filename?: string;
  includeMetadata: boolean;
  columns: string[];
  csvDelimiter?: ',' | ';' | '\t';
  dateFormat: 'iso' | 'local' | 'custom';
  customDateFormat?: string;
  includeFilters: boolean;
  compression: boolean;
  pdfOptions?: {
    orientation: 'portrait' | 'landscape';
    pageSize: 'a4' | 'letter' | 'legal';
    includeCharts: boolean;
  };
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
  };
}

const DEFAULT_COLUMNS = [
  'id',
  'name',
  'uploadedAt',
  'completedAt',
  'status',
  'language',
  'fileType',
  'fileSize',
  'segments',
  'errors',
  'score',
  'modelUsed'
];

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

export const ExportConfigModal: React.FC<ExportConfigModalProps> = ({
  open,
  onOpenChange,
  onExport,
  recordCount,
}) => {
  const [config, setConfig] = useState<ExportConfiguration>({
    format: 'csv',
    includeMetadata: true,
    columns: DEFAULT_COLUMNS,
    csvDelimiter: ',',
    dateFormat: 'local',
    includeFilters: true,
    compression: false,
    pdfOptions: {
      orientation: 'portrait',
      pageSize: 'a4',
      includeCharts: false,
    },
    schedule: {
      enabled: false,
      frequency: 'weekly',
      time: '09:00'
    }
  });

  const updateConfig = (updates: Partial<ExportConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const toggleColumn = (column: string) => {
    setConfig(prev => ({
      ...prev,
      columns: prev.columns.includes(column)
        ? prev.columns.filter(c => c !== column)
        : [...prev.columns, column]
    }));
  };

  const handleExport = () => {
    onExport(config);
    onOpenChange(false);
  };

  const generateFilename = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = config.format === 'excel' ? 'xlsx' : 
                     config.format === 'pdf' ? 'pdf' : config.format;
    return `reports-export-${timestamp}.${extension}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Export Configuration
          </DialogTitle>
          <DialogDescription>
            Customize your export settings and choose what data to include.
            Exporting {recordCount} record{recordCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="format" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="format" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Format</CardTitle>
                <CardDescription>
                  Choose the format for your exported data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.format === 'pdf' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => updateConfig({ format: 'pdf' })}
                  >
                    <FileImage className="h-8 w-8 mb-2 text-red-600" />
                    <h3 className="font-medium">PDF</h3>
                    <p className="text-sm text-gray-600">Professional document format with tables</p>
                  </div>
                  
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.format === 'excel' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => updateConfig({ format: 'excel' })}
                  >
                    <FileSpreadsheet className="h-8 w-8 mb-2 text-green-600" />
                    <h3 className="font-medium">Excel</h3>
                    <p className="text-sm text-gray-600">Microsoft Excel format with multiple sheets</p>
                  </div>
                  
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.format === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => updateConfig({ format: 'csv' })}
                  >
                    <Table className="h-8 w-8 mb-2 text-blue-600" />
                    <h3 className="font-medium">CSV</h3>
                    <p className="text-sm text-gray-600">Comma-separated values, compatible with Excel</p>
                  </div>
                  
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.format === 'json' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => updateConfig({ format: 'json' })}
                  >
                    <FileText className="h-8 w-8 mb-2 text-purple-600" />
                    <h3 className="font-medium">JSON</h3>
                    <p className="text-sm text-gray-600">Structured data format for developers</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filename">Custom Filename (optional)</Label>
                  <Input
                    id="filename"
                    placeholder={generateFilename()}
                    value={config.filename || ''}
                    onChange={(e) => updateConfig({ filename: e.target.value })}
                  />
                </div>

                {config.format === 'csv' && (
                  <div className="space-y-2">
                    <Label>CSV Delimiter</Label>
                    <Select 
                      value={config.csvDelimiter} 
                      onValueChange={(value: ',' | ';' | '\t') => updateConfig({ csvDelimiter: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=",">Comma (,)</SelectItem>
                        <SelectItem value=";">Semicolon (;)</SelectItem>
                        <SelectItem value="\t">Tab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {config.format === 'pdf' && (
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-medium">PDF Options</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Page Orientation</Label>
                        <Select 
                          value={config.pdfOptions?.orientation} 
                          onValueChange={(value: 'portrait' | 'landscape') => 
                            updateConfig({ 
                              pdfOptions: { ...config.pdfOptions!, orientation: value }
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Page Size</Label>
                        <Select 
                          value={config.pdfOptions?.pageSize} 
                          onValueChange={(value: 'a4' | 'letter' | 'legal') => 
                            updateConfig({ 
                              pdfOptions: { ...config.pdfOptions!, pageSize: value }
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a4">A4</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeCharts"
                        checked={config.pdfOptions?.includeCharts}
                        onCheckedChange={(checked) => updateConfig({ 
                          pdfOptions: { ...config.pdfOptions!, includeCharts: !!checked }
                        })}
                      />
                      <Label htmlFor="includeCharts">Include charts and visualizations</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="columns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Column Selection</CardTitle>
                <CardDescription>
                  Choose which columns to include in your export
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {DEFAULT_COLUMNS.map((column) => (
                    <div key={column} className="flex items-center space-x-2">
                      <Checkbox
                        id={column}
                        checked={config.columns.includes(column)}
                        onCheckedChange={() => toggleColumn(column)}
                      />
                      <Label htmlFor={column} className="text-sm font-normal">
                        {COLUMN_LABELS[column]}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateConfig({ columns: DEFAULT_COLUMNS })}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateConfig({ columns: [] })}
                    >
                      Clear All
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {config.columns.length} of {DEFAULT_COLUMNS.length} columns selected
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="options" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
                <CardDescription>
                  Configure additional export settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeMetadata"
                    checked={config.includeMetadata}
                    onCheckedChange={(checked) => updateConfig({ includeMetadata: !!checked })}
                  />
                  <Label htmlFor="includeMetadata">Include export metadata</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeFilters"
                    checked={config.includeFilters}
                    onCheckedChange={(checked) => updateConfig({ includeFilters: !!checked })}
                  />
                  <Label htmlFor="includeFilters">Include applied filters information</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="compression"
                    checked={config.compression}
                    onCheckedChange={(checked) => updateConfig({ compression: !!checked })}
                  />
                  <Label htmlFor="compression">Compress export file (ZIP)</Label>
                </div>

                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select 
                    value={config.dateFormat} 
                    onValueChange={(value: 'iso' | 'local' | 'custom') => updateConfig({ dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local format (12/31/2023)</SelectItem>
                      <SelectItem value="iso">ISO format (2023-12-31)</SelectItem>
                      <SelectItem value="custom">Custom format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.dateFormat === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="customDateFormat">Custom Date Format</Label>
                    <Input
                      id="customDateFormat"
                      placeholder="YYYY-MM-DD HH:mm:ss"
                      value={config.customDateFormat || ''}
                      onChange={(e) => updateConfig({ customDateFormat: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scheduled Exports
                  <Badge variant="secondary">Coming Soon</Badge>
                </CardTitle>
                <CardDescription>
                  Set up automatic exports on a recurring schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scheduleEnabled"
                    checked={config.schedule?.enabled}
                    onCheckedChange={(checked) => updateConfig({ 
                      schedule: { ...config.schedule!, enabled: !!checked }
                    })}
                    disabled
                  />
                  <Label htmlFor="scheduleEnabled" className="text-gray-400">
                    Enable scheduled exports
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4 opacity-50">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Weekly" />
                      </SelectTrigger>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" disabled value="09:00" />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Scheduled exports will be available in a future update. This feature will allow you to:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 list-disc list-inside">
                    <li>Set up recurring exports (daily, weekly, monthly)</li>
                    <li>Email exports to specified recipients</li>
                    <li>Store exports in cloud storage</li>
                    <li>Configure custom export templates</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            Ready to export {recordCount} record{recordCount !== 1 ? 's' : ''} with {config.columns.length} column{config.columns.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={config.columns.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export {config.format.toUpperCase()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 