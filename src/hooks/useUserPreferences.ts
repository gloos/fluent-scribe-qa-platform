import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { userPreferencesService, type ReportPreferences, defaultReportPreferences } from '@/lib/userPreferencesService';
import { type FilterState } from './useReportFilters';
import { type ViewMode, type ChartLayout, type TimeframeOption } from '@/components/reports/ReportsVisualizationDashboard';
import { toast } from './use-toast';

interface UseUserPreferencesReturn {
  preferences: ReportPreferences;
  loading: boolean;
  error: string | null;
  
  // Preference update methods
  updatePreferences: (updates: Partial<ReportPreferences>) => Promise<void>;
  updateFilterPreferences: (filters: Partial<FilterState>) => Promise<void>;
  updateVisualizationPreferences: (viz: {
    viewMode?: ViewMode;
    chartLayout?: ChartLayout;
    timeframe?: TimeframeOption;
    autoRefresh?: boolean;
  }) => Promise<void>;
  updateExportPreferences: (exportPrefs: {
    defaultFormat?: 'pdf' | 'excel' | 'csv' | 'json';
    settings?: Partial<ReportPreferences['exportSettings']>;
  }) => Promise<void>;
  updateUIPreferences: (ui: {
    theme?: 'light' | 'dark' | 'auto';
    tableDensity?: 'compact' | 'standard' | 'comfortable';
    sidebarCollapsed?: boolean;
  }) => Promise<void>;
  
  // Filter management
  saveFilterConfiguration: (name: string, filters: FilterState, isDefault?: boolean) => Promise<void>;
  deleteFilterConfiguration: (filterId: string) => Promise<void>;
  loadFilterConfiguration: (filterId: string) => FilterState | null;
  getSavedFilters: () => ReportPreferences['savedFilters'];
  
  // Sharing
  shareConfiguration: (name: string, config: Partial<ReportPreferences>) => Promise<string>;
  loadSharedConfiguration: (shareId: string) => Promise<void>;
  
  // Reset
  resetToDefaults: () => Promise<void>;
  resetFilters: () => Promise<void>;
}

