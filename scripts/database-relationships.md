# Database Entity Relationships Analysis

## Overview
This document provides a comprehensive analysis of all entity relationships in the AI-Powered Linguistic QA Platform database schema. The schema supports a multi-tenant organization structure with complex quality assessment workflows.

## Core Entity Relationship Categories

### 1. Core User & Organization Management

#### User Authentication & Profiles
- **auth.users ↔ profiles** (1:1)
  - `profiles.id` REFERENCES `auth.users(id)` PRIMARY KEY
  - Extends Supabase auth with profile information
  - Cascade behavior: Manual trigger handles profile creation

#### Organizational Hierarchy
- **organizations ↔ profiles** (1:Many)
  - `profiles.organization_id` REFERENCES `organizations(id)`
  - Users belong to organizations
  - No cascade delete (preserves user data)

- **profiles ↔ profiles** (1:Many - Manager relationship)
  - `profiles.manager_id` REFERENCES `profiles(id)`
  - Self-referencing for organizational hierarchy
  - Allows management chains within organizations

### 2. Project Management Structure

#### Projects & Organizations
- **projects ↔ organizations** (Many:1)
  - `projects.organization_id` REFERENCES `organizations(id)` ON DELETE CASCADE
  - Projects belong to organizations
  - CASCADE DELETE: Removes projects when organization deleted

#### Project Membership (Many-to-Many via Junction Table)
- **projects ↔ profiles** (Many:Many via `project_members`)
  - `project_members.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
  - `project_members.user_id` REFERENCES `profiles(id)` ON DELETE CASCADE
  - `project_members.assigned_by` REFERENCES `profiles(id)`
  - Junction table with roles and permissions
  - UNIQUE constraint: `(project_id, user_id)` prevents duplicate assignments

#### Project Milestones
- **projects ↔ project_milestones** (1:Many)
  - `project_milestones.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
  - `project_milestones.created_by` REFERENCES `profiles(id)`
  - Cascade deletes milestones with projects

### 3. QA Sessions & File Processing

#### Session Ownership
- **qa_sessions ↔ profiles** (Many:1)
  - `qa_sessions.user_id` REFERENCES `profiles(id)` ON DELETE CASCADE
  - Each session belongs to a user
  - CASCADE DELETE: Removes sessions when user deleted

#### Session-Project Association
- **qa_sessions ↔ projects** (Many:1)
  - `qa_sessions.project_id` REFERENCES `projects(id)` ON DELETE SET NULL
  - Sessions can be grouped by projects
  - SET NULL: Preserves sessions when project deleted

#### File Storage
- **file_uploads ↔ qa_sessions** (Many:1)
  - `file_uploads.session_id` REFERENCES `qa_sessions(id)` ON DELETE CASCADE
  - Files are linked to QA sessions
  - CASCADE DELETE: Removes files when session deleted

#### User Preferences
- **user_preferences ↔ profiles** (1:1)
  - `user_preferences.user_id` REFERENCES `profiles(id)` ON DELETE CASCADE UNIQUE
  - One preference set per user
  - CASCADE DELETE: Removes preferences when user deleted

### 4. Assessment Framework

#### Assessment Criteria
- **assessment_criteria ↔ organizations** (Many:1)
  - `assessment_criteria.organization_id` REFERENCES `organizations(id)`
  - Criteria can be organization-specific
  - No cascade (preserves criteria history)

- **assessment_criteria ↔ projects** (Many:1)
  - `assessment_criteria.project_id` REFERENCES `projects(id)`
  - Criteria can be project-specific
  - No cascade (preserves criteria history)

- **assessment_criteria ↔ profiles** (Many:1 - Creator/Updater)
  - `assessment_criteria.created_by` REFERENCES `profiles(id)`
  - `assessment_criteria.updated_by` REFERENCES `profiles(id)`
  - Tracks who created/modified criteria

#### Assessment Templates
- **assessment_templates ↔ assessment_criteria** (Many:1)
  - `assessment_templates.criteria_id` REFERENCES `assessment_criteria(id)` ON DELETE CASCADE
  - Templates are based on criteria
  - CASCADE DELETE: Removes templates when criteria deleted

- **assessment_templates ↔ organizations** (Many:1)
  - `assessment_templates.organization_id` REFERENCES `organizations(id)`
  - Templates belong to organizations
  - No cascade (preserves template history)

- **assessment_templates ↔ profiles** (Many:1)
  - `assessment_templates.created_by` REFERENCES `profiles(id)`
  - Tracks template creator

#### Assessment Results
- **assessment_results ↔ qa_sessions** (Many:1)
  - `assessment_results.session_id` REFERENCES `qa_sessions(id)` ON DELETE CASCADE
  - Results are tied to QA sessions
  - CASCADE DELETE: Removes results when session deleted

- **assessment_results ↔ assessment_criteria** (Many:1)
  - `assessment_results.criteria_id` REFERENCES `assessment_criteria(id)`
  - Results use specific criteria
  - No cascade (preserves historical results)

