import { supabase } from './supabase';
import { type FilterState } from '@/hooks/useReportFilters';
import { type ViewMode, type ChartLayout, type TimeframeOption } from '@/components/reports/ReportsVisualizationDashboard';

// Extended user preferences interface for reports
export interface ReportPreferences {
  // Filter preferences
  defaultFilters: FilterState;
  savedFilters: Array<{
    id: string;
    name: string;
    filters: FilterState;
    isDefault?: boolean;
    createdAt: string;
  }>;
  
  // Visualization preferences
  defaultViewMode: ViewMode;
  defaultChartLayout: ChartLayout;
  defaultTimeframe: TimeframeOption;
  autoRefresh: boolean;
  
  // Export preferences
  defaultExportFormat: 'pdf' | 'excel' | 'csv' | 'json';
  exportSettings: {
    includeCharts: boolean;
    includeMetadata: boolean;
    dateFormat: string;
    columnSelections: string[];
  };
  
  // UI preferences
  theme: 'light' | 'dark' | 'auto';
  tableDensity: 'compact' | 'standard' | 'comfortable';
  sidebarCollapsed: boolean;
  
  // Sharing preferences
  allowSharing: boolean;
  sharedConfigurations: Array<{
    id: string;
    name: string;
    sharedBy: string;
    sharedAt: string;
    preferences: Partial<ReportPreferences>;
  }>;
}

// Default preferences
export const defaultReportPreferences: ReportPreferences = {
  defaultFilters: {
    timeRange: '30d',
    reportType: 'all',
    languageFilter: 'all',
    scoreRange: [0, 10],
    dateRange: { from: null, to: null },
    fileSize: 'all',
    processingTimeRange: [0, 60],
    status: ['processing', 'completed', 'failed', 'pending'],
    errorRange: [0, 1000],
    segmentRange: [0, 10000],
    modelFilter: 'all',
    fileSizeRange: [0, 100],
    searchTerm: '',
  },
  savedFilters: [],
  defaultViewMode: 'table',
  defaultChartLayout: 'grid',
  defaultTimeframe: 30,
  autoRefresh: false,
  defaultExportFormat: 'excel',
  exportSettings: {
    includeCharts: true,
    includeMetadata: true,
    dateFormat: 'yyyy-MM-dd',
    columnSelections: ['name', 'status', 'language', 'segments', 'errors', 'score', 'uploadedAt'],
  },
  theme: 'auto',
  tableDensity: 'standard',
  sidebarCollapsed: false,
  allowSharing: true,
  sharedConfigurations: [],
};

export class UserPreferencesService {
  private static instance: UserPreferencesService;
  private cache: Map<string, ReportPreferences> = new Map();

  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  /**
   * Get user preferences from database or return defaults
   */
  async getUserPreferences(userId: string): Promise<ReportPreferences> {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user preferences:', error);
        return defaultReportPreferences;
      }

      if (!data) {
        // No preferences found, create default ones
        const newPreferences = await this.createUserPreferences(userId, defaultReportPreferences);
        return newPreferences;
      }

      // Parse and merge with defaults to ensure all fields are present
      const preferences: ReportPreferences = {
        ...defaultReportPreferences,
        ...this.parsePreferencesFromDatabase(data),
      };

