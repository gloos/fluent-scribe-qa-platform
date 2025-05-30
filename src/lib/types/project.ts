// Project-related type definitions for the QA Platform

// Enums for project-related fields
export enum ProjectType {
  TRANSLATION = 'translation',
  REVIEW = 'review',
  POST_EDITING = 'post_editing',
  TERMINOLOGY = 'terminology',
  STYLE_GUIDE = 'style_guide'
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived'
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ProjectMemberRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  QA_LEAD = 'qa_lead',
  TRANSLATOR = 'translator',
  REVIEWER = 'reviewer',
  MEMBER = 'member'
}

export enum ProjectMemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

// Core project interface
export interface Project {
  id: string;
  name: string;
  description?: string;
  slug: string;
  organization_id?: string;
  
  // Business context
  client_name?: string;
  project_type: ProjectType;
  priority: ProjectPriority;
  
  // Timeline
  start_date?: string; // ISO date string
  end_date?: string;
  deadline?: string;
  
  // Status and progress
  status: ProjectStatus;
  progress_percentage: number;
  
  // QA Settings
  default_qa_settings: {
    autoAnalyze: boolean;
    severity: 'minor' | 'major' | 'critical';
    mqmThreshold: number;
  };
  quality_threshold: number;
  
  // Metadata
  tags?: string[];
  metadata: Record<string, any>;
  
  // Relationships
  created_by?: string;
  updated_by?: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

// Project member interface
export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  
  // Role and permissions
  role: ProjectMemberRole;
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    manage: boolean;
  };
  
  // Assignment details
  assigned_by?: string;
  assigned_at: string;
  
  // Status
  status: ProjectMemberStatus;
}

// Project milestone interface
export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  
  // Timeline
  due_date?: string;
  completed_date?: string;
  
  // Status and progress
  status: MilestoneStatus;
  completion_percentage: number;
  
  // Display order
  sort_order: number;
  
  // Audit fields
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Extended project interface with related data
export interface ProjectWithDetails extends Project {
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  
  members?: (ProjectMember & {
    user: {
      id: string;
      email: string;
      full_name?: string;
      avatar_url?: string;
    };
  })[];
  
  milestones?: ProjectMilestone[];
  
  qa_sessions?: {
    id: string;
    file_name: string;
    analysis_status: string;
    mqm_score?: number;
    error_count: number;
    created_at: string;
  }[];
  
  // Computed fields
  total_sessions?: number;
  completed_sessions?: number;
  average_quality_score?: number;
  overdue_milestones?: number;
}

// Types for creating/updating projects
export interface CreateProjectData {
  name: string;
  description?: string;
  slug: string;
  organization_id?: string;
  client_name?: string;
  project_type?: ProjectType;
  priority?: ProjectPriority;
  start_date?: string;
  end_date?: string;
  deadline?: string;
  default_qa_settings?: {
    autoAnalyze?: boolean;
    severity?: 'minor' | 'major' | 'critical';
    mqmThreshold?: number;
  };
  quality_threshold?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  status?: ProjectStatus;
  progress_percentage?: number;
}

// Types for project members
export interface CreateProjectMemberData {
  project_id: string;
  user_id: string;
  role?: ProjectMemberRole;
  permissions?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
    manage?: boolean;
  };
}

export interface UpdateProjectMemberData {
  role?: ProjectMemberRole;
  permissions?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
    manage?: boolean;
  };
  status?: ProjectMemberStatus;
}

// Types for milestones
export interface CreateMilestoneData {
  project_id: string;
  name: string;
  description?: string;
  due_date?: string;
  sort_order?: number;
}

export interface UpdateMilestoneData extends Partial<CreateMilestoneData> {
  status?: MilestoneStatus;
  completion_percentage?: number;
  completed_date?: string;
}

// Project statistics interface
export interface ProjectStats {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  projects_this_month: number;
  average_completion_time: number; // days
  projects_by_status: Record<ProjectStatus, number>;
  projects_by_priority: Record<ProjectPriority, number>;
  upcoming_deadlines: Project[];
  overdue_projects: Project[];
}

// Project filter and search interfaces
export interface ProjectFilters {
  status?: ProjectStatus[];
  priority?: ProjectPriority[];
  project_type?: ProjectType[];
  organization_id?: string;
  created_by?: string;
  start_date_from?: string;
  start_date_to?: string;
  deadline_from?: string;
  deadline_to?: string;
  tags?: string[];
  search?: string; // Search in name, description, client_name
}

export interface ProjectSortOptions {
  field: 'name' | 'created_at' | 'deadline' | 'priority' | 'status' | 'progress_percentage';
  direction: 'asc' | 'desc';
}

// Updated QA Session interface to include project reference
export interface QASessionWithProject {
  id: string;
  project_id?: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    client_name?: string;
  };
  user_id: string;
  file_name: string;
  file_type: string;
  analysis_status: string;
  mqm_score?: number;
  error_count: number;
  warning_count: number;
  created_at: string;
  updated_at: string;
} 