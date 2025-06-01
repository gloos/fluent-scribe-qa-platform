// QA Session types for the platform

export interface QASession {
  id: string;
  user_id: string;
  project_id?: string;
  file_name: string;
  file_type: 'xliff' | 'xlf' | 'mxliff';
  file_size: number;
  file_path?: string;
  upload_timestamp: string;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  mqm_score?: number;
  error_count: number;
  warning_count: number;
  analysis_results?: Record<string, any>;
  created_at: string;
  updated_at: string;
  model_used?: string;
}

export interface QAError {
  id: string;
  session_id: string;
  segment_id: string;
  error_type: string;
  error_category: string;
  severity: 'minor' | 'major' | 'critical';
  source_text: string;
  target_text: string;
  error_description: string;
  suggestion?: string;
  confidence_score?: number;
  created_at: string;
}

export interface FileUpload {
  id: string;
  session_id: string;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  upload_status: 'pending' | 'uploaded' | 'failed';
  created_at: string;
}

// Extended interfaces
export interface QASessionWithProject extends QASession {
  project?: {
    id: string;
    name: string;
    slug: string;
    client_name?: string;
  };
}

export interface QASessionWithErrors extends QASession {
  qa_errors: QAError[];
}

export interface QASessionWithUploads extends QASession {
  file_uploads: FileUpload[];
}

export interface QASessionWithDetails extends QASession {
  qa_errors: QAError[];
  file_uploads: FileUpload[];
  project?: {
    id: string;
    name: string;
    slug: string;
    client_name?: string;
  };
} 