export const useUserPreferences = (): UseUserPreferencesReturn => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<ReportPreferences>(defaultReportPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadUserPreferences();
    } else {
      // User not logged in, use defaults
      setPreferences(defaultReportPreferences);
      setLoading(false);
    }
  }, [user?.id]);

  const loadUserPreferences = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const userPrefs = await userPreferencesService.getUserPreferences(user.id);
      setPreferences(userPrefs);
    } catch (err) {
      console.error('Failed to load user preferences:', err);
      setError('Failed to load preferences');
      setPreferences(defaultReportPreferences);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = useCallback(async (updates: Partial<ReportPreferences>) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save preferences",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedPrefs = await userPreferencesService.saveUserPreferences(user.id, updates);
      setPreferences(updatedPrefs);
      
      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully",
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError('Failed to save preferences');
      toast({
        title: "Save failed",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  const updateFilterPreferences = useCallback(async (filters: Partial<FilterState>) => {
    const updatedFilters = { ...preferences.defaultFilters, ...filters };
    await updatePreferences({ defaultFilters: updatedFilters });
  }, [preferences.defaultFilters, updatePreferences]);

  const updateVisualizationPreferences = useCallback(async (viz: {
    viewMode?: ViewMode;
    chartLayout?: ChartLayout;
    timeframe?: TimeframeOption;
    autoRefresh?: boolean;
  }) => {
    const updates: Partial<ReportPreferences> = {};
    if (viz.viewMode !== undefined) updates.defaultViewMode = viz.viewMode;
    if (viz.chartLayout !== undefined) updates.defaultChartLayout = viz.chartLayout;
    if (viz.timeframe !== undefined) updates.defaultTimeframe = viz.timeframe;
    if (viz.autoRefresh !== undefined) updates.autoRefresh = viz.autoRefresh;
    
    await updatePreferences(updates);
  }, [updatePreferences]);

  const updateExportPreferences = useCallback(async (exportPrefs: {
    defaultFormat?: 'pdf' | 'excel' | 'csv' | 'json';
    settings?: Partial<ReportPreferences['exportSettings']>;
  }) => {
    const updates: Partial<ReportPreferences> = {};
    if (exportPrefs.defaultFormat !== undefined) {
      updates.defaultExportFormat = exportPrefs.defaultFormat;
    }
    if (exportPrefs.settings !== undefined) {
      updates.exportSettings = { ...preferences.exportSettings, ...exportPrefs.settings };
    }
    
    await updatePreferences(updates);
  }, [preferences.exportSettings, updatePreferences]);

  const updateUIPreferences = useCallback(async (ui: {
    theme?: 'light' | 'dark' | 'auto';
    tableDensity?: 'compact' | 'standard' | 'comfortable';
    sidebarCollapsed?: boolean;
  }) => {
    const updates: Partial<ReportPreferences> = {};
    if (ui.theme !== undefined) updates.theme = ui.theme;
    if (ui.tableDensity !== undefined) updates.tableDensity = ui.tableDensity;
    if (ui.sidebarCollapsed !== undefined) updates.sidebarCollapsed = ui.sidebarCollapsed;
    
    await updatePreferences(updates);
  }, [updatePreferences]);

  const saveFilterConfiguration = useCallback(async (name: string, filters: FilterState, isDefault = false) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save filter configurations",
        variant: "destructive",
      });
      return;
    }

    try {
      await userPreferencesService.saveFilterConfiguration(user.id, name, filters, isDefault);
      
      // Reload preferences to get updated saved filters
      await loadUserPreferences();
      
      toast({
        title: "Filter saved",
        description: `Filter configuration "${name}" has been saved`,
      });
    } catch (err) {
      console.error('Failed to save filter configuration:', err);
      toast({
        title: "Save failed",
        description: "Failed to save filter configuration. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  const deleteFilterConfiguration = useCallback(async (filterId: string) => {
    if (!user?.id) return;

    try {
      await userPreferencesService.deleteFilterConfiguration(user.id, filterId);
      
      // Reload preferences to get updated saved filters
      await loadUserPreferences();
      
      toast({
        title: "Filter deleted",
        description: "Filter configuration has been deleted",
      });
    } catch (err) {
      console.error('Failed to delete filter configuration:', err);
      toast({
        title: "Delete failed",
        description: "Failed to delete filter configuration. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  const loadFilterConfiguration = useCallback((filterId: string): FilterState | null => {
    const savedFilter = preferences.savedFilters.find(f => f.id === filterId);
    return savedFilter ? savedFilter.filters : null;
  }, [preferences.savedFilters]);

  const getSavedFilters = useCallback(() => {
    return preferences.savedFilters;
  }, [preferences.savedFilters]);

  const shareConfiguration = useCallback(async (name: string, config: Partial<ReportPreferences>): Promise<string> => {
    if (!user?.id) {
      throw new Error('Authentication required');
    }

    try {
      const shareId = await userPreferencesService.shareConfiguration(user.id, name, config);
      
      toast({
        title: "Configuration shared",
        description: `Share ID: ${shareId}`,
      });
      
      return shareId;
    } catch (err) {
      console.error('Failed to share configuration:', err);
      toast({
        title: "Share failed",
        description: "Failed to share configuration. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  }, [user?.id]);

  const loadSharedConfiguration = useCallback(async (shareId: string) => {
    try {
      const sharedConfig = await userPreferencesService.loadSharedConfiguration(shareId);
      
      if (sharedConfig) {
        await updatePreferences(sharedConfig);
        toast({
          title: "Configuration loaded",
          description: "Shared configuration has been applied",
        });
      } else {
        toast({
          title: "Configuration not found",
          description: "The shared configuration could not be found",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Failed to load shared configuration:', err);
      toast({
        title: "Load failed",
        description: "Failed to load shared configuration. Please try again.",
        variant: "destructive",
      });
    }
  }, [updatePreferences]);

  const resetToDefaults = useCallback(async () => {
    await updatePreferences(defaultReportPreferences);
    toast({
      title: "Preferences reset",
      description: "All preferences have been reset to defaults",
    });
  }, [updatePreferences]);

  const resetFilters = useCallback(async () => {
    await updateFilterPreferences(defaultReportPreferences.defaultFilters);
    toast({
      title: "Filters reset",
      description: "Filter preferences have been reset to defaults",
    });
  }, [updateFilterPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    updateFilterPreferences,
    updateVisualizationPreferences,
    updateExportPreferences,
    updateUIPreferences,
    saveFilterConfiguration,
    deleteFilterConfiguration,
    loadFilterConfiguration,
    getSavedFilters,
    shareConfiguration,
    loadSharedConfiguration,
    resetToDefaults,
    resetFilters,
  };
}; 