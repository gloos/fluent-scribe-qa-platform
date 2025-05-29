import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface PreferencesData {
  emailNotifications: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
  twoFactorEnabled: boolean;
  sessionTimeout: number;
}

interface PreferencesFormProps {
  userId: string;
}

export const PreferencesForm: React.FC<PreferencesFormProps> = ({ userId }) => {
  const [preferences, setPreferences] = useState<PreferencesData>({
    emailNotifications: true,
    securityAlerts: true,
    marketingEmails: false,
    twoFactorEnabled: false,
    sessionTimeout: 30
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
          const notificationSettings = data.notification_settings || {};
          setPreferences({
            emailNotifications: notificationSettings.email ?? true,
            securityAlerts: notificationSettings.security ?? true,
            marketingEmails: notificationSettings.marketing ?? false,
            twoFactorEnabled: notificationSettings.twoFactor ?? false,
            sessionTimeout: notificationSettings.sessionTimeout ?? 30
          });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

    loadPreferences();
  }, [userId]);

  const handlePreferenceChange = (key: keyof PreferencesData, value: boolean | number) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const notificationSettings = {
        email: preferences.emailNotifications,
        security: preferences.securityAlerts,
        marketing: preferences.marketingEmails,
        twoFactor: preferences.twoFactorEnabled,
        sessionTimeout: preferences.sessionTimeout
      };

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          notification_settings: notificationSettings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved successfully.",
        variant: "default"
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update preferences.";
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about account activity
                </p>
              </div>
              <Switch
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => handlePreferenceChange('emailNotifications', checked)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about suspicious activity
                </p>
              </div>
              <Switch
                checked={preferences.securityAlerts}
                onCheckedChange={(checked) => handlePreferenceChange('securityAlerts', checked)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive product updates and newsletters
                </p>
              </div>
              <Switch
                checked={preferences.marketingEmails}
                onCheckedChange={(checked) => handlePreferenceChange('marketingEmails', checked)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                checked={preferences.twoFactorEnabled}
                onCheckedChange={(checked) => handlePreferenceChange('twoFactorEnabled', checked)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}; 