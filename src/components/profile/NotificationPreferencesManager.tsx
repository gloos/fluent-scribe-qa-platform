import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Users,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle,
  Settings
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  settings: {
    email: NotificationFrequency;
    inApp: boolean;
    push: boolean;
    sms: boolean;
  };
}

export type NotificationFrequency = 'immediate' | 'daily' | 'weekly' | 'disabled';

export interface NotificationPreferences {
  categories: {
    assessments: NotificationCategory;
    collaboration: NotificationCategory;
    projects: NotificationCategory;
    system: NotificationCategory;
    security: NotificationCategory;
  };
  globalSettings: {
    quietHours: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string; // HH:MM format
      timezone: string;
    };
    workingDays: string[]; // ['monday', 'tuesday', etc.]
    emailDigest: {
      enabled: boolean;
      frequency: 'daily' | 'weekly';
      time: string; // HH:MM format
    };
    integrations: {
      slack: {
        enabled: boolean;
        webhookUrl?: string;
        channels: string[];
      };
      teams: {
        enabled: boolean;
        webhookUrl?: string;
      };
    };
  };
}

interface NotificationPreferencesManagerProps {
  userId: string;
}

export const NotificationPreferencesManager: React.FC<NotificationPreferencesManagerProps> = ({ 
  userId 
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    categories: {
      assessments: {
        id: 'assessments',
        name: 'Assessment Notifications',
        description: 'Notifications about assessment assignments, completions, and results',
        icon: FileText,
        settings: {
          email: 'immediate',
          inApp: true,
          push: true,
          sms: false
        }
      },
      collaboration: {
        id: 'collaboration',
        name: 'Collaboration & Comments',
        description: 'Team interactions, comments, and shared sessions',
        icon: MessageSquare,
        settings: {
          email: 'daily',
          inApp: true,
          push: true,
          sms: false
        }
      },
      projects: {
        id: 'projects',
        name: 'Project Updates',
        description: 'Project deadlines, status changes, and assignments',
        icon: Calendar,
        settings: {
          email: 'immediate',
          inApp: true,
          push: false,
          sms: false
        }
      },
      system: {
        id: 'system',
        name: 'System Notifications',
        description: 'Platform updates, maintenance, and new features',
        icon: Settings,
        settings: {
          email: 'weekly',
          inApp: true,
          push: false,
          sms: false
        }
      },
      security: {
        id: 'security',
        name: 'Security Alerts',
        description: 'Login attempts, account changes, and security events',
        icon: AlertTriangle,
        settings: {
          email: 'immediate',
          inApp: true,
          push: true,
          sms: true
        }
      }
    },
    globalSettings: {
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      },
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      emailDigest: {
        enabled: true,
        frequency: 'daily',
        time: '09:00'
      },
      integrations: {
        slack: {
          enabled: false,
          channels: []
        },
        teams: {
          enabled: false
        }
      }
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadNotificationPreferences();
  }, [userId]);

  const loadNotificationPreferences = async () => {
    try {
      setIsLoading(true);

      const { data: userPrefs, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userPrefs && !error) {
        const notificationSettings = userPrefs.notification_settings || {};
        
        // Update preferences with saved data
        if (notificationSettings.categories) {
          setPreferences(prev => ({
            ...prev,
            categories: {
              ...prev.categories,
              ...notificationSettings.categories
            }
          }));
        }

        if (notificationSettings.globalSettings) {
          setPreferences(prev => ({
            ...prev,
            globalSettings: {
              ...prev.globalSettings,
              ...notificationSettings.globalSettings
            }
          }));
        }
      }

    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateCategorySetting = async (
    categoryId: keyof NotificationPreferences['categories'],
    settingType: keyof NotificationCategory['settings'],
    value: any
  ) => {
    try {
      const updatedPreferences = {
        ...preferences,
        categories: {
          ...preferences.categories,
          [categoryId]: {
            ...preferences.categories[categoryId],
            settings: {
              ...preferences.categories[categoryId].settings,
              [settingType]: value
            }
          }
        }
      };

      setPreferences(updatedPreferences);
      await savePreferences(updatedPreferences);

    } catch (error) {
      console.error('Error updating category setting:', error);
      toast({
        title: "Error",
        description: "Failed to update notification setting",
        variant: "destructive"
      });
    }
  };

  const updateGlobalSetting = async (path: string[], value: any) => {
    try {
      const updatedPreferences = { ...preferences };
      let current: any = updatedPreferences.globalSettings;
      
      // Navigate to the nested property
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      
      // Update the final property
      current[path[path.length - 1]] = value;

      setPreferences(updatedPreferences);
      await savePreferences(updatedPreferences);

    } catch (error) {
      console.error('Error updating global setting:', error);
      toast({
        title: "Error",
        description: "Failed to update global setting",
        variant: "destructive"
      });
    }
  };

  const savePreferences = async (prefs: NotificationPreferences) => {
    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          notification_settings: {
            categories: prefs.categories,
            globalSettings: prefs.globalSettings,
            lastUpdated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated successfully",
      });

    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const FrequencySelector: React.FC<{
    value: NotificationFrequency;
    onChange: (value: NotificationFrequency) => void;
  }> = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as NotificationFrequency)}
      className="px-3 py-1 border rounded-md text-sm"
    >
      <option value="immediate">Immediate</option>
      <option value="daily">Daily Digest</option>
      <option value="weekly">Weekly Summary</option>
      <option value="disabled">Disabled</option>
    </select>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading notification preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Categories
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure how you want to be notified for different types of events
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(preferences.categories).map(([categoryId, category]) => {
            const IconComponent = category.icon;
            return (
              <div key={categoryId} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-medium">{category.name}</h4>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm font-medium">Email</span>
                    </div>
                    <FrequencySelector
                      value={category.settings.email}
                      onChange={(value) => updateCategorySetting(
                        categoryId as keyof NotificationPreferences['categories'],
                        'email',
                        value
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span className="text-sm font-medium">In-App</span>
                    </div>
                    <Switch
                      checked={category.settings.inApp}
                      onCheckedChange={(checked) => updateCategorySetting(
                        categoryId as keyof NotificationPreferences['categories'],
                        'inApp',
                        checked
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <span className="text-sm font-medium">Push</span>
                    </div>
                    <Switch
                      checked={category.settings.push}
                      onCheckedChange={(checked) => updateCategorySetting(
                        categoryId as keyof NotificationPreferences['categories'],
                        'push',
                        checked
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm font-medium">SMS</span>
                    </div>
                    <Switch
                      checked={category.settings.sms}
                      onCheckedChange={(checked) => updateCategorySetting(
                        categoryId as keyof NotificationPreferences['categories'],
                        'sms',
                        checked
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Global Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure general notification behavior and delivery preferences
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quiet Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Quiet Hours</h4>
                <p className="text-sm text-muted-foreground">
                  Suppress non-critical notifications during specified hours
                </p>
              </div>
              <Switch
                checked={preferences.globalSettings.quietHours.enabled}
                onCheckedChange={(checked) => updateGlobalSetting(['quietHours', 'enabled'], checked)}
              />
            </div>

            {preferences.globalSettings.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <input
                    type="time"
                    value={preferences.globalSettings.quietHours.start}
                    onChange={(e) => updateGlobalSetting(['quietHours', 'start'], e.target.value)}
                    className="w-full px-3 py-1 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <input
                    type="time"
                    value={preferences.globalSettings.quietHours.end}
                    onChange={(e) => updateGlobalSetting(['quietHours', 'end'], e.target.value)}
                    className="w-full px-3 py-1 border rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Digest */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Email Digest</h4>
                <p className="text-sm text-muted-foreground">
                  Receive consolidated email summaries instead of individual notifications
                </p>
              </div>
              <Switch
                checked={preferences.globalSettings.emailDigest.enabled}
                onCheckedChange={(checked) => updateGlobalSetting(['emailDigest', 'enabled'], checked)}
              />
            </div>

            {preferences.globalSettings.emailDigest.enabled && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="text-sm font-medium">Frequency</label>
                  <select
                    value={preferences.globalSettings.emailDigest.frequency}
                    onChange={(e) => updateGlobalSetting(['emailDigest', 'frequency'], e.target.value)}
                    className="w-full px-3 py-1 border rounded-md"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Delivery Time</label>
                  <input
                    type="time"
                    value={preferences.globalSettings.emailDigest.time}
                    onChange={(e) => updateGlobalSetting(['emailDigest', 'time'], e.target.value)}
                    className="w-full px-3 py-1 border rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Working Days */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Working Days</h4>
              <p className="text-sm text-muted-foreground">
                Select days when you want to receive work-related notifications
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.globalSettings.workingDays.includes(day)}
                    onChange={(e) => {
                      const workingDays = e.target.checked
                        ? [...preferences.globalSettings.workingDays, day]
                        : preferences.globalSettings.workingDays.filter(d => d !== day);
                      updateGlobalSetting(['workingDays'], workingDays);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Integrations
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect with external services for notifications
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Slack Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Send notifications to Slack channels
                </p>
              </div>
              <Switch
                checked={preferences.globalSettings.integrations.slack.enabled}
                onCheckedChange={(checked) => updateGlobalSetting(['integrations', 'slack', 'enabled'], checked)}
              />
            </div>

            {preferences.globalSettings.integrations.slack.enabled && (
              <div className="ml-6 space-y-3">
                <div>
                  <label className="text-sm font-medium">Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={preferences.globalSettings.integrations.slack.webhookUrl || ''}
                    onChange={(e) => updateGlobalSetting(['integrations', 'slack', 'webhookUrl'], e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Badge variant="outline" className="text-xs">
                  Configure Slack webhooks in your Slack workspace settings
                </Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Teams Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Microsoft Teams Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Send notifications to Teams channels
                </p>
              </div>
              <Switch
                checked={preferences.globalSettings.integrations.teams.enabled}
                onCheckedChange={(checked) => updateGlobalSetting(['integrations', 'teams', 'enabled'], checked)}
              />
            </div>

            {preferences.globalSettings.integrations.teams.enabled && (
              <div className="ml-6 space-y-3">
                <div>
                  <label className="text-sm font-medium">Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://outlook.office.com/webhook/..."
                    value={preferences.globalSettings.integrations.teams.webhookUrl || ''}
                    onChange={(e) => updateGlobalSetting(['integrations', 'teams', 'webhookUrl'], e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Badge variant="outline" className="text-xs">
                  Configure Teams connectors in your Teams channel settings
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => savePreferences(preferences)}
          disabled={isSaving}
          className="min-w-32"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}; 