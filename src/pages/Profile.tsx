import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Lock, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRBAC } from '@/hooks/useRBAC';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { PasswordChangeForm } from '@/components/profile/PasswordChangeForm';
import { PreferencesForm } from '@/components/profile/PreferencesForm';
import { SecurityInfo } from '@/components/profile/SecurityInfo';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { userProfile, refreshUserProfile } = useRBAC();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleProfileUpdate = () => {
    refreshUserProfile();
  };

  const profileData = {
    firstName: userProfile?.full_name?.split(' ')[0] || '',
    lastName: userProfile?.full_name?.split(' ').slice(1).join(' ') || '',
    email: user.email || '',
    phone: userProfile?.phone || '',
    bio: userProfile?.bio || ''
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm
            initialData={profileData}
            userId={user.id}
            onUpdate={handleProfileUpdate}
          />
        </TabsContent>

        <TabsContent value="password" className="space-y-6">
          <PasswordChangeForm userId={user.id} />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <PreferencesForm userId={user.id} />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <SecurityInfo userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile; 