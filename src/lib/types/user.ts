// User-related type definitions for the QA Platform

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  QA_ANALYST = 'qa_analyst',
  USER = 'user',
  GUEST = 'guest'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DEACTIVATED = 'deactivated'
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  TRIAL = 'trial'
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

// Define system permissions
export enum Permission {
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  DELETE_USERS = 'delete_users',
  
  // Role management
  MANAGE_ROLES = 'manage_roles',
  ASSIGN_ROLES = 'assign_roles',
  
  // QA Sessions
  CREATE_QA_SESSION = 'create_qa_session',
  VIEW_QA_SESSION = 'view_qa_session',
  VIEW_ALL_QA_SESSIONS = 'view_all_qa_sessions',
  DELETE_QA_SESSION = 'delete_qa_session',
  DELETE_ANY_QA_SESSION = 'delete_any_qa_session',
  
  // File management
  UPLOAD_FILES = 'upload_files',
  DELETE_FILES = 'delete_files',
  DELETE_ANY_FILES = 'delete_any_files',
  
  // Reports and analytics
  VIEW_REPORTS = 'view_reports',
  VIEW_ALL_REPORTS = 'view_all_reports',
  EXPORT_REPORTS = 'export_reports',
  
  // System administration
  VIEW_SYSTEM_LOGS = 'view_system_logs',
  MANAGE_SYSTEM_CONFIG = 'manage_system_config',
  
  // Billing and subscription
  VIEW_BILLING = 'view_billing',
  MANAGE_BILLING = 'manage_billing',
  VIEW_ALL_BILLING = 'view_all_billing'
}

// Core user profile interface
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  
  // Role and permissions
  role: UserRole;
  
  // Organization and team structure
  organization_id?: string;
  organization?: Organization;
  department?: string;
  job_title?: string;
  manager_id?: string;
  manager?: UserProfile;
  
  // User status and activity
  status: UserStatus;
  is_verified: boolean;
  email_verified_at?: string;
  last_login_at?: string;
  last_activity_at?: string;
  login_count: number;
  
  // Security fields
  password_changed_at?: string;
  two_factor_enabled: boolean;
  backup_codes_generated_at?: string;
  failed_login_attempts: number;
  locked_until?: string;
  
  // User preferences
  timezone: string;
  locale: string;
  date_format: string;
  time_format: string;
  
  // Metadata
  user_agent?: string;
  ip_address?: string;
  signup_source?: string;
  referral_code?: string;
  marketing_consent: boolean;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Organization interface
export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  
  // Organization settings
  max_users: number;
  max_storage_gb: number;
  subscription_tier: SubscriptionTier;
  
  // Contact information
  contact_email?: string;
  contact_phone?: string;
  billing_email?: string;
  
  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  
  // Settings
  timezone: string;
  date_format: string;
  currency: string;
  
  // Status
  status: OrganizationStatus;
  trial_ends_at?: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// User preferences interface (extends existing structure)
export interface UserPreferences {
  id: string;
  user_id: string;
  preferred_language: string;
  notification_settings: {
    email: boolean;
    browser: boolean;
    slack?: boolean;
    teams?: boolean;
  };
  analysis_settings: {
    autoAnalyze: boolean;
    severity: 'minor' | 'major' | 'critical';
    confidence_threshold?: number;
  };
  ui_preferences?: {
    theme: 'light' | 'dark' | 'auto';
    sidebar_collapsed: boolean;
    table_density: 'compact' | 'standard' | 'comfortable';
  };
  created_at: string;
  updated_at: string;
}

// For API responses and forms
export interface CreateUserRequest {
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  organization_id?: string;
  department?: string;
  job_title?: string;
  phone?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  role?: UserRole;
  organization_id?: string;
  department?: string;
  job_title?: string;
  manager_id?: string;
  status?: UserStatus;
  timezone?: string;
  locale?: string;
  date_format?: string;
  time_format?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  website?: string;
  max_users?: number;
  max_storage_gb?: number;
  contact_email?: string;
  contact_phone?: string;
  timezone?: string;
  country?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  domain?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  max_users?: number;
  max_storage_gb?: number;
  subscription_tier?: SubscriptionTier;
  contact_email?: string;
  contact_phone?: string;
  billing_email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  date_format?: string;
  currency?: string;
  status?: OrganizationStatus;
}

// Helper types for API responses
export interface UserWithOrganization extends UserProfile {
  organization: Organization | null;
}

export interface OrganizationWithUsers extends Organization {
  users: UserProfile[];
  user_count: number;
}

// Database table types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> & {
          id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<UpdateUserRequest> & {
          updated_at?: string;
          updated_by?: string;
        };
      };
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<UpdateOrganizationRequest> & {
          updated_at?: string;
          updated_by?: string;
        };
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at'>> & {
          updated_at?: string;
        };
      };
    };
  };
} 