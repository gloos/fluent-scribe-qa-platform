-- Test Data Generation Script for Load Testing
-- This script creates realistic test data that mirrors production patterns

-- Clean up existing test data (if any)
DELETE FROM public.user_feedback WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'loadtest_%');
DELETE FROM public.qa_sessions WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'loadtest_%');
DELETE FROM public.assessment_results WHERE assessor_id IN (SELECT id FROM public.profiles WHERE email LIKE 'loadtest_%');
DELETE FROM public.project_members WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE 'loadtest_%');
DELETE FROM public.profiles WHERE email LIKE 'loadtest_%';
DELETE FROM public.projects WHERE organization_id IN (SELECT id FROM public.organizations WHERE name LIKE 'LoadTest_%');
DELETE FROM public.organizations WHERE name LIKE 'LoadTest_%';

-- Generate Test Organizations (10 organizations)
INSERT INTO public.organizations (id, name, slug, domain, description, max_users, max_storage_gb, subscription_tier, status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'LoadTest_Org_' || i,
    'loadtest-org-' || i,
    'loadtest' || i || '.example.com',
    'Load testing organization ' || i || ' for performance benchmarking',
    CASE 
        WHEN i <= 3 THEN 100 
        WHEN i <= 7 THEN 50 
        ELSE 25 
    END,
    CASE 
        WHEN i <= 3 THEN 50 
        WHEN i <= 7 THEN 25 
        ELSE 10 
    END,
    CASE 
        WHEN i <= 2 THEN 'enterprise'
        WHEN i <= 5 THEN 'pro'
        WHEN i <= 8 THEN 'basic'
        ELSE 'free'
    END,
    'active',
    NOW() - INTERVAL '30 days' + INTERVAL '1 day' * (i % 30),
    NOW() - INTERVAL '1 day' + INTERVAL '1 hour' * (i % 24)
FROM generate_series(1, 10) AS i;

-- Generate Test Users (100 users distributed across organizations)
WITH org_ids AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as org_num
    FROM public.organizations 
    WHERE name LIKE 'LoadTest_%'
)
INSERT INTO public.profiles (
    id, email, full_name, first_name, last_name, display_name, role, 
    organization_id, department, job_title, status, is_verified, 
    timezone, locale, login_count, created_at, updated_at, last_login_at, last_activity_at
)
SELECT 
    gen_random_uuid(),
    'loadtest_user_' || i || '@example.com',
    'Load Test User ' || i,
    'User',
    'LoadTest' || i,
    'LoadTester' || i,
    CASE 
        WHEN i % 20 = 1 THEN 'admin'
        WHEN i % 10 = 1 THEN 'manager'
        WHEN i % 5 = 1 THEN 'qa_analyst'
        ELSE 'user'
    END,
    (SELECT id FROM org_ids WHERE org_num = ((i - 1) % 10) + 1),
    CASE 
        WHEN i % 4 = 1 THEN 'Engineering'
        WHEN i % 4 = 2 THEN 'Quality Assurance'
        WHEN i % 4 = 3 THEN 'Product Management'
        ELSE 'Operations'
    END,
    CASE 
        WHEN i % 20 = 1 THEN 'Senior Manager'
        WHEN i % 10 = 1 THEN 'Team Lead'
        WHEN i % 5 = 1 THEN 'Senior Analyst'
        ELSE 'Analyst'
    END,
    'active',
    true,
    CASE 
        WHEN i % 4 = 1 THEN 'America/New_York'
        WHEN i % 4 = 2 THEN 'Europe/London'
        WHEN i % 4 = 3 THEN 'Asia/Tokyo'
        ELSE 'UTC'
    END,
    CASE 
        WHEN i % 3 = 1 THEN 'en-US'
        WHEN i % 3 = 2 THEN 'en-GB'
        ELSE 'en-US'
    END,
    (i % 50) + 5, -- Login count between 5-54
    NOW() - INTERVAL '60 days' + INTERVAL '1 day' * (i % 60),
    NOW() - INTERVAL '1 hour' + INTERVAL '1 minute' * (i % 60),
    NOW() - INTERVAL '1 day' + INTERVAL '1 hour' * (i % 24),
    NOW() - INTERVAL '30 minutes' + INTERVAL '1 minute' * (i % 30)
FROM generate_series(1, 100) AS i;

