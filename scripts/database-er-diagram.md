# Database Entity-Relationship Diagram

## Visual Schema Overview

### Core Entity Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   auth.users    │◄─────┤│    profiles     │◄─────┤│ organizations   │
│─────────────────│  1:1  │─────────────────│  M:1  │─────────────────│
│ id (PK)         │       │ id (PK,FK)      │       │ id (PK)         │
│ email           │       │ email (UK)      │       │ name            │
│ ...             │       │ organization_id │       │ slug (UK)       │
└─────────────────┘       │ manager_id (FK) │       │ domain          │
                          │ role            │       │ status          │
                          │ status          │       └─────────────────┘
                          └─────────────────┘               │
                                   │                        │ 1:M
                                   │ M:1 (self)             │
                                   │                        ▼
                                   └──────┐       ┌─────────────────┐
                                          │       │    projects     │
                                          ▼       │─────────────────│
                          ┌─────────────────┐     │ id (PK)         │
                          │    profiles     │     │ name            │
                          │   (manager)     │     │ slug (UK)       │
                          │─────────────────│     │ organization_id │
                          │ id (PK)         │     │ status          │
                          └─────────────────┘     │ created_by (FK) │
                                                  └─────────────────┘
                                                           │
                                                           │ 1:M
                                                           ▼
                                                  ┌─────────────────┐
                                                  │project_milestones│
                                                  │─────────────────│
                                                  │ id (PK)         │
                                                  │ project_id (FK) │
                                                  │ name            │
                                                  │ status          │
                                                  │ due_date        │
                                                  └─────────────────┘
```

### Project Membership (Many-to-Many Junction)

```
┌─────────────────┐                           ┌─────────────────┐
│    profiles     │                           │    projects     │
│─────────────────│                           │─────────────────│
│ id (PK)         │                           │ id (PK)         │
│ email           │                           │ name            │
│ role            │                           │ organization_id │
└─────────────────┘                           └─────────────────┘
         │                                             │
         │ M:M                                         │ M:M
         │                                             │
         │           ┌─────────────────┐               │
         └──────────►│project_members  │◄──────────────┘
                     │─────────────────│
                     │ id (PK)         │
                     │ project_id (FK) │
                     │ user_id (FK)    │
                     │ role            │
                     │ permissions     │
                     │ assigned_by(FK) │
                     │ UK(proj,user)   │
                     └─────────────────┘
```

### QA Processing Flow

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    profiles     │ 1:M   │   qa_sessions   │ 1:M   │  file_uploads   │
│─────────────────│◄─────┤│─────────────────│◄─────┤│─────────────────│
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ email           │       │ user_id (FK)    │       │ session_id (FK) │
│ organization_id │       │ project_id (FK) │       │ original_name   │
└─────────────────┘       │ file_name       │       │ stored_name     │
                          │ analysis_status │       │ file_size       │
                          │ mqm_score       │       └─────────────────┘
                          └─────────────────┘
                                   │
                                   │ 1:M
                                   ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │    qa_errors    │ M:1   │user_preferences │
                          │─────────────────│       │─────────────────│
                          │ id (PK)         │       │ id (PK)         │
                          │ session_id (FK) │       │ user_id (FK,UK) │
                          │ segment_id      │       │ preferred_lang  │
                          │ error_type      │       │ notifications   │
                          │ severity        │       │ analysis_sets   │
                          │ source_text     │       └─────────────────┘
                          │ target_text     │                │
                          │ confidence      │                │ 1:1
                          └─────────────────┘                │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │    profiles     │
                                                    │─────────────────│
                                                    │ id (PK)         │
                                                    └─────────────────┘
```