      // Cache the preferences
      this.cache.set(userId, preferences);
      return preferences;

    } catch (error) {
      console.error('Unexpected error fetching preferences:', error);
      return defaultReportPreferences;
    }
  }

  /**
   * Save user preferences to database
   */
  async saveUserPreferences(userId: string, preferences: Partial<ReportPreferences>): Promise<ReportPreferences> {
    try {
      // Get current preferences to merge
      const currentPreferences = await this.getUserPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences };

      // Prepare data for database
      const dbData = this.preparePreferencesForDatabase(updatedPreferences);

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...dbData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving user preferences:', error);
        throw new Error('Failed to save preferences');
      }

      // Update cache
      this.cache.set(userId, updatedPreferences);
      return updatedPreferences;

    } catch (error) {
      console.error('Error saving preferences:', error);
      throw error;
    }
  }

  /**
   * Create initial user preferences
   */
  async createUserPreferences(userId: string, preferences: ReportPreferences): Promise<ReportPreferences> {
    try {
      const dbData = this.preparePreferencesForDatabase(preferences);

      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          ...dbData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user preferences:', error);
        throw new Error('Failed to create preferences');
      }

      // Cache the preferences
      this.cache.set(userId, preferences);
      return preferences;

    } catch (error) {
      console.error('Error creating preferences:', error);
      throw error;
    }
  }

  /**
   * Save a named filter configuration
   */
  async saveFilterConfiguration(userId: string, name: string, filters: FilterState, isDefault = false): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    const newFilter = {
      id: crypto.randomUUID(),
      name,
      filters,
      isDefault,
      createdAt: new Date().toISOString(),
    };

    // Remove any existing default if this is being set as default
    if (isDefault) {
      preferences.savedFilters = preferences.savedFilters.map(f => ({ ...f, isDefault: false }));
    }

    preferences.savedFilters.push(newFilter);
    await this.saveUserPreferences(userId, { savedFilters: preferences.savedFilters });
  }

  /**
   * Delete a saved filter configuration
   */
  async deleteFilterConfiguration(userId: string, filterId: string): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    preferences.savedFilters = preferences.savedFilters.filter(f => f.id !== filterId);
    await this.saveUserPreferences(userId, { savedFilters: preferences.savedFilters });
  }

  /**
   * Share a configuration with other users
   */
  async shareConfiguration(userId: string, configName: string, preferences: Partial<ReportPreferences>): Promise<string> {
    // This would typically involve creating a shareable link or adding to a shared configurations table
    // For now, we'll implement a simple sharing mechanism
    const shareId = crypto.randomUUID();
    
    // In a real implementation, you'd save this to a shared_configurations table
    console.log('Configuration shared:', { shareId, configName, preferences });
    
    return shareId;
  }

  /**
   * Load a shared configuration
   */
  async loadSharedConfiguration(shareId: string): Promise<Partial<ReportPreferences> | null> {
    // In a real implementation, you'd fetch from shared_configurations table
    console.log('Loading shared configuration:', shareId);
    return null;
  }

  /**
   * Clear cache for a user (useful for logout)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Parse preferences from database format
   */
  private parsePreferencesFromDatabase(data: any): Partial<ReportPreferences> {
    const preferences: Partial<ReportPreferences> = {};

    // Parse analysis_settings for report-specific preferences
    if (data.analysis_settings) {
      const analysisSettings = typeof data.analysis_settings === 'string' 
        ? JSON.parse(data.analysis_settings) 
        : data.analysis_settings;

      if (analysisSettings.reportPreferences) {
        Object.assign(preferences, analysisSettings.reportPreferences);
      }
    }

    // Parse ui_preferences
    if (data.ui_preferences) {
      const uiPrefs = typeof data.ui_preferences === 'string'
        ? JSON.parse(data.ui_preferences)
        : data.ui_preferences;

      preferences.theme = uiPrefs.theme || 'auto';
      preferences.tableDensity = uiPrefs.table_density || 'standard';
      preferences.sidebarCollapsed = uiPrefs.sidebar_collapsed || false;
    }

    return preferences;
  }

  /**
   * Prepare preferences for database storage
   */
  private preparePreferencesForDatabase(preferences: ReportPreferences): any {
    return {
      analysis_settings: {
        autoAnalyze: true,
        severity: 'major',
        reportPreferences: {
          defaultFilters: preferences.defaultFilters,
          savedFilters: preferences.savedFilters,
          defaultViewMode: preferences.defaultViewMode,
          defaultChartLayout: preferences.defaultChartLayout,
          defaultTimeframe: preferences.defaultTimeframe,
          autoRefresh: preferences.autoRefresh,
          defaultExportFormat: preferences.defaultExportFormat,
          exportSettings: preferences.exportSettings,
          allowSharing: preferences.allowSharing,
          sharedConfigurations: preferences.sharedConfigurations,
        },
      },
      ui_preferences: {
        theme: preferences.theme,
        table_density: preferences.tableDensity,
        sidebar_collapsed: preferences.sidebarCollapsed,
      },
    };
  }
}

// Export singleton instance
export const userPreferencesService = UserPreferencesService.getInstance(); 