-- Generate Test Projects (50 projects distributed across organizations)
WITH org_ids AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as org_num
    FROM public.organizations 
    WHERE name LIKE 'LoadTest_%'
)
INSERT INTO public.projects (
    id, name, description, slug, organization_id, client_name, project_type, priority,
    start_date, end_date, deadline, budget, status, created_at, updated_at, created_by
)
SELECT 
    gen_random_uuid(),
    'LoadTest Project ' || i,
    'Load testing project ' || i || ' for performance benchmarking and scalability validation',
    'loadtest-project-' || i,
    (SELECT id FROM org_ids WHERE org_num = ((i - 1) % 10) + 1),
    'Client ' || ((i - 1) % 15) + 1,
    CASE 
        WHEN i % 5 = 1 THEN 'translation'
        WHEN i % 5 = 2 THEN 'review'
        WHEN i % 5 = 3 THEN 'post_editing'
        WHEN i % 5 = 4 THEN 'terminology'
        ELSE 'style_guide'
    END,
    CASE 
        WHEN i % 4 = 1 THEN 'urgent'
        WHEN i % 4 = 2 THEN 'high'
        WHEN i % 4 = 3 THEN 'medium'
        ELSE 'low'
    END,
    NOW() - INTERVAL '30 days' + INTERVAL '1 day' * (i % 30),
    NOW() + INTERVAL '30 days' + INTERVAL '1 day' * (i % 30),
    NOW() + INTERVAL '60 days' + INTERVAL '1 day' * (i % 60),
    10000 + (i * 1000),
    CASE 
        WHEN i % 5 = 1 THEN 'completed'
        WHEN i % 5 = 2 THEN 'in_progress'
        WHEN i % 5 = 3 THEN 'planning'
        WHEN i % 5 = 4 THEN 'on_hold'
        ELSE 'active'
    END,
    NOW() - INTERVAL '45 days' + INTERVAL '1 day' * (i % 45),
    NOW() - INTERVAL '1 day' + INTERVAL '1 hour' * (i % 24),
    (SELECT id FROM public.profiles WHERE email LIKE 'loadtest_%' AND role IN ('admin', 'manager') LIMIT 1 OFFSET (i % 10))
FROM generate_series(1, 50) AS i;

-- Generate Project Members
WITH project_ids AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as proj_num
    FROM public.projects 
    WHERE slug LIKE 'loadtest-project-%'
),
user_ids AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as user_num
    FROM public.profiles 
    WHERE email LIKE 'loadtest_%'
)
INSERT INTO public.project_members (project_id, user_id, role, status, joined_at)
SELECT 
    p.id,
    u.id,
    CASE 
        WHEN (u.user_num % 10) = 1 THEN 'project_manager'
        WHEN (u.user_num % 5) = 1 THEN 'lead_qa'
        ELSE 'qa_analyst'
    END,
    'active',
    NOW() - INTERVAL '30 days' + INTERVAL '1 day' * ((u.user_num + p.proj_num) % 30)
FROM project_ids p
CROSS JOIN user_ids u
WHERE (u.user_num % 3) = (p.proj_num % 3) -- Distribute users across projects
LIMIT 200; -- Limit to prevent too many combinations