### Assessment Framework Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ organizations   │ 1:M   │assessment_      │ 1:M   │assessment_      │
│─────────────────│◄─────┤│criteria         │◄─────┤│templates        │
│ id (PK)         │       │─────────────────│       │─────────────────│
│ name            │       │ id (PK)         │       │ id (PK)         │
└─────────────────┘       │ name            │       │ name            │
                          │ framework       │       │ criteria_id(FK) │
                          │ organization_id │       │ template_config │
                          │ project_id (FK) │       │ organization_id │
                          │ criteria_config │       │ is_public       │
                          │ is_global       │       │ created_by (FK) │
                          │ created_by (FK) │       └─────────────────┘
                          └─────────────────┘
                                   │
                                   │ M:1
                                   ▼
                          ┌─────────────────┐
                          │assessment_      │
                          │results          │
                          │─────────────────│
                          │ id (PK)         │
                          │ session_id (FK) │
                          │ criteria_id(FK) │
                          │ assessor_id(FK) │
                          │ overall_score   │
                          │ mqm_score       │
                          │ review_status   │
                          │ approved_by(FK) │
                          └─────────────────┘
                                   │
                                   │ 1:M
                                   ▼
                          ┌─────────────────┐
                          │assessment_      │
                          │segments         │
                          │─────────────────│
                          │ id (PK)         │
                          │ assess_result_id│
                          │ session_id (FK) │
                          │ segment_id      │
                          │ source_text     │
                          │ target_text     │
                          │ segment_score   │
                          │ assessed_by(FK) │
                          │ UK(result,seg)  │
                          └─────────────────┘
```

### Enhanced QA Error Management

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   qa_sessions   │ 1:M   │    qa_errors    │ M:1   │assessment_      │
│─────────────────│◄─────┤│─────────────────│◄─────┤│results          │
│ id (PK)         │       │ id (PK)         │       │─────────────────│
│ user_id (FK)    │       │ session_id (FK) │       │ id (PK)         │
│ analysis_status │       │ assess_result_id│       │ session_id (FK) │
└─────────────────┘       │ assess_seg_id   │       │ assessor_id(FK) │
                          │ segment_id      │       └─────────────────┘
                          │ error_type      │
                          │ mqm_category    │                │
                          │ mqm_severity    │                │ M:1
                          │ is_critical     │                │
                          │ status          │                ▼
                          │ reviewer_id(FK) │       ┌─────────────────┐
                          └─────────────────┘       │assessment_      │
                                   │                │segments         │
                                   │ M:1            │─────────────────│
                                   │                │ id (PK)         │
                                   ▼                │ assess_result_id│
                          ┌─────────────────┐       │ segment_id      │
                          │    profiles     │       │ segment_score   │
                          │  (reviewer)     │       └─────────────────┘
                          │─────────────────│
                          │ id (PK)         │
                          │ role            │
                          └─────────────────┘
```

### Assessment Comparisons

```
┌─────────────────┐                           ┌─────────────────┐
│assessment_      │                           │assessment_      │
│results          │                           │results          │
│ (baseline)      │                           │ (target)        │
│─────────────────│                           │─────────────────│
│ id (PK)         │                           │ id (PK)         │
│ overall_score   │                           │ overall_score   │
└─────────────────┘                           └─────────────────┘
         │                                             │
         │ M:1                                         │ M:1
         │                                             │
         │           ┌─────────────────┐               │
         └──────────►│assessment_      │◄──────────────┘
                     │comparisons      │
                     │─────────────────│
                     │ id (PK)         │
                     │ name            │
                     │ comparison_type │
                     │ baseline_res_id │
                     │ target_result_id│
                     │ comparison_res  │
                     │ improvement_%   │
                     │ created_by (FK) │
                     └─────────────────┘
                              │
                              │ M:1
                              ▼
                     ┌─────────────────┐
                     │    profiles     │
                     │   (creator)     │
                     │─────────────────│
                     │ id (PK)         │
                     │ role            │
                     └─────────────────┘
```

## Constraint Summary

### Primary Keys (PK)
- All tables use UUID primary keys generated with `gen_random_uuid()`
- `profiles` table uses `auth.users.id` as both PK and FK

