/**
 * QA Platform API SDK TypeScript Definitions
 * 
 * Production-ready TypeScript definitions for comprehensive type safety
 * Version: 1.1.0
 */

export interface QAPlatformAPIOptions {
  apiKey?: string;
  jwtToken?: string;
  baseUrl?: string;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface FileUploadOptions {
  source_language?: string;
  target_language?: string;
  assessment_model?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'gemini-pro';
  priority?: 'low' | 'normal' | 'high';
  auto_process?: boolean;
  webhook_url?: string;
}

export interface ApiKeyData {
  name: string;
  description?: string;
  permissions: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  expires_at?: string | null;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    storage: 'healthy' | 'unhealthy';
  };
}

export interface VersionInfoResponse {
  version: string;
  build: string;
  timestamp: string;
  supported_versions: {
    version: string;
    status: 'active' | 'deprecated' | 'sunset';
    sunset_date?: string;
  }[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  type: 'xliff_1_2' | 'xliff_2_0' | 'mxliff';
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  source_language: string;
  target_language: string;
  uploaded_at: string;
  processed_at?: string;
  assessment_model?: string;
  priority: 'low' | 'normal' | 'high';
}

export interface FileListResponse {
  data: FileMetadata[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    pages: number;
  };
  timestamp: string;
}

export interface FileUploadResponse {
  file: FileMetadata;
  message: string;
  timestamp: string;
}

export interface AssessmentData {
  model: string;
  parameters?: Record<string, any>;
  webhook_url?: string;
}

export interface AssessmentResponse {
  id: string;
  file_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model: string;
  created_at: string;
  completed_at?: string;
  results?: {
    overall_score: number;
    category_scores: Record<string, number>;
    issues: Array<{
      severity: 'minor' | 'major' | 'critical';
      category: string;
      message: string;
      segment_id?: string;
    }>;
  };
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface FileFilters extends PaginationOptions {
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
  file_type?: 'xliff_1_2' | 'xliff_2_0' | 'mxliff';
}

export interface ApiKeyFilters extends PaginationOptions {
  name?: string;
  permissions?: string;
}

export interface MessageResponse {
  message: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
  timestamp: string;
}

export interface RateLimitErrorResponse extends ErrorResponse {
  retryAfter: number;
}

// Exception Classes
export class QAPlatformError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: string[];
  
  constructor(
    message: string,
    status?: number,
    code?: string,
    details?: string[]
  );
}

export class RateLimitError extends QAPlatformError {
  public readonly retryAfter: number;
  
  constructor(message: string, retryAfter: number);
}

export class AuthenticationError extends QAPlatformError {
  constructor(message?: string);
}

// Main API Class
export class QAPlatformAPI {
  constructor(options: QAPlatformAPIOptions);

  // Health and Status
  healthCheck(): Promise<HealthResponse>;
  getVersion(): Promise<VersionInfoResponse>;

  // Authentication
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): Promise<MessageResponse>;

  // API Key Management
  getApiKeys(options?: ApiKeyFilters): Promise<{
    data: ApiKeyResponse[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
      pages: number;
    };
    timestamp: string;
  }>;
  
  createApiKey(keyData: ApiKeyData): Promise<{
    api_key: ApiKeyResponse & { key: string };
    message: string;
    timestamp: string;
  }>;
  
  getApiKey(keyId: string): Promise<{
    api_key: ApiKeyResponse;
    timestamp: string;
  }>;
  
  updateApiKey(keyId: string, updates: Partial<ApiKeyData>): Promise<{
    api_key: ApiKeyResponse;
    message: string;
    timestamp: string;
  }>;
  
  deleteApiKey(keyId: string): Promise<MessageResponse>;

  // File Management
  getFiles(filters?: FileFilters): Promise<FileListResponse>;
  
  uploadFile(
    file: File | Blob | string, 
    options?: FileUploadOptions
  ): Promise<FileUploadResponse>;
  
  getFile(fileId: string): Promise<{
    file: FileMetadata;
    timestamp: string;
  }>;
  
  deleteFile(fileId: string): Promise<MessageResponse>;

  // Quality Assessment
  getAssessments(
    fileId: string, 
    options?: PaginationOptions
  ): Promise<{
    data: AssessmentResponse[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
      pages: number;
    };
    timestamp: string;
  }>;
  
  createAssessment(
    fileId: string, 
    assessmentData: AssessmentData
  ): Promise<{
    assessment: AssessmentResponse;
    message: string;
    timestamp: string;
  }>;
  
  getAssessment(
    fileId: string, 
    assessmentId: string
  ): Promise<{
    assessment: AssessmentResponse;
    timestamp: string;
  }>;

  // Utility Methods
  paginate<T = any>(
    endpoint: string, 
    options?: Record<string, any>
  ): Promise<T[]>;

  // Static Methods
  static validateWebhookSignature(
    payload: string, 
    signature: string, 
    secret: string
  ): boolean;
}

// Factory Functions
export function createApiClient(
  apiKey?: string,
  jwtToken?: string,
  environment?: 'development' | 'staging' | 'production'
): QAPlatformAPI;

// Type Guards
export function isQAPlatformError(error: any): error is QAPlatformError;
export function isRateLimitError(error: any): error is RateLimitError;
export function isAuthenticationError(error: any): error is AuthenticationError;

// Utility Types
export type Environment = 'development' | 'staging' | 'production';
export type AssessmentModel = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'gemini-pro';
export type Priority = 'low' | 'normal' | 'high';
export type FileStatus = 'uploaded' | 'processing' | 'completed' | 'failed';
export type FileType = 'xliff_1_2' | 'xliff_2_0' | 'mxliff';
export type AssessmentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type IssueSeverity = 'minor' | 'major' | 'critical';

// Re-export for convenience
export {
  QAPlatformAPI as default,
  QAPlatformAPIOptions as APIOptions,
  FileUploadOptions as UploadOptions,
};

declare global {
  interface Window {
    QAPlatformAPI: typeof QAPlatformAPI;
    QAPlatformError: typeof QAPlatformError;
    RateLimitError: typeof RateLimitError;
  }
}

export {}; 