-- Generate QA Sessions (1000 sessions for comprehensive testing)
WITH project_users AS (
    SELECT DISTINCT pm.project_id, pm.user_id, p.organization_id
    FROM public.project_members pm
    JOIN public.projects p ON pm.project_id = p.id
    WHERE p.slug LIKE 'loadtest-project-%'
)
INSERT INTO public.qa_sessions (
    id, user_id, project_id, organization_id, session_name, file_name, file_size,
    analysis_status, analysis_results, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    pu.user_id,
    pu.project_id,
    pu.organization_id,
    'LoadTest Session ' || i,
    'loadtest_file_' || i || '.txt',
    (1000 + (i * 500)) * 1024, -- File sizes between 1MB - 500MB
    CASE 
        WHEN i % 5 = 1 THEN 'completed'
        WHEN i % 5 = 2 THEN 'processing'
        WHEN i % 5 = 3 THEN 'pending'
        WHEN i % 5 = 4 THEN 'failed'
        ELSE 'analyzing'
    END,
    '{"total_segments": ' || (50 + (i % 200)) || ', "processed": ' || (40 + (i % 150)) || ', "errors_found": ' || (i % 20) || '}',
    NOW() - INTERVAL '14 days' + INTERVAL '1 hour' * (i % 336), -- Spread over 14 days
    NOW() - INTERVAL '1 hour' + INTERVAL '1 minute' * (i % 60)
FROM generate_series(1, 1000) AS i
CROSS JOIN (
    SELECT user_id, project_id, organization_id, ROW_NUMBER() OVER () as rn
    FROM project_users
) pu
WHERE pu.rn = ((i - 1) % (SELECT COUNT(*) FROM project_users)) + 1;

-- Generate Assessment Results
WITH qa_session_ids AS (
    SELECT id, user_id, project_id, ROW_NUMBER() OVER (ORDER BY created_at) as session_num
    FROM public.qa_sessions 
    WHERE session_name LIKE 'LoadTest Session %'
)
INSERT INTO public.assessment_results (
    id, session_id, assessor_id, assessment_type, overall_score, mqm_score, 
    review_status, created_at, updated_at, submitted_at
)
SELECT 
    gen_random_uuid(),
    qs.id,
    qs.user_id,
    CASE 
        WHEN (qs.session_num % 3) = 1 THEN 'manual'
        WHEN (qs.session_num % 3) = 2 THEN 'automated'
        ELSE 'hybrid'
    END,
    75.0 + (RANDOM() * 25.0), -- Scores between 75-100
    85.0 + (RANDOM() * 15.0), -- MQM scores between 85-100
    CASE 
        WHEN qs.session_num % 4 = 1 THEN 'approved'
        WHEN qs.session_num % 4 = 2 THEN 'pending'
        WHEN qs.session_num % 4 = 3 THEN 'rejected'
        ELSE 'review'
    END,
    NOW() - INTERVAL '12 days' + INTERVAL '1 hour' * (qs.session_num % 288),
    NOW() - INTERVAL '30 minutes' + INTERVAL '1 minute' * (qs.session_num % 30),
    CASE 
        WHEN qs.session_num % 4 != 2 THEN NOW() - INTERVAL '6 days' + INTERVAL '1 hour' * (qs.session_num % 144)
        ELSE NULL
    END
FROM qa_session_ids qs
WHERE qs.session_num <= 800; -- Generate assessments for 800 sessions

-- Generate User Feedback (500 feedback entries)
WITH assessment_ids AS (
    SELECT id, assessor_id, session_id, ROW_NUMBER() OVER (ORDER BY created_at) as assessment_num
    FROM public.assessment_results
    WHERE id IN (SELECT id FROM public.assessment_results LIMIT 500)
)
INSERT INTO public.user_feedback (
    id, target_type, target_id, user_id, feedback_type, rating, title, description,
    session_id, assessment_result_id, status, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    CASE 
        WHEN (a.assessment_num % 3) = 1 THEN 'assessment'
        WHEN (a.assessment_num % 3) = 2 THEN 'session'
        ELSE 'system'
    END,
    CASE 
        WHEN (a.assessment_num % 3) = 1 THEN a.id::text
        WHEN (a.assessment_num % 3) = 2 THEN a.session_id::text
        ELSE 'system'
    END,
    a.assessor_id,
    CASE 
        WHEN a.assessment_num % 4 = 1 THEN 'bug_report'
        WHEN a.assessment_num % 4 = 2 THEN 'feature_request'
        WHEN a.assessment_num % 4 = 3 THEN 'suggestion'
        ELSE 'general'
    END,
    1 + (a.assessment_num % 5), -- Ratings 1-5
    'LoadTest Feedback ' || a.assessment_num,
    'This is load test feedback entry ' || a.assessment_num || ' for performance testing.',
    a.session_id,
    a.id,
    CASE 
        WHEN a.assessment_num % 5 = 1 THEN 'resolved'
        WHEN a.assessment_num % 5 = 2 THEN 'pending'
        WHEN a.assessment_num % 5 = 3 THEN 'in_progress'
        WHEN a.assessment_num % 5 = 4 THEN 'closed'
        ELSE 'open'
    END,
    NOW() - INTERVAL '10 days' + INTERVAL '1 hour' * (a.assessment_num % 240),
    NOW() - INTERVAL '15 minutes' + INTERVAL '1 minute' * (a.assessment_num % 15)
FROM assessment_ids a;

-- Generate Audit Logs (comprehensive logging for security testing)
WITH user_ids AS (
    SELECT id, email, role, ROW_NUMBER() OVER (ORDER BY created_at) as user_num
    FROM public.profiles 
    WHERE email LIKE 'loadtest_%'
)
INSERT INTO public.audit_logs (
    id, event_type, user_id, actor_email, permission_checked, current_user_role,
    resource_type, resource_id, request_path, request_method, result, reason,
    session_id, ip_address, user_agent, risk_level, created_at
)
SELECT 
    gen_random_uuid(),
    CASE 
        WHEN i % 10 = 1 THEN 'PERMISSION_CHECK'
        WHEN i % 10 = 2 THEN 'ROLE_ASSIGNED'
        WHEN i % 10 = 3 THEN 'ACCESS_GRANTED'
        WHEN i % 10 = 4 THEN 'ACCESS_DENIED'
        WHEN i % 10 = 5 THEN 'RESOURCE_ACCESS'
        WHEN i % 10 = 6 THEN 'ROLE_UPDATED'
        WHEN i % 10 = 7 THEN 'PERMISSION_GRANTED'
        WHEN i % 10 = 8 THEN 'PERMISSION_DENIED'
        WHEN i % 10 = 9 THEN 'SECURITY_VIOLATION'
        ELSE 'SUSPICIOUS_ACTIVITY'
    END,
    u.id,
    u.email,
    'view_project',
    u.role,
    'project',
    gen_random_uuid()::text,
    '/api/projects/' || ((i % 50) + 1),
    CASE 
        WHEN i % 4 = 1 THEN 'GET'
        WHEN i % 4 = 2 THEN 'POST'
        WHEN i % 4 = 3 THEN 'PUT'
        ELSE 'DELETE'
    END,
    CASE 
        WHEN i % 8 IN (1,2,3,4,5,6) THEN 'granted'
        WHEN i % 8 = 7 THEN 'denied'
        ELSE 'error'
    END,
    'Load test audit entry ' || i,
    'session_' || ((i % 100) + 1),
    ('192.168.' || ((i % 254) + 1) || '.' || ((i % 254) + 1))::inet,
    'LoadTest-Agent/1.0',
    CASE 
        WHEN i % 20 = 1 THEN 'high'
        WHEN i % 10 = 1 THEN 'medium'
        ELSE 'low'
    END,
    NOW() - INTERVAL '7 days' + INTERVAL '1 minute' * (i % 10080) -- Spread over 7 days
FROM generate_series(1, 2000) AS i
CROSS JOIN (
    SELECT id, email, role, ROW_NUMBER() OVER () as rn
    FROM user_ids
) u
WHERE u.rn = ((i - 1) % 100) + 1;

-- Create indexes for efficient load testing queries
CREATE INDEX IF NOT EXISTS idx_loadtest_profiles_email ON public.profiles(email) WHERE email LIKE 'loadtest_%';
CREATE INDEX IF NOT EXISTS idx_loadtest_projects_slug ON public.projects(slug) WHERE slug LIKE 'loadtest-project-%';
CREATE INDEX IF NOT EXISTS idx_loadtest_qa_sessions_name ON public.qa_sessions(session_name) WHERE session_name LIKE 'LoadTest Session %';
CREATE INDEX IF NOT EXISTS idx_loadtest_organizations_name ON public.organizations(name) WHERE name LIKE 'LoadTest_%';

-- Update statistics for query optimizer
ANALYZE public.profiles;
ANALYZE public.organizations;
ANALYZE public.projects;
ANALYZE public.qa_sessions;
ANALYZE public.assessment_results;
ANALYZE public.user_feedback;
ANALYZE public.audit_logs;

-- Display summary of generated test data
SELECT 
    'Test Data Generation Complete' as status,
    (SELECT COUNT(*) FROM public.organizations WHERE name LIKE 'LoadTest_%') as organizations,
    (SELECT COUNT(*) FROM public.profiles WHERE email LIKE 'loadtest_%') as users,
    (SELECT COUNT(*) FROM public.projects WHERE slug LIKE 'loadtest-project-%') as projects,
    (SELECT COUNT(*) FROM public.qa_sessions WHERE session_name LIKE 'LoadTest Session %') as qa_sessions,
    (SELECT COUNT(*) FROM public.assessment_results WHERE id IN (
        SELECT ar.id FROM public.assessment_results ar
        JOIN public.qa_sessions qs ON ar.session_id = qs.id
        WHERE qs.session_name LIKE 'LoadTest Session %'
    )) as assessments,
    (SELECT COUNT(*) FROM public.user_feedback WHERE title LIKE 'LoadTest Feedback %') as feedback_entries,
    (SELECT COUNT(*) FROM public.audit_logs WHERE actor_email LIKE 'loadtest_%') as audit_logs; 