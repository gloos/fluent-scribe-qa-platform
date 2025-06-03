import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Lock,
  Settings,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Download,
  UserCheck,
  Clock,
  Database,
  Bell,
  Activity
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PasswordChangeForm } from './PasswordChangeForm';
import { TwoFactorSetup } from '../security/TwoFactorSetup';
import { NotificationPreferencesManager } from './NotificationPreferencesManager';
import { ActivityHistoryDisplay } from './ActivityHistoryDisplay';
import AccountDeletionWorkflow from './AccountDeletionWorkflow';
import { supabase } from '@/lib/supabase';

interface AccountSettings {
  security: {
    passwordLastChanged: string;
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    loginNotifications: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'organization';
    dataSharing: boolean;
    analyticsOptOut: boolean;
    marketingEmails: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    theme: 'light' | 'dark' | 'auto';
  };
  account: {
    dataRetention: number; // days
    autoDelete: boolean;
    exportHistory: Array<{
      date: string;
      type: string;
      status: 'completed' | 'pending' | 'failed';
    }>;
  };
}

interface AccountSettingsManagerProps {
  userId: string;
}

export const AccountSettingsManager: React.FC<AccountSettingsManagerProps> = ({ userId }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AccountSettings>({
    security: {
      passwordLastChanged: '',
      twoFactorEnabled: false,
      sessionTimeout: 30,
      loginNotifications: true
    },
    privacy: {
      profileVisibility: 'organization',
      dataSharing: false,
      analyticsOptOut: false,
      marketingEmails: false
    },
    preferences: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      theme: 'auto'
    },
    account: {
      dataRetention: 365,
      autoDelete: false,
      exportHistory: []
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('security');
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeletionWorkflow, setShowDeletionWorkflow] = useState(false);

  useEffect(() => {
    loadAccountSettings();
  }, [userId]);

  const loadAccountSettings = async () => {
    try {
      setIsLoading(true);

      // Load user preferences
      const { data: preferences, error: prefError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (preferences && !prefError) {
        const notificationSettings = preferences.notification_settings || {};
        const uiPreferences = preferences.ui_preferences || {};

        setSettings(prev => ({
          ...prev,
          security: {
            ...prev.security,
            sessionTimeout: notificationSettings.sessionTimeout || 30,
            loginNotifications: notificationSettings.security || true
          },
          privacy: {
            ...prev.privacy,
            marketingEmails: notificationSettings.marketing || false,
            dataSharing: notificationSettings.dataSharing || false,
            analyticsOptOut: notificationSettings.analyticsOptOut || false
          },
          preferences: {
            ...prev.preferences,
            language: preferences.preferred_language || 'en',
            theme: uiPreferences.theme || 'auto'
          }
        }));
      }

      // Load profile data for additional settings
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile && !profileError) {
        setSettings(prev => ({
          ...prev,
          privacy: {
            ...prev.privacy,
            profileVisibility: profile.profile_visibility || 'organization'
          }
        }));
      }

    } catch (error) {
      console.error('Error loading account settings:', error);
      toast({
        title: "Error",
        description: "Failed to load account settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (category: keyof AccountSettings, key: string, value: any) => {
    try {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      }));

      // Update in database based on category
      if (category === 'security' || category === 'privacy' || category === 'preferences') {
        const updateData: any = {};

        if (category === 'security' || category === 'privacy') {
          updateData.notification_settings = {
            ...settings.security,
            ...settings.privacy,
            [key]: value
          };
        }

        if (category === 'preferences') {
          if (key === 'language') {
            updateData.preferred_language = value;
          } else {
            updateData.ui_preferences = {
              ...settings.preferences,
              [key]: value
            };
          }
        }

        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            ...updateData,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      if (category === 'privacy' && key === 'profileVisibility') {
        const { error } = await supabase
          .from('profiles')
          .update({ profile_visibility: value })
          .eq('id', userId);

        if (error) throw error;
      }

      toast({
        title: "Settings Updated",
        description: "Your account settings have been saved successfully",
      });

    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  };

  const exportUserData = async () => {
    try {
      setIsExporting(true);

      // Collect user data from various tables
      const [profileData, preferencesData, sessionsData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
        supabase.from('qa_sessions').select('*').eq('user_id', userId).limit(100)
      ]);

      const exportData = {
        profile: profileData.data,
        preferences: preferencesData.data,
        recent_sessions: sessionsData.data,
        export_date: new Date().toISOString(),
        user_id: userId
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Record export in history
      setSettings(prev => ({
        ...prev,
        account: {
          ...prev.account,
          exportHistory: [
            {
              date: new Date().toISOString(),
              type: 'Full Data Export',
              status: 'completed' as const
            },
            ...prev.account.exportHistory
          ].slice(0, 10) // Keep last 10 exports
        }
      }));

      toast({
        title: "Export Complete",
        description: "Your data has been exported successfully",
      });

    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export your data",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const initiateAccountDeletion = async () => {
    // Launch the comprehensive deletion workflow
    setShowDeletionWorkflow(true);
  };

  const handleDeletionWorkflowCancel = () => {
    setShowDeletionWorkflow(false);
    setShowDeleteConfirmation(false);
  };

  const handleDeletionWorkflowComplete = () => {
    setShowDeletionWorkflow(false);
    setShowDeleteConfirmation(false);
    
    // Optionally redirect user or show a final message
    toast({
      title: "Account Deletion Process Complete",
      description: "Thank you for using our service. Your account deletion has been scheduled.",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading account settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
        <p className="text-muted-foreground">
          Manage your account security, privacy, and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password & Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PasswordChangeForm userId={userId} />
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-4">Two-Factor Authentication</h4>
                <TwoFactorSetup />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out after inactivity
                  </p>
                </div>
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Login Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new login attempts
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.security.loginNotifications}
                  onChange={(e) => updateSetting('security', 'loginNotifications', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Privacy Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Profile Visibility</p>
                  <p className="text-sm text-muted-foreground">
                    Who can see your profile information
                  </p>
                </div>
                <select
                  value={settings.privacy.profileVisibility}
                  onChange={(e) => updateSetting('privacy', 'profileVisibility', e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="private">Private</option>
                  <option value="organization">Organization Only</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Data Sharing</p>
                  <p className="text-sm text-muted-foreground">
                    Allow sharing anonymized usage data for improvements
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacy.dataSharing}
                  onChange={(e) => updateSetting('privacy', 'dataSharing', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Analytics Opt-Out</p>
                  <p className="text-sm text-muted-foreground">
                    Opt out of usage analytics collection
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacy.analyticsOptOut}
                  onChange={(e) => updateSetting('privacy', 'analyticsOptOut', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing Emails</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails about new features and updates
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacy.marketingEmails}
                  onChange={(e) => updateSetting('privacy', 'marketingEmails', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationPreferencesManager userId={userId} />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                User Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">
                    Interface language preference
                  </p>
                </div>
                <select
                  value={settings.preferences.language}
                  onChange={(e) => updateSetting('preferences', 'language', e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Interface color theme
                  </p>
                </div>
                <select
                  value={settings.preferences.theme}
                  onChange={(e) => updateSetting('preferences', 'theme', e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Timezone</p>
                  <p className="text-sm text-muted-foreground">
                    Your local timezone for date/time display
                  </p>
                </div>
                <select
                  value={settings.preferences.timezone}
                  onChange={(e) => updateSetting('preferences', 'timezone', e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium">Export Your Data</p>
                    <p className="text-sm text-muted-foreground">
                      Download a copy of your account data
                    </p>
                  </div>
                  <Button
                    onClick={exportUserData}
                    disabled={isExporting}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export Data'}
                  </Button>
                </div>

                {settings.account.exportHistory.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Recent Exports</p>
                    <div className="space-y-2">
                      {settings.account.exportHistory.slice(0, 3).map((export_item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span>{export_item.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {new Date(export_item.date).toLocaleDateString()}
                            </span>
                            <Badge variant={export_item.status === 'completed' ? 'default' : 'destructive'}>
                              {export_item.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-red-600">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account with our secure, multi-step process
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowDeleteConfirmation(true)}
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>

                {showDeleteConfirmation && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="space-y-4">
                      <p>
                        <strong>Important:</strong> Account deletion is a secure, multi-step process that includes:
                      </p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Identity verification for security</li>
                        <li>• Data export options (recommended)</li>
                        <li>• Clear explanation of data retention policies</li>
                        <li>• 30-day grace period to cancel</li>
                        <li>• Feedback collection to help us improve</li>
                      </ul>
                      <div className="flex gap-2">
                        <Button
                          onClick={initiateAccountDeletion}
                          variant="destructive"
                          size="sm"
                        >
                          Start Deletion Process
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirmation(false)}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityHistoryDisplay userId={userId} />
        </TabsContent>
      </Tabs>

      {/* Account Deletion Workflow Modal */}
      {showDeletionWorkflow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <AccountDeletionWorkflow />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 