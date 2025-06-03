import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Save, Upload, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
}

interface ProfileFormProps {
  initialData: ProfileFormData;
  userId: string;
  onUpdate: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ 
  initialData, 
  userId, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field-specific errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        // Update form data with new avatar URL
        setFormData(prev => ({ ...prev, avatarUrl: urlData.publicUrl }));
        setAvatarPreview(urlData.publicUrl);
        
        toast({
          title: "Avatar Uploaded",
          description: "Your avatar has been uploaded successfully.",
          variant: "default"
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload avatar.";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!formData.avatarUrl) return;

    try {
      // Extract filename from URL to delete from storage
      const url = new URL(formData.avatarUrl);
      const pathSegments = url.pathname.split('/');
      const fileName = pathSegments[pathSegments.length - 1];
      
      if (fileName && fileName.includes(userId)) {
        // Only delete if it's this user's avatar
        await supabase.storage
          .from('user-avatars')
          .remove([`avatars/${fileName}`]);
      }

      setFormData(prev => ({ ...prev, avatarUrl: '' }));
      setAvatarPreview(null);

      toast({
        title: "Avatar Removed",
        description: "Your avatar has been removed.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      // Still update the form even if storage deletion fails
      setFormData(prev => ({ ...prev, avatarUrl: '' }));
      setAvatarPreview(null);
    }
  };

  const getUserInitials = () => {
    const firstInitial = formData.firstName.charAt(0).toUpperCase();
    const lastInitial = formData.lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone || null,
          bio: formData.bio || null,
          avatar_url: formData.avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
        variant: "default"
      });

      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile.";
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAvatarUrl = avatarPreview || formData.avatarUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={currentAvatarUrl} alt="Profile avatar" />
                <AvatarFallback className="text-lg">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {currentAvatarUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar || isSubmitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={isUploadingAvatar || isSubmitting}
                className="hidden"
                id="avatar-upload"
              />
              <Label
                htmlFor="avatar-upload"
                className={cn(
                  "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  (isUploadingAvatar || isSubmitting) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Upload className="h-4 w-4" />
                {isUploadingAvatar ? 'Uploading...' : 'Change Avatar'}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG or GIF (max 5MB)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={cn(errors.firstName && "border-red-500")}
                disabled={isSubmitting}
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={cn(errors.lastName && "border-red-500")}
                disabled={isSubmitting}
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={cn(errors.email && "border-red-500")}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio (Optional)</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio || ''}
              onChange={handleInputChange}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" disabled={isSubmitting || isUploadingAvatar} className="w-full">
            {isSubmitting ? (
              <>Updating...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Profile
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}; 