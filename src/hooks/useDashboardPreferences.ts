import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getUserPreferences, updateUserPreferences } from '@/lib/api';
import { 
  DashboardPreferences, 
  DEFAULT_DASHBOARD_PREFERENCES,
  DashboardUIPreferences 
} from '@/lib/types/dashboard';
import { toast } from '@/hooks/use-toast';

const LOCAL_STORAGE_KEY = 'dashboard-preferences';

export const useDashboardPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      
      try {
        if (user) {
          // Try to load from user preferences in database
          const { data, error } = await getUserPreferences(user.id);
          
          if (data && !error) {
            // Merge database ui_preferences with dashboard defaults
            const mergedPreferences: DashboardPreferences = {
              ...DEFAULT_DASHBOARD_PREFERENCES,
              ui: {
                ...DEFAULT_DASHBOARD_PREFERENCES.ui,
                ...data.ui_preferences,
              },
            };
            setPreferences(mergedPreferences);
          } else {
            // Fallback to localStorage for authenticated users if DB fails
            loadFromLocalStorage();
          }
        } else {
          // For non-authenticated users, use localStorage only
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Error loading dashboard preferences:', error);
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsedPreferences = JSON.parse(stored);
        setPreferences({
          ...DEFAULT_DASHBOARD_PREFERENCES,
          ...parsedPreferences,
        });
      }
    } catch (error) {
      console.error('Error loading preferences from localStorage:', error);
    }
  };

  const saveToLocalStorage = (prefs: DashboardPreferences) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving preferences to localStorage:', error);
    }
  };

  const savePreferences = useCallback(async (newPreferences: DashboardPreferences) => {
    setIsSaving(true);
    
    try {
      // Always save to localStorage for immediate persistence
      saveToLocalStorage(newPreferences);
      setPreferences(newPreferences);

      // If user is authenticated, also save to database
      if (user) {
        const { error } = await updateUserPreferences(user.id, {
          ui_preferences: newPreferences.ui,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.error('Error saving to database:', error);
          toast({
            title: "Preference saved locally",
            description: "Preferences saved locally but couldn't sync to your account.",
            variant: "default",
          });
        } else {
          toast({
            title: "Preferences saved",
            description: "Your dashboard preferences have been updated.",
            variant: "default",
          });
        }
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Failed to save preferences",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const updatePreference = useCallback(<K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  const updateUIPreference = useCallback(<K extends keyof DashboardUIPreferences>(
    key: K,
    value: DashboardUIPreferences[K]
  ) => {
    const newPreferences = {
      ...preferences,
      ui: { ...preferences.ui, [key]: value }
    };
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  const resetToDefaults = useCallback(() => {
    savePreferences(DEFAULT_DASHBOARD_PREFERENCES);
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    isSaving,
    savePreferences,
    updatePreference,
    updateUIPreference,
    resetToDefaults,
  };
}; 