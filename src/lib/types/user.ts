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
  CREATE_USERS = 'create_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
  
  // Role management
  MANAGE_ROLES = 'manage_roles',
  ASSIGN_ROLES = 'assign_roles',
  VIEW_ROLES = 'view_roles',
  
  // Organization management
  MANAGE_ORGANIZATIONS = 'manage_organizations',
  VIEW_ORGANIZATIONS = 'view_organizations',
  CREATE_ORGANIZATIONS = 'create_organizations',
  UPDATE_ORGANIZATIONS = 'update_organizations',
  DELETE_ORGANIZATIONS = 'delete_organizations',
  VIEW_ALL_ORGANIZATIONS = 'view_all_organizations',
  
  // Project management
  MANAGE_PROJECTS = 'manage_projects',
  VIEW_PROJECTS = 'view_projects',
  CREATE_PROJECTS = 'create_projects',
  UPDATE_PROJECTS = 'update_projects',
  DELETE_PROJECTS = 'delete_projects',
  VIEW_ALL_PROJECTS = 'view_all_projects',
  DELETE_ANY_PROJECT = 'delete_any_project',
  
  // Project member management
  MANAGE_PROJECT_MEMBERS = 'manage_project_members',
  ADD_PROJECT_MEMBERS = 'add_project_members',
  REMOVE_PROJECT_MEMBERS = 'remove_project_members',
  UPDATE_PROJECT_MEMBERS = 'update_project_members',
  
  // QA Sessions
  CREATE_QA_SESSION = 'create_qa_session',
  VIEW_QA_SESSION = 'view_qa_session',
  UPDATE_QA_SESSION = 'update_qa_session',
  VIEW_ALL_QA_SESSIONS = 'view_all_qa_sessions',
  DELETE_QA_SESSION = 'delete_qa_session',
  DELETE_ANY_QA_SESSION = 'delete_any_qa_session',
  
  // File management
  UPLOAD_FILES = 'upload_files',
  VIEW_FILES = 'view_files',
  UPDATE_FILES = 'update_files',
  DELETE_FILES = 'delete_files',
  DELETE_ANY_FILES = 'delete_any_files',
  VIEW_ALL_FILES = 'view_all_files',
  
  // Reports and analytics
  VIEW_REPORTS = 'view_reports',
  CREATE_REPORTS = 'create_reports',
  UPDATE_REPORTS = 'update_reports',
  DELETE_REPORTS = 'delete_reports',
  VIEW_ALL_REPORTS = 'view_all_reports',
  EXPORT_REPORTS = 'export_reports',
  
  // User preferences
  MANAGE_USER_PREFERENCES = 'manage_user_preferences',
  UPDATE_USER_PREFERENCES = 'update_user_preferences',
  VIEW_USER_PREFERENCES = 'view_user_preferences',
  
  // System administration
  VIEW_SYSTEM_LOGS = 'view_system_logs',
  MANAGE_SYSTEM_CONFIG = 'manage_system_config',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  EXPORT_AUDIT_LOGS = 'export_audit_logs',
  
  // Billing and subscription
  VIEW_BILLING = 'view_billing',
  MANAGE_BILLING = 'manage_billing',
  VIEW_ALL_BILLING = 'view_all_billing',
  UPDATE_BILLING = 'update_billing',
  
  // API access control
  ACCESS_API = 'access_api',
  MANAGE_API_KEYS = 'manage_api_keys',
  
  // Security permissions
  MANAGE_SECURITY_SETTINGS = 'manage_security_settings',
  VIEW_SECURITY_LOGS = 'view_security_logs'
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
  two_factor_secret?: string;
  two_factor_method?: 'totp' | 'sms' | 'email';
  two_factor_backup_codes?: string; // JSON string
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