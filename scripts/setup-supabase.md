# Supabase Setup Guide for AI-Powered Linguistic QA Platform

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Project Creation**: Create a new Supabase project
3. **Project Settings**: Note down your project details

## Step 1: Database Setup

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `src/lib/database.sql`
4. Execute the SQL to create tables, indexes, and security policies

## Step 2: Authentication Configuration

1. Go to **Authentication** > **Settings**
2. Configure the following settings:

### Email Settings
- **Enable email confirmations**: Recommended for production
- **Enable email change confirmations**: Yes
- **Enable secure email change**: Yes

### Password Settings
- **Minimum password length**: 8 characters
- **Require uppercase letters**: Recommended
- **Require lowercase letters**: Recommended
- **Require numbers**: Recommended
- **Require special characters**: Optional

### Session Settings
- **JWT expiry**: 3600 seconds (1 hour) - adjust as needed
- **Refresh token rotation**: Enabled

## Step 3: Storage Setup

1. Go to **Storage** section
2. Create the following buckets:

### qa-files Bucket
- **Name**: `qa-files`
- **Public**: No (files will be access-controlled)
- **File size limit**: 50MB
- **Allowed MIME types**: 
  - `application/xliff+xml`
  - `text/xml`
  - `application/xml`

### reports Bucket
- **Name**: `reports`
- **Public**: No
- **File size limit**: 10MB

### exports Bucket
- **Name**: `exports`
- **Public**: No
- **File size limit**: 25MB

## Step 4: Storage Policies

For each bucket, add the following RLS policies:

### qa-files Bucket Policies
```sql
-- Users can upload files to their own folder
CREATE POLICY "Users can upload qa-files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'qa-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view files in their own folder
CREATE POLICY "Users can view own qa-files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'qa-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete files in their own folder
CREATE POLICY "Users can delete own qa-files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'qa-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### reports and exports Bucket Policies
Apply similar policies for `reports` and `exports` buckets, replacing `qa-files` with the respective bucket name.

## Step 5: Environment Configuration

1. In your project dashboard, go to **Settings** > **API**
2. Copy the following values:

### Required Environment Variables
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Optional (for admin operations)
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Create a `.env.local` file in your project root with these values

## Step 6: Verify Setup

1. **Database**: Check that all tables are created in the **Table Editor**
2. **Authentication**: Try signing up a test user
3. **Storage**: Verify buckets are created with correct policies
4. **Frontend**: Test the connection by running your application

## Security Notes

- ✅ Row Level Security (RLS) is enabled on all tables
- ✅ Storage buckets have access control policies
- ✅ Authentication is properly configured
- ✅ Users can only access their own data
- ✅ File uploads are validated and size-limited

## Troubleshooting

### Common Issues

1. **Connection Errors**: Verify your SUPABASE_URL and keys
2. **Authentication Issues**: Check email confirmation settings
3. **Storage Upload Failures**: Verify bucket policies and file size limits
4. **Database Access Denied**: Ensure RLS policies are correctly applied

### Debug Steps

1. Check the browser console for errors
2. Verify environment variables are loaded
3. Test database connection in Supabase dashboard
4. Check storage bucket permissions

## Production Considerations

1. **Enable email confirmations**
2. **Configure custom SMTP settings**
3. **Set up database backups**
4. **Configure rate limiting**
5. **Enable audit logs**
6. **Set up monitoring and alerts**

## Support

- Supabase Documentation: [docs.supabase.com](https://docs.supabase.com)
- Community Discord: [discord.supabase.com](https://discord.supabase.com)
- GitHub Issues: [github.com/supabase/supabase](https://github.com/supabase/supabase) 