### Foreign Key Constraints (FK)
#### CASCADE DELETE
- `projects.organization_id` → `organizations.id`
- `project_members.project_id` → `projects.id`
- `project_members.user_id` → `profiles.id`
- `project_milestones.project_id` → `projects.id`
- `qa_sessions.user_id` → `profiles.id`
- `file_uploads.session_id` → `qa_sessions.id`
- `assessment_results.session_id` → `qa_sessions.id`
- `assessment_segments.assessment_result_id` → `assessment_results.id`
- `assessment_segments.session_id` → `qa_sessions.id`
- `qa_errors.session_id` → `qa_sessions.id`
- `assessment_templates.criteria_id` → `assessment_criteria.id`
- `user_preferences.user_id` → `profiles.id`

#### SET NULL
- `qa_sessions.project_id` → `projects.id`

#### NO CASCADE (Preserve History)
- All audit trail references (`created_by`, `updated_by`, etc.)
- Assessment criteria references
- Manager relationships
- Reviewer relationships

### Unique Constraints (UK)
#### Composite Unique
- `project_members(project_id, user_id)` - Prevents duplicate assignments
- `assessment_segments(assessment_result_id, segment_id)` - Unique segments per result

#### Single Column Unique
- `profiles.email` - Unique email addresses
- `organizations.slug` - URL-friendly organization identifiers
- `projects.slug` - URL-friendly project identifiers
- `user_preferences.user_id` - One preference set per user

### Check Constraints
- Status enums on multiple tables
- Role validations
- Score ranges (0-100 for percentages, decimal precision for scores)
- Severity levels (minor, major, critical)

## Security Model

### Row Level Security (RLS)
```
Organization Level:
├── profiles: Users see own organization members
├── projects: Users see organization projects
├── qa_sessions: Users see own sessions
└── assessments: Users see organization assessments

Project Level:
├── project_members: Project-based access control
├── project_milestones: Project team visibility
└── assessment_results: Project-scoped assessments

Session Level:
├── qa_sessions: Owner access only
├── qa_errors: Session owner access
├── file_uploads: Session owner access
└── assessment_segments: Assessor access
```

### Access Control Flow
1. **User Authentication** → `auth.users` → `profiles`
2. **Organization Access** → `profiles.organization_id` → `organizations`
3. **Project Access** → `project_members` → `projects`
4. **Session Access** → `qa_sessions.user_id` → User ownership
5. **Assessment Access** → Role-based via `profiles.role` and project membership

## Data Flow Patterns

### QA Processing Workflow
```
User Upload → qa_sessions → file_uploads
     ↓
Analysis Engine → qa_errors + assessment_results
     ↓
Segment Analysis → assessment_segments
     ↓
Review Process → qa_errors.reviewer_id + assessment_results.approved_by
     ↓
Comparison Analysis → assessment_comparisons
```

### Project Management Workflow
```
Organization → projects → project_members
     ↓
Project Planning → project_milestones
     ↓
QA Execution → qa_sessions (project_id)
     ↓
Assessment → assessment_results
     ↓
Reporting → Aggregated project metrics
```

### Assessment Configuration Workflow
```
Global Criteria → assessment_criteria (is_global=true)
     ↓
Organization Criteria → assessment_criteria (organization_id)
     ↓
Project Criteria → assessment_criteria (project_id)
     ↓
Templates → assessment_templates
     ↓
Execution → assessment_results
```

## Index Strategy

### High-Performance Relationships
- All foreign keys have corresponding indexes
- Composite indexes for junction table queries
- Status-based filtering indexes
- Date range indexes for temporal queries
- Score-based indexes for ranking and filtering

### Query Optimization Targets
1. **Organization-scoped queries** (Most common access pattern)
2. **Project member lookups** (Junction table optimization)
3. **Session aggregations** (Assessment rollups)
4. **User activity tracking** (Profile-based queries)
5. **Assessment comparisons** (Score-based analysis) 