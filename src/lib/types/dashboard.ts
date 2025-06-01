export interface DashboardFilterPreferences {
  timeRange: string;
  reportType: string;
  languageFilter: string;
  autoApplyLastUsed: boolean;
}

export interface DashboardLayoutPreferences {
  chartSize: 'compact' | 'standard' | 'large';
  cardDensity: 'compact' | 'standard' | 'comfortable';
  showTrendIndicators: boolean;
  columnsPerRow: number;
}

export interface DashboardDataPreferences {
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
  defaultPageSize: number;
  showAdvancedMetrics: boolean;
}

export interface DashboardUIPreferences {
  theme: 'light' | 'dark' | 'auto';
  sidebar_collapsed: boolean;
  table_density: 'compact' | 'standard' | 'comfortable';
  // Dashboard-specific extensions
  dashboard_layout: DashboardLayoutPreferences;
  dashboard_filters: DashboardFilterPreferences;
  dashboard_data: DashboardDataPreferences;
}

export interface DashboardPreferences {
  ui: DashboardUIPreferences;
  notifications: {
    showFilterChanges: boolean;
    showDataUpdates: boolean;
    showErrorAlerts: boolean;
  };
}

// Default preferences
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  ui: {
    theme: 'auto',
    sidebar_collapsed: false,
    table_density: 'standard',
    dashboard_layout: {
      chartSize: 'standard',
      cardDensity: 'standard',
      showTrendIndicators: true,
      columnsPerRow: 5,
    },
    dashboard_filters: {
      timeRange: '7d',
      reportType: 'all',
      languageFilter: 'all',
      autoApplyLastUsed: true,
    },
    dashboard_data: {
      autoRefresh: false,
      refreshInterval: 300, // 5 minutes
      defaultPageSize: 20,
      showAdvancedMetrics: true,
    },
  },
  notifications: {
    showFilterChanges: false,
    showDataUpdates: true,
    showErrorAlerts: true,
  },
}; 