- **assessment_results ↔ profiles** (Many:1 - Assessor/Approver)
  - `assessment_results.assessor_id` REFERENCES `profiles(id)`
  - `assessment_results.approved_by` REFERENCES `profiles(id)`
  - Tracks who performed and approved assessments

#### Assessment Segments (Detailed Analysis)
- **assessment_segments ↔ assessment_results** (Many:1)
  - `assessment_segments.assessment_result_id` REFERENCES `assessment_results(id)` ON DELETE CASCADE
  - Segments belong to assessment results
  - CASCADE DELETE: Removes segments when result deleted

- **assessment_segments ↔ qa_sessions** (Many:1)
  - `assessment_segments.session_id` REFERENCES `qa_sessions(id)` ON DELETE CASCADE
  - Segments also reference sessions directly
  - CASCADE DELETE: Removes segments when session deleted

- **assessment_segments ↔ profiles** (Many:1)
  - `assessment_segments.assessed_by` REFERENCES `profiles(id)`
  - Tracks who assessed each segment

#### Assessment Comparisons
- **assessment_comparisons ↔ assessment_results** (Many:1 - Baseline)
  - `assessment_comparisons.baseline_result_id` REFERENCES `assessment_results(id)`
  - References baseline assessment
  - No cascade (preserves comparison history)

- **assessment_comparisons ↔ assessment_results** (Many:1 - Target)
  - `assessment_comparisons.target_result_id` REFERENCES `assessment_results(id)`
  - References target assessment for comparison
  - No cascade (preserves comparison history)

- **assessment_comparisons ↔ profiles** (Many:1)
  - `assessment_comparisons.created_by` REFERENCES `profiles(id)`
  - Tracks who created comparison

### 5. Error Management & QA Details

#### QA Errors
- **qa_errors ↔ qa_sessions** (Many:1)
  - `qa_errors.session_id` REFERENCES `qa_sessions(id)` ON DELETE CASCADE
  - Errors belong to sessions
  - CASCADE DELETE: Removes errors when session deleted

- **qa_errors ↔ assessment_results** (Many:1)
  - `qa_errors.assessment_result_id` REFERENCES `assessment_results(id)`
  - Links errors to assessment results
  - No cascade (preserves error history)

- **qa_errors ↔ assessment_segments** (Many:1)
  - `qa_errors.assessment_segment_id` REFERENCES `assessment_segments(id)`
  - Links errors to specific segments
  - No cascade (preserves error history)

- **qa_errors ↔ profiles** (Many:1)
  - `qa_errors.reviewer_id` REFERENCES `profiles(id)`
  - Tracks who reviewed the error
  - No cascade (preserves reviewer history)

### 6. Audit Trail Relationships

#### Created/Updated By Tracking
Multiple tables track creation and modification:
- `profiles.created_by` → `profiles(id)`
- `profiles.updated_by` → `profiles(id)`
- `organizations.created_by` → `profiles(id)`
- `organizations.updated_by` → `profiles(id)`
- `projects.created_by` → `profiles(id)`
- `projects.updated_by` → `profiles(id)`

These relationships preserve audit trails without cascade deletes.

## Foreign Key Constraints Summary

### CASCADE DELETE Relationships
1. **organizations** → **projects** (Organization deletion removes projects)
2. **projects** → **project_members** (Project deletion removes memberships)
3. **projects** → **project_milestones** (Project deletion removes milestones)
4. **profiles** → **qa_sessions** (User deletion removes sessions)
5. **qa_sessions** → **file_uploads** (Session deletion removes files)
6. **qa_sessions** → **assessment_results** (Session deletion removes results)
7. **qa_sessions** → **assessment_segments** (Session deletion removes segments)
8. **qa_sessions** → **qa_errors** (Session deletion removes errors)
9. **assessment_results** → **assessment_segments** (Result deletion removes segments)
10. **assessment_criteria** → **assessment_templates** (Criteria deletion removes templates)
11. **profiles** → **user_preferences** (User deletion removes preferences)

### SET NULL Relationships
1. **projects** → **qa_sessions** (Project deletion preserves sessions with NULL project_id)

### RESTRICT/NO CASCADE Relationships
Most audit and historical references use no cascade to preserve data integrity:
- Assessment criteria references (preserve historical assessments)
- Creator/updater references (preserve audit trails)
- Manager references (preserve organizational history)
- Reviewer references (preserve review history)

## Unique Constraints

### Composite Unique Constraints
1. **project_members**: `(project_id, user_id)` - Prevents duplicate project assignments
2. **assessment_segments**: `(assessment_result_id, segment_id)` - Ensures unique segments per result

### Single Column Unique Constraints
1. **profiles**: `email` - Unique email addresses
2. **organizations**: `slug` - Unique organization identifiers
3. **projects**: `slug` - Unique project identifiers
4. **user_preferences**: `user_id` - One preference set per user

## Indexes for Relationship Performance

