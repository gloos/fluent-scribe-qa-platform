import { useState, useEffect, useCallback } from 'react';
import { 
  analyticsViewService, 
  DashboardView, 
  ViewSuggestion, 
  ViewServiceOptions 
} from '@/lib/services/analytics-view-service';

interface UseAnalyticsViewsOptions extends ViewServiceOptions {
  autoLoad?: boolean;
  enableSuggestions?: boolean;
}

interface UseAnalyticsViewsReturn {
  // View state
  views: DashboardView[];
  currentView: DashboardView | null;
  suggestions: ViewSuggestion[];
  
  // Loading states
  isLoading: boolean;
  isLoadingSuggestions: boolean;
  isSaving: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  loadViews: () => Promise<void>;
  loadSuggestions: () => Promise<void>;
  setCurrentView: (view: DashboardView | null) => void;
  createView: (viewData: Partial<DashboardView>) => Promise<DashboardView>;
  updateView: (viewId: string, updates: Partial<DashboardView>) => Promise<DashboardView>;
  deleteView: (viewId: string) => Promise<boolean>;
  duplicateView: (sourceViewId: string, newName: string) => Promise<DashboardView>;
  trackViewUsage: (viewId: string) => Promise<void>;
  refreshViews: () => Promise<void>;
  clearError: () => void;
  
  // Utility functions
  getViewById: (viewId: string) => DashboardView | undefined;
  getDefaultView: () => DashboardView | undefined;
  hasCustomViews: () => boolean;
}

export function useAnalyticsViews(options: UseAnalyticsViewsOptions = {}): UseAnalyticsViewsReturn {
  const [views, setViews] = useState<DashboardView[]>([]);
  const [currentView, setCurrentViewState] = useState<DashboardView | null>(null);
  const [suggestions, setSuggestions] = useState<ViewSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    autoLoad = true,
    enableSuggestions = true,
    includeDefaults = true,
    ...serviceOptions
  } = options;

  // Load views from the service
  const loadViews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedViews = await analyticsViewService.getViews({
        includeDefaults,
        ...serviceOptions
      });
      
      setViews(loadedViews);
      
      // Set current view if none is selected
      if (!currentView && loadedViews.length > 0) {
        // Try to find a default view first, otherwise use the first available
        const defaultView = loadedViews.find(v => v.isDefault) || loadedViews[0];
        setCurrentViewState(defaultView);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load views';
      setError(errorMessage);
      console.error('Error loading views:', err);
    } finally {
      setIsLoading(false);
    }
  }, [includeDefaults, serviceOptions, currentView]);

  // Load view suggestions
  const loadSuggestions = useCallback(async () => {
    if (!enableSuggestions) return;
    
    setIsLoadingSuggestions(true);
    
    try {
      const loadedSuggestions = await analyticsViewService.getViewSuggestions(serviceOptions);
      setSuggestions(loadedSuggestions);
    } catch (err) {
      console.error('Error loading suggestions:', err);
      // Don't set error for suggestions as they're not critical
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [enableSuggestions, serviceOptions]);

  // Set current view with usage tracking
  const setCurrentView = useCallback(async (view: DashboardView | null) => {
    setCurrentViewState(view);
    
    if (view) {
      try {
        await analyticsViewService.trackViewUsage(view.id, serviceOptions);
      } catch (err) {
        console.warn('Failed to track view usage:', err);
        // Non-critical error, don't show to user
      }
    }
  }, [serviceOptions]);

  // Create a new view
  const createView = useCallback(async (viewData: Partial<DashboardView>): Promise<DashboardView> => {
    setIsSaving(true);
    setError(null);
    
    try {
      const newView = await analyticsViewService.createView(viewData, serviceOptions);
      
      // Refresh views to include the new one
      await loadViews();
      
      return newView;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create view';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [serviceOptions, loadViews]);

  // Update an existing view
  const updateView = useCallback(async (viewId: string, updates: Partial<DashboardView>): Promise<DashboardView> => {
    setIsSaving(true);
    setError(null);
    
    try {
      const updatedView = await analyticsViewService.updateView(viewId, updates, serviceOptions);
      
      // Update local state
      setViews(prevViews => 
        prevViews.map(view => view.id === viewId ? updatedView : view)
      );
      
      // Update current view if it's the one being modified
      if (currentView?.id === viewId) {
        setCurrentViewState(updatedView);
      }
      
      return updatedView;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update view';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [serviceOptions, currentView]);

  // Delete a view
  const deleteView = useCallback(async (viewId: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    
    try {
      const success = await analyticsViewService.deleteView(viewId, serviceOptions);
      
      if (success) {
        // Remove from local state
        setViews(prevViews => prevViews.filter(view => view.id !== viewId));
        
        // If we deleted the current view, switch to a default view
        if (currentView?.id === viewId) {
          const remainingViews = views.filter(view => view.id !== viewId);
          const newCurrentView = remainingViews.find(v => v.isDefault) || remainingViews[0] || null;
          setCurrentViewState(newCurrentView);
        }
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete view';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [serviceOptions, currentView, views]);

  // Duplicate a view
  const duplicateView = useCallback(async (sourceViewId: string, newName: string): Promise<DashboardView> => {
    setIsSaving(true);
    setError(null);
    
    try {
      const duplicatedView = await analyticsViewService.duplicateView(sourceViewId, newName, serviceOptions);
      
      // Refresh views to include the new one
      await loadViews();
      
      return duplicatedView;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate view';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [serviceOptions, loadViews]);

  // Track view usage
  const trackViewUsage = useCallback(async (viewId: string): Promise<void> => {
    try {
      await analyticsViewService.trackViewUsage(viewId, serviceOptions);
    } catch (err) {
      console.warn('Failed to track view usage:', err);
      // Non-critical error
    }
  }, [serviceOptions]);

  // Refresh views (clear cache and reload)
  const refreshViews = useCallback(async () => {
    analyticsViewService.clearCache();
    await loadViews();
    if (enableSuggestions) {
      await loadSuggestions();
    }
  }, [loadViews, loadSuggestions, enableSuggestions]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Utility functions
  const getViewById = useCallback((viewId: string): DashboardView | undefined => {
    return views.find(view => view.id === viewId);
  }, [views]);

  const getDefaultView = useCallback((): DashboardView | undefined => {
    return views.find(view => view.isDefault);
  }, [views]);

  const hasCustomViews = useCallback((): boolean => {
    return views.some(view => view.isCustom);
  }, [views]);

  // Load views on mount or when options change
  useEffect(() => {
    if (autoLoad) {
      loadViews();
    }
  }, [autoLoad, loadViews]);

  // Load suggestions when views are loaded
  useEffect(() => {
    if (enableSuggestions && views.length > 0) {
      loadSuggestions();
    }
  }, [enableSuggestions, views.length, loadSuggestions]);

  return {
    // State
    views,
    currentView,
    suggestions,
    isLoading,
    isLoadingSuggestions,
    isSaving,
    error,
    
    // Actions
    loadViews,
    loadSuggestions,
    setCurrentView,
    createView,
    updateView,
    deleteView,
    duplicateView,
    trackViewUsage,
    refreshViews,
    clearError,
    
    // Utilities
    getViewById,
    getDefaultView,
    hasCustomViews
  };
} 