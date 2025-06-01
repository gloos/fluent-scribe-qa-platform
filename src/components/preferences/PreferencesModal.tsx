import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Filter,
  BarChart3,
  Download,
  Palette,
  Share2,
  Trash2,
  Save,
  RotateCcw,
  Star,
  Copy,
} from 'lucide-react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { type FilterState } from '@/hooks/useReportFilters';
import { toast } from '@/hooks/use-toast';

interface PreferencesModalProps {
  children: React.ReactNode;
  currentFilters?: FilterState;
}

export function PreferencesModal({ children, currentFilters }: PreferencesModalProps) {
  const {
    preferences,
    loading,
    updateVisualizationPreferences,
    updateExportPreferences,
    updateUIPreferences,
    saveFilterConfiguration,
    deleteFilterConfiguration,
    getSavedFilters,
    shareConfiguration,
    resetToDefaults,
  } = useUserPreferences();

  const [open, setOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [shareConfigName, setShareConfigName] = useState('');

  const savedFilters = getSavedFilters();

  const handleSaveCurrentFilters = async () => {
    if (!filterName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the filter configuration",
        variant: "destructive",
      });
      return;
    }

    if (!currentFilters) {
      toast({
        title: "No filters to save",
        description: "No current filters available to save",
        variant: "destructive",
      });
      return;
    }

    await saveFilterConfiguration(filterName, currentFilters);
    setFilterName('');
  };

  const handleShareConfiguration = async () => {
    if (!shareConfigName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the shared configuration",
        variant: "destructive",
      });
      return;
    }

    try {
      const shareId = await shareConfiguration(shareConfigName, preferences);
      
      // Copy share ID to clipboard
      await navigator.clipboard.writeText(shareId);
      
      toast({
        title: "Configuration shared",
        description: "Share ID copied to clipboard",
      });
      
      setShareConfigName('');
    } catch (error) {
      console.error('Failed to share configuration:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            User Preferences
          </DialogTitle>
          <DialogDescription>
            Customize your reporting experience and save your preferred configurations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="visualization" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="visualization" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Visualization</span>
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
            <TabsTrigger value="ui" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">UI</span>
            </TabsTrigger>
            <TabsTrigger value="sharing" className="flex items-center gap-1">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Sharing</span>
            </TabsTrigger>
          </TabsList>

          {/* Visualization Preferences */}
          <TabsContent value="visualization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Default View Settings</CardTitle>
                <CardDescription>
                  Set your preferred default view mode and chart settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="viewMode">Default View Mode</Label>
                    <Select
                      value={preferences.defaultViewMode}
                      onValueChange={(value: any) => updateVisualizationPreferences({ viewMode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="table">Table View</SelectItem>
                        <SelectItem value="charts">Charts View</SelectItem>
                        <SelectItem value="mixed">Mixed View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chartLayout">Chart Layout</Label>
                    <Select
                      value={preferences.defaultChartLayout}
                      onValueChange={(value: any) => updateVisualizationPreferences({ chartLayout: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid Layout</SelectItem>
                        <SelectItem value="stacked">Stacked Layout</SelectItem>
                        <SelectItem value="carousel">Carousel Layout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeframe">Default Timeframe</Label>
                    <Select
                      value={preferences.defaultTimeframe.toString()}
                      onValueChange={(value) => updateVisualizationPreferences({ timeframe: parseInt(value) as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 2 weeks</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="60">Last 2 months</SelectItem>
                        <SelectItem value="90">Last 3 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoRefresh"
                      checked={preferences.autoRefresh}
                      onCheckedChange={(checked) => updateVisualizationPreferences({ autoRefresh: checked })}
                    />
                    <Label htmlFor="autoRefresh">Auto-refresh data</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filter Management */}
          <TabsContent value="filters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Save Current Filters</CardTitle>
                <CardDescription>
                  Save your current filter configuration for quick access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Filter configuration name"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                  />
                  <Button onClick={handleSaveCurrentFilters} disabled={!currentFilters}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Filter Configurations</CardTitle>
                <CardDescription>
                  Manage your saved filter configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedFilters.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No saved filter configurations yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{filter.name}</span>
                          {filter.isDefault && (
                            <Badge variant="secondary">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            {new Date(filter.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFilterConfiguration(filter.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Preferences */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Default Export Settings</CardTitle>
                <CardDescription>
                  Configure your preferred export format and options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exportFormat">Default Export Format</Label>
                    <Select
                      value={preferences.defaultExportFormat}
                      onValueChange={(value: any) => updateExportPreferences({ defaultFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select
                      value={preferences.exportSettings.dateFormat}
                      onValueChange={(value) => updateExportPreferences({ 
                        settings: { dateFormat: value } 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MMM dd, yyyy">MMM DD, YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Export Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="includeCharts"
                        checked={preferences.exportSettings.includeCharts}
                        onCheckedChange={(checked) => updateExportPreferences({ 
                          settings: { includeCharts: checked } 
                        })}
                      />
                      <Label htmlFor="includeCharts">Include charts in exports</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="includeMetadata"
                        checked={preferences.exportSettings.includeMetadata}
                        onCheckedChange={(checked) => updateExportPreferences({ 
                          settings: { includeMetadata: checked } 
                        })}
                      />
                      <Label htmlFor="includeMetadata">Include metadata</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UI Preferences */}
          <TabsContent value="ui" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interface Settings</CardTitle>
                <CardDescription>
                  Customize the appearance and behavior of the interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={preferences.theme}
                      onValueChange={(value: any) => updateUIPreferences({ theme: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Auto (System)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tableDensity">Table Density</Label>
                    <Select
                      value={preferences.tableDensity}
                      onValueChange={(value: any) => updateUIPreferences({ tableDensity: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="sidebarCollapsed"
                    checked={preferences.sidebarCollapsed}
                    onCheckedChange={(checked) => updateUIPreferences({ sidebarCollapsed: checked })}
                  />
                  <Label htmlFor="sidebarCollapsed">Collapse sidebar by default</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sharing */}
          <TabsContent value="sharing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Share Configuration</CardTitle>
                <CardDescription>
                  Share your current preferences with other users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Configuration name"
                    value={shareConfigName}
                    onChange={(e) => setShareConfigName(e.target.value)}
                  />
                  <Button onClick={handleShareConfiguration}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reset Preferences</CardTitle>
                <CardDescription>
                  Reset all preferences to their default values
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={resetToDefaults}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 