### Foreign Key Indexes
All foreign key columns have corresponding indexes for optimal JOIN performance:
- Profile relationships: `idx_profiles_organization_id`, `idx_profiles_manager_id`
- Project relationships: `idx_projects_organization_id`, `idx_projects_created_by`
- Assessment relationships: All assessment table foreign keys indexed
- Session relationships: `idx_qa_sessions_user_id`, `idx_qa_sessions_project_id`

### Multi-column Indexes
Some relationships benefit from composite indexes:
- `idx_project_members_project_id` and `idx_project_members_user_id` for junction table queries
- Status-based indexes for filtering active relationships

## Row Level Security (RLS) Impact on Relationships

RLS policies leverage relationships for access control:

1. **Organization-based Access**: Users can only access data within their organization
2. **Project-based Access**: Project members can only access project-related data
3. **Session Ownership**: Users can only access their own QA sessions and related data
4. **Assessment Access**: Assessors can only modify their own assessment results

These policies use the relationship structure to enforce data isolation and security.

## Relationship Validation Rules

### Check Constraints
1. **Status Enums**: Many tables have status fields with CHECK constraints
2. **Role Validation**: Project member roles and user roles are validated
3. **Score Ranges**: Assessment scores have range validations
4. **Percentage Validation**: Progress percentages constrained to 0-100

### Business Logic Constraints
1. **Circular Reference Prevention**: Manager relationships cannot create cycles
2. **Organization Consistency**: Projects and their members must belong to same organization
3. **Assessment Consistency**: Assessment results must use criteria from same organization/project

## Performance Considerations

### Relationship Optimization
1. **Junction Table Efficiency**: `project_members` uses composite unique constraint for fast lookups
2. **Cascade Performance**: Strategic use of CASCADE DELETE reduces orphaned records
3. **Index Coverage**: All foreign keys have supporting indexes
4. **Partition Candidates**: Large tables like `assessment_segments` may benefit from partitioning by session_id

### Query Pattern Optimization
1. **Organization Queries**: Most queries filter by organization_id first
2. **Session Aggregation**: Assessment results are typically aggregated by session
3. **Project Rollups**: Project progress calculated from session and milestone data
4. **User Activity**: User-centric views leverage profile relationships

## Migration and Maintenance

### Relationship Evolution
1. **Adding Relationships**: New foreign keys should include appropriate indexes
2. **Removing Relationships**: Consider data preservation vs. cleanup requirements
3. **Cascade Changes**: Changing cascade behavior requires careful data migration
4. **Performance Impact**: New relationships may require query plan adjustments

### Data Integrity Maintenance
1. **Orphan Cleanup**: Regular audits for orphaned records in non-cascade relationships
2. **Constraint Validation**: Periodic validation of business logic constraints
3. **RLS Policy Updates**: Keep security policies aligned with relationship changes
4. **Index Maintenance**: Monitor and adjust indexes based on relationship query patterns

## Junction Tables (Many-to-Many Relationships)

### Existing Junction Tables

1. **project_members**
   - **Purpose:** Links users to projects with roles and permissions
   - **Primary Entities:** `projects` ↔ `profiles`
   - **Additional Fields:** role, permissions, status, assigned_by, assigned_at

### Missing Junction Tables to Consider

1. **user_organization_roles** (if more complex org roles needed)
   - Could handle users belonging to multiple organizations with different roles
   - Currently handled by single organization_id in profiles

2. **project_tags** (if tag management needs normalization)
   - Currently tags are stored as TEXT[] in projects table
   - Could be normalized if tag management becomes complex

3. **assessment_criteria_tags** (if tag management needs normalization)
   - Currently tags are stored as TEXT[] in assessment_criteria table

## Referential Integrity & Cascade Rules

### CASCADE DELETE (Parent deletion removes children)
- `organizations` → `projects`
- `projects` → `project_members`, `project_milestones`
- `qa_sessions` → `qa_errors`, `file_uploads`, `assessment_results`, `assessment_segments`
- `assessment_criteria` → `assessment_templates`
- `assessment_results` → `assessment_segments`
- `profiles` → `qa_sessions`, `user_preferences`, `project_members`

### SET NULL (Parent deletion nullifies reference)
- `projects` ← `qa_sessions` (project_id becomes NULL if project deleted)

### RESTRICT (Implicit - prevents deletion if children exist)
- Most other relationships prevent parent deletion if children exist

## Indexes for Relationship Performance

All foreign keys have corresponding indexes for optimal join performance:
- `idx_profiles_organization_id`
- `idx_profiles_manager_id`
- `idx_projects_organization_id`
- `idx_project_members_project_id`, `idx_project_members_user_id`
- `idx_qa_sessions_user_id`, `idx_qa_sessions_project_id`
- `idx_qa_errors_session_id`
- `idx_assessment_results_session_id`, `idx_assessment_results_criteria_id`
- And many more...

## Row Level Security (RLS) Implications

Relationships are used in RLS policies to ensure users can only access:
- Their own data (via user_id foreign keys)
- Data from their organization (via organization hierarchy)
- Data from projects they're members of (via project_members junction table)

This creates a secure, hierarchical access control system based on the relationship structure. 