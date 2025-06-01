import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Monitor,
  Filter,
  Layout,
  RefreshCw,
  Bell,
  RotateCcw,
  Save,
  Palette,
  Grid,
  BarChart3,
} from 'lucide-react';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { DashboardPreferences } from '@/lib/types/dashboard';

interface DashboardPreferencesModalProps {
  children: React.ReactNode;
}

export const DashboardPreferencesModal: React.FC<DashboardPreferencesModalProps> = ({ children }) => {
  const {
    preferences,
    isLoading,
    isSaving,
    updateUIPreference,
    updatePreference,
    resetToDefaults,
  } = useDashboardPreferences();

  const [open, setOpen] = useState(false);

  if (isLoading) {
    return <>{children}</>;
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateUIPreference('theme', theme);
  };

  const handleLayoutChange = (key: string, value: any) => {
    updateUIPreference('dashboard_layout', {
      ...preferences.ui.dashboard_layout,
      [key]: value,
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    updateUIPreference('dashboard_filters', {
      ...preferences.ui.dashboard_filters,
      [key]: value,
    });
  };

  const handleDataChange = (key: string, value: any) => {
    updateUIPreference('dashboard_data', {
      ...preferences.ui.dashboard_data,
      [key]: value,
    });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    updatePreference('notifications', {
      ...preferences.notifications,
      [key]: value,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Preferences
          </DialogTitle>
          <DialogDescription>
            Customize your dashboard experience with themes, layouts, and default settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Theme
                </CardTitle>
                <CardDescription>
                  Choose how the dashboard appears
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Color Theme</Label>
                  <Select value={preferences.ui.theme} onValueChange={handleThemeChange}>
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
                  <Label>Table Density</Label>
                  <Select 
                    value={preferences.ui.table_density} 
                    onValueChange={(value) => updateUIPreference('table_density', value as 'compact' | 'standard' | 'comfortable')}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid className="h-5 w-5" />
                  Dashboard Layout
                </CardTitle>
                <CardDescription>
                  Customize the layout and spacing of dashboard elements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Chart Size</Label>
                  <Select 
                    value={preferences.ui.dashboard_layout.chartSize} 
                    onValueChange={(value) => handleLayoutChange('chartSize', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Card Density</Label>
                  <Select 
                    value={preferences.ui.dashboard_layout.cardDensity} 
                    onValueChange={(value) => handleLayoutChange('cardDensity', value)}
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

                <div className="space-y-3">
                  <Label>KPI Cards per Row: {preferences.ui.dashboard_layout.columnsPerRow}</Label>
                  <Slider
                    value={[preferences.ui.dashboard_layout.columnsPerRow]}
                    onValueChange={([value]) => handleLayoutChange('columnsPerRow', value)}
                    min={3}
                    max={6}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>3</span>
                    <span>6</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Trend Indicators</Label>
                    <p className="text-sm text-muted-foreground">
                      Display trend arrows and percentage changes on KPI cards
                    </p>
                  </div>
                  <Switch
                    checked={preferences.ui.dashboard_layout.showTrendIndicators}
                    onCheckedChange={(checked) => handleLayoutChange('showTrendIndicators', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Default Filters
                </CardTitle>
                <CardDescription>
                  Set default filter values that will be applied when you load the dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Default Time Range</Label>
                  <Select 
                    value={preferences.ui.dashboard_filters.timeRange} 
                    onValueChange={(value) => handleFilterChange('timeRange', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24h</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 3 months</SelectItem>
                      <SelectItem value="1y">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Report Type</Label>
                  <Select 
                    value={preferences.ui.dashboard_filters.reportType} 
                    onValueChange={(value) => handleFilterChange('reportType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="xliff">XLIFF</SelectItem>
                      <SelectItem value="mxliff">MXLIFF</SelectItem>
                      <SelectItem value="tmx">TMX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Language Filter</Label>
                  <Select 
                    value={preferences.ui.dashboard_filters.languageFilter} 
                    onValueChange={(value) => handleFilterChange('languageFilter', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      <SelectItem value="en-de">EN → DE</SelectItem>
                      <SelectItem value="fr-en">FR → EN</SelectItem>
                      <SelectItem value="es-en">ES → EN</SelectItem>
                      <SelectItem value="de-en">DE → EN</SelectItem>
                      <SelectItem value="ja-en">JA → EN</SelectItem>
                      <SelectItem value="zh-en">ZH → EN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Remember Last Used Filters</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically apply the filters you used in your previous session
                    </p>
                  </div>
                  <Switch
                    checked={preferences.ui.dashboard_filters.autoApplyLastUsed}
                    onCheckedChange={(checked) => handleFilterChange('autoApplyLastUsed', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Data Settings
                </CardTitle>
                <CardDescription>
                  Control how data is loaded and refreshed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Refresh</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically refresh dashboard data
                    </p>
                  </div>
                  <Switch
                    checked={preferences.ui.dashboard_data.autoRefresh}
                    onCheckedChange={(checked) => handleDataChange('autoRefresh', checked)}
                  />
                </div>

                {preferences.ui.dashboard_data.autoRefresh && (
                  <div className="space-y-3">
                    <Label>Refresh Interval: {Math.floor(preferences.ui.dashboard_data.refreshInterval / 60)} minutes</Label>
                    <Slider
                      value={[preferences.ui.dashboard_data.refreshInterval]}
                      onValueChange={([value]) => handleDataChange('refreshInterval', value)}
                      min={60}
                      max={1800}
                      step={60}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>1 min</span>
                      <span>30 min</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Default Page Size: {preferences.ui.dashboard_data.defaultPageSize}</Label>
                  <Slider
                    value={[preferences.ui.dashboard_data.defaultPageSize]}
                    onValueChange={([value]) => handleDataChange('defaultPageSize', value)}
                    min={10}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>10</span>
                    <span>100</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Advanced Metrics</Label>
                    <p className="text-sm text-muted-foreground">
                      Display additional performance and quality metrics
                    </p>
                  </div>
                  <Switch
                    checked={preferences.ui.dashboard_data.showAdvancedMetrics}
                    onCheckedChange={(checked) => handleDataChange('showAdvancedMetrics', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Choose what notifications to show during dashboard use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Filter Change Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show alerts when filters are applied
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.showFilterChanges}
                    onCheckedChange={(checked) => handleNotificationChange('showFilterChanges', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Data Update Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show alerts when data is refreshed
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.showDataUpdates}
                    onCheckedChange={(checked) => handleNotificationChange('showDataUpdates', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Error Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications for errors and issues
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.showErrorAlerts}
                    onCheckedChange={(checked) => handleNotificationChange('showErrorAlerts', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>

          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-sm text-muted-foreground">Saving...</span>
            )}
            <Button onClick={() => setOpen(false)}>
              <Save className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 