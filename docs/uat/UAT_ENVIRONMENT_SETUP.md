# UAT Environment Setup Guide
## AI-Powered Linguistic QA Platform

**Document Version:** 1.0  
**Date:** June 4, 2025  
**Purpose**: Technical setup guide for UAT environment preparation

---

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Prerequisites](#prerequisites)
3. [Test Data Preparation](#test-data-preparation)
4. [User Account Setup](#user-account-setup)
5. [Application Configuration](#application-configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

---

## 1. Environment Overview

### Purpose
The UAT environment is designed to replicate a production-like setup while providing safe testing capabilities for end users to validate the AI-Powered Linguistic QA Platform.

### Architecture
- **Frontend**: React application served on `http://localhost:5173`
- **Backend**: Express server with Supabase integration
- **Database**: Supabase PostgreSQL (test environment)
- **File Storage**: Local file system for test files
- **AI Services**: Test API endpoints with rate limiting
- **Payment Processing**: Stripe test mode

### Key Features
- Isolated test data environment
- Non-production API endpoints
- Test payment processing
- Comprehensive logging and monitoring
- Easy reset and cleanup capabilities

---

## 2. Prerequisites

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm/yarn**: Latest stable version
- **Git**: For version control
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Development Tools
- **Code Editor**: VS Code recommended
- **Terminal**: Command line access
- **Screen Recording**: For session capture (optional)

### Network Requirements
- Internet connection for API calls
- Port 5173 available for frontend
- Port 3000 available for backend API

### Accounts and Services
- **Supabase**: Test project configured
- **Stripe**: Test mode API keys
- **AI Services**: Test API keys with rate limits

---

## 3. Test Data Preparation

### Sample XLIFF Files

Create the sample files directory structure:

```bash
mkdir -p docs/uat/sample-files/batch-test-files
```

#### 3.1 Small Test File (sample-xliff-1.2.xlf)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="test-document.html" source-language="en" target-language="es" datatype="html">
    <header>
      <tool tool-id="test-tool" tool-name="UAT Test Tool" tool-version="1.0"/>
    </header>
    <body>
      <trans-unit id="1">
        <source>Welcome to our platform</source>
        <target>Bienvenido a nuestra plataforma</target>
      </trans-unit>
      <trans-unit id="2">
        <source>Please upload your files</source>
        <target>Por favor sube tus archivos</target>
      </trans-unit>
      <trans-unit id="3">
        <source>Quality assessment in progress</source>
        <target>Evaluación de calidad en progreso</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

#### 3.2 Medium Test File (sample-xliff-2.0.xlf)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="fr">
  <file id="test-file-2">
    <header>
      <tool tool-id="uat-tool" tool-name="UAT Test Suite" tool-version="2.0"/>
    </header>
    <unit id="u1">
      <segment id="s1">
        <source>AI-powered translation quality assessment</source>
        <target>Évaluation de la qualité de traduction alimentée par IA</target>
      </segment>
    </unit>
    <unit id="u2">
      <segment id="s2">
        <source>Upload multiple files for batch processing</source>
        <target>Télécharger plusieurs fichiers pour le traitement par lots</target>
      </segment>
    </unit>
    <unit id="u3">
      <segment id="s3">
        <source>Generate comprehensive quality reports</source>
        <target>Générer des rapports de qualité complets</target>
      </segment>
    </unit>
    <unit id="u4">
      <segment id="s4">
        <source>Export results in multiple formats</source>
        <target>Exporter les résultats en plusieurs formats</target>
      </segment>
    </unit>
  </file>
</xliff>
```

#### 3.3 Batch Test Files
Create multiple smaller files for batch testing:

**batch-file-1.xlf**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="batch-test-1.html" source-language="en" target-language="de" datatype="html">
    <body>
      <trans-unit id="1">
        <source>Batch processing test file 1</source>
        <target>Batch-Verarbeitung Testdatei 1</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

**batch-file-2.xlf**, **batch-file-3.xlf**: Similar structure with different content.

### Test Scripts

#### 3.4 Data Generation Script
Create `scripts/generate-test-data.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Generate sample XLIFF files with various content
function generateTestFiles() {
  const testDataDir = path.join(__dirname, '..', 'docs', 'uat', 'sample-files');
  
  // Ensure directories exist
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  const batchDir = path.join(testDataDir, 'batch-test-files');
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }
  
  // Generate batch test files
  for (let i = 1; i <= 5; i++) {
    const content = generateXLIFFContent(i);
    fs.writeFileSync(path.join(batchDir, `batch-file-${i}.xlf`), content);
  }
  
  console.log('Test files generated successfully!');
}

function generateXLIFFContent(fileNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="batch-test-${fileNumber}.html" source-language="en" target-language="es" datatype="html">
    <header>
      <tool tool-id="test-tool" tool-name="UAT Batch Test" tool-version="1.0"/>
    </header>
    <body>
      <trans-unit id="1">
        <source>This is batch test file number ${fileNumber}</source>
        <target>Este es el archivo de prueba por lotes número ${fileNumber}</target>
      </trans-unit>
      <trans-unit id="2">
        <source>Testing batch processing capabilities</source>
        <target>Probando capacidades de procesamiento por lotes</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
}

// Run the generator
generateTestFiles();
```

Run with: `node scripts/generate-test-data.js`

---

## 4. User Account Setup

### Test User Accounts

#### 4.1 Database Seed Script
Create `scripts/seed-test-users.sql`:

```sql
-- UAT Test Users Setup
-- Note: Run this in Supabase SQL editor for test environment

-- Create test users with different roles
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'maria@testuser.com', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'david@testuser.com', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'sarah@testuser.com', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'alex@testuser.com', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), 'authenticated');

-- Create user profiles
INSERT INTO public.profiles (id, email, full_name, company, role, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'maria@testuser.com', 'Maria Santos', 'Global Translation Services', 'Translation Professional', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'david@testuser.com', 'David Johnson', 'Quality Assurance Corp', 'QA Manager', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'sarah@testuser.com', 'Sarah Williams', 'Project Management Ltd', 'Project Manager', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'alex@testuser.com', 'Alex Thompson', 'System Administration Inc', 'Administrator', now(), now());

-- Set user permissions
INSERT INTO public.user_permissions (user_id, permission_level, can_upload, can_admin, can_export, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'user', true, false, true, now()),
  ('22222222-2222-2222-2222-222222222222', 'manager', true, false, true, now()),
  ('33333333-3333-3333-3333-333333333333', 'manager', true, false, true, now()),
  ('44444444-4444-4444-4444-444444444444', 'admin', true, true, true, now());
```

#### 4.2 User Setup Validation Script
Create `scripts/validate-test-users.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

// Validate test user setup
async function validateTestUsers() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  const testUsers = [
    'maria@testuser.com',
    'david@testuser.com', 
    'sarah@testuser.com',
    'alex@testuser.com'
  ];
  
  console.log('Validating test user setup...');
  
  for (const email of testUsers) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();
        
      if (error) {
        console.error(`❌ User ${email}: ${error.message}`);
      } else {
        console.log(`✅ User ${email}: ${data.full_name} (${data.role})`);
      }
    } catch (err) {
      console.error(`❌ User ${email}: ${err.message}`);
    }
  }
}

validateTestUsers();
```

---

## 5. Application Configuration

### 5.1 Environment Variables
Create `.env.uat` file:

```bash
# UAT Environment Configuration
NODE_ENV=test
VITE_APP_ENV=uat

# Application Settings
VITE_APP_NAME="AI QA Platform (UAT)"
VITE_APP_VERSION=1.0.0-uat
VITE_APP_DEBUG=true

# Supabase Configuration (Test Environment)
VITE_SUPABASE_URL=your_test_supabase_url
VITE_SUPABASE_ANON_KEY=your_test_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key

# Stripe Configuration (Test Mode)
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_test_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AI Services (Test Mode)
OPENAI_API_KEY=your_test_openai_key
AI_SERVICE_BASE_URL=https://api.test-ai-service.com
AI_RATE_LIMIT_PER_MINUTE=10

# File Upload Settings
MAX_FILE_SIZE_MB=50
MAX_BATCH_FILES=10
ALLOWED_FILE_TYPES=xlf,xliff,mxliff

# Monitoring and Logging
LOG_LEVEL=debug
ENABLE_MONITORING=true
SENTRY_DSN=your_test_sentry_dsn

# UAT Specific Settings
UAT_MODE=true
ENABLE_DEMO_DATA=true
RESET_DATA_ON_RESTART=false
```

### 5.2 UAT Configuration Script
Create `scripts/setup-uat-config.js`:

```javascript
const fs = require('fs');
const path = require('path');

function setupUATConfig() {
  console.log('🚀 Setting up UAT environment configuration...');
  
  // Copy UAT environment file
  const uatEnvFile = path.join(__dirname, '..', '.env.uat');
  const envFile = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(uatEnvFile)) {
    fs.copyFileSync(uatEnvFile, envFile);
    console.log('✅ UAT environment variables configured');
  } else {
    console.log('⚠️ .env.uat file not found, using default .env');
  }
  
  // Create UAT-specific configuration
  const uatConfig = {
    environment: 'uat',
    features: {
      enableDemoData: true,
      enableTestMode: true,
      enableDebugMode: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxBatchFiles: 10
    },
    monitoring: {
      enableLogging: true,
      logLevel: 'debug',
      enableMetrics: true
    },
    testData: {
      autoGenerate: true,
      includeErrorScenarios: true
    }
  };
  
  const configPath = path.join(__dirname, '..', 'src', 'config', 'uat.json');
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(uatConfig, null, 2));
  console.log('✅ UAT configuration file created');
  
  console.log('🎉 UAT environment setup complete!');
}

setupUATConfig();
```

### 5.3 Database Setup for UAT
Create `scripts/setup-uat-database.sql`:

```sql
-- UAT Database Setup
-- Create UAT-specific tables and data

-- Enable RLS for UAT
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reports ENABLE ROW LEVEL SECURITY;

-- Create UAT data tracking table
CREATE TABLE IF NOT EXISTS public.uat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  scenario_name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  feedback JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create UAT feedback table
CREATE TABLE IF NOT EXISTS public.uat_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.uat_sessions(id),
  scenario_name TEXT NOT NULL,
  user_persona TEXT NOT NULL,
  task_completion_rate NUMERIC(3,2),
  usability_score NUMERIC(2,1),
  feedback_text TEXT,
  suggestions TEXT,
  issues_encountered TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample project data for testing
INSERT INTO public.projects (id, user_id, name, description, status, created_at) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Sample Project 1', 'Testing file upload and processing', 'completed', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Batch Test Project', 'Testing batch processing functionality', 'in_progress', NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Quality Analysis Project', 'Testing analytics and reporting', 'completed', NOW() - INTERVAL '3 days');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_uat_sessions_user_id ON public.uat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_uat_sessions_scenario ON public.uat_sessions(scenario_name);
CREATE INDEX IF NOT EXISTS idx_uat_feedback_session ON public.uat_feedback(session_id);
```

---

## 6. Monitoring Setup

### 6.1 UAT Monitoring Configuration
Create `src/utils/uat-monitoring.ts`:

```typescript
interface UATSession {
  sessionId: string;
  userId: string;
  scenarioName: string;
  startTime: Date;
  actions: UATAction[];
}

interface UATAction {
  timestamp: Date;
  action: string;
  element: string;
  success: boolean;
  duration?: number;
  errorMessage?: string;
}

class UATMonitor {
  private session: UATSession | null = null;
  private isRecording = false;

  startSession(scenarioName: string, userId: string): void {
    this.session = {
      sessionId: this.generateSessionId(),
      userId,
      scenarioName,
      startTime: new Date(),
      actions: []
    };
    this.isRecording = true;
    console.log(`🎬 UAT Session started: ${scenarioName}`);
  }

  recordAction(action: string, element: string, success: boolean, duration?: number): void {
    if (!this.isRecording || !this.session) return;

    const uatAction: UATAction = {
      timestamp: new Date(),
      action,
      element,
      success,
      duration
    };

    this.session.actions.push(uatAction);
    console.log(`📝 UAT Action recorded: ${action} on ${element} - ${success ? '✅' : '❌'}`);
  }

  recordError(error: string): void {
    if (!this.isRecording || !this.session) return;

    const lastAction = this.session.actions[this.session.actions.length - 1];
    if (lastAction) {
      lastAction.errorMessage = error;
      lastAction.success = false;
    }
  }

  endSession(): UATSession | null {
    if (!this.session) return null;

    this.isRecording = false;
    const completedSession = { ...this.session };
    
    // Save session data
    this.saveSessionData(completedSession);
    
    console.log(`🏁 UAT Session ended: ${completedSession.scenarioName}`);
    this.session = null;
    
    return completedSession;
  }

  private generateSessionId(): string {
    return `uat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveSessionData(session: UATSession): Promise<void> {
    try {
      // Save to local storage for now, could be sent to backend
      const sessionData = {
        ...session,
        endTime: new Date(),
        duration: new Date().getTime() - session.startTime.getTime()
      };
      
      localStorage.setItem(`uat_session_${session.sessionId}`, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save UAT session data:', error);
    }
  }
}

export const uatMonitor = new UATMonitor();
```

### 6.2 UAT Dashboard Component
Create `src/components/uat/UATDashboard.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UATMetrics {
  totalSessions: number;
  completedScenarios: number;
  averageCompletionTime: number;
  successRate: number;
  commonIssues: string[];
}

export const UATDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<UATMetrics | null>(null);

  useEffect(() => {
    loadUATMetrics();
  }, []);

  const loadUATMetrics = () => {
    // Load UAT metrics from localStorage or API
    const sessions = getAllUATSessions();
    
    const metrics: UATMetrics = {
      totalSessions: sessions.length,
      completedScenarios: sessions.filter(s => s.endTime).length,
      averageCompletionTime: calculateAverageTime(sessions),
      successRate: calculateSuccessRate(sessions),
      commonIssues: extractCommonIssues(sessions)
    };
    
    setMetrics(metrics);
  };

  const getAllUATSessions = () => {
    const sessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('uat_session_')) {
        const session = JSON.parse(localStorage.getItem(key) || '{}');
        sessions.push(session);
      }
    }
    return sessions;
  };

  const calculateAverageTime = (sessions: any[]) => {
    const completedSessions = sessions.filter(s => s.duration);
    if (completedSessions.length === 0) return 0;
    
    const totalTime = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    return Math.round(totalTime / completedSessions.length / 1000 / 60); // minutes
  };

  const calculateSuccessRate = (sessions: any[]) => {
    if (sessions.length === 0) return 0;
    
    const successfulSessions = sessions.filter(session => {
      const actions = session.actions || [];
      const failedActions = actions.filter((a: any) => !a.success);
      return failedActions.length / actions.length < 0.2; // Less than 20% failed actions
    });
    
    return Math.round((successfulSessions.length / sessions.length) * 100);
  };

  const extractCommonIssues = (sessions: any[]) => {
    const issues: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      session.actions?.forEach((action: any) => {
        if (!action.success && action.errorMessage) {
          issues[action.errorMessage] = (issues[action.errorMessage] || 0) + 1;
        }
      });
    });
    
    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);
  };

  if (!metrics) {
    return <div>Loading UAT metrics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">UAT Monitoring Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSessions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Completed Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completedScenarios}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Avg. Completion Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageCompletionTime} min</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Common Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {metrics.commonIssues.map((issue, index) => (
              <li key={index} className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 7. Backup and Recovery

### 7.1 Environment Reset Script
Create `scripts/reset-uat-environment.js`:

```javascript
const fs = require('fs');
const path = require('path');

async function resetUATEnvironment() {
  console.log('🔄 Resetting UAT environment...');
  
  try {
    // Clear uploaded files
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Cleared uploaded files');
    }
    
    // Clear processing queue
    const queueDir = path.join(__dirname, '..', 'queue');
    if (fs.existsSync(queueDir)) {
      fs.rmSync(queueDir, { recursive: true, force: true });
      fs.mkdirSync(queueDir, { recursive: true });
      console.log('✅ Cleared processing queue');
    }
    
    // Clear logs
    const logsDir = path.join(__dirname, '..', 'logs');
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true });
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('✅ Cleared log files');
    }
    
    // Reset local storage instructions
    console.log('📋 Manual steps required:');
    console.log('  1. Clear browser localStorage');
    console.log('  2. Clear browser sessionStorage');
    console.log('  3. Clear browser cookies for localhost:5173');
    console.log('  4. Run: npm run db:reset (if available)');
    
    console.log('🎉 UAT environment reset complete!');
    
  } catch (error) {
    console.error('❌ Error resetting UAT environment:', error);
  }
}

resetUATEnvironment();
```

### 7.2 Data Backup Script
Create `scripts/backup-uat-data.js`:

```javascript
const fs = require('fs');
const path = require('path');

function backupUATData() {
  console.log('💾 Creating UAT data backup...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `uat-backup-${timestamp}`);
  
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup configuration
    const configFiles = ['.env', 'src/config/uat.json'];
    configFiles.forEach(file => {
      const source = path.join(__dirname, '..', file);
      if (fs.existsSync(source)) {
        const dest = path.join(backupDir, path.basename(file));
        fs.copyFileSync(source, dest);
        console.log(`✅ Backed up ${file}`);
      }
    });
    
    // Backup test data
    const testDataDir = path.join(__dirname, '..', 'docs', 'uat', 'sample-files');
    if (fs.existsSync(testDataDir)) {
      const dest = path.join(backupDir, 'sample-files');
      fs.cpSync(testDataDir, dest, { recursive: true });
      console.log('✅ Backed up test data');
    }
    
    // Create backup manifest
    const manifest = {
      timestamp,
      backupType: 'uat-data',
      files: fs.readdirSync(backupDir),
      environment: process.env.NODE_ENV || 'development'
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log(`🎉 UAT backup created: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

backupUATData();
```

---

## 8. Troubleshooting

### Common Issues and Solutions

#### 8.1 Application Won't Start
**Symptoms**: Server fails to start, port conflicts, missing dependencies

**Solutions**:
```bash
# Check Node.js version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check port availability
lsof -i :5173  # Kill processes if needed
lsof -i :3000

# Start with verbose logging
npm run dev -- --verbose
```

#### 8.2 Database Connection Issues
**Symptoms**: Supabase connection errors, authentication failures

**Solutions**:
```bash
# Verify environment variables
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Test database connection
npm run db:test  # If script exists

# Check Supabase project status
# Visit Supabase dashboard to verify project is active
```

#### 8.3 File Upload Problems
**Symptoms**: Upload failures, processing errors, timeout issues

**Solutions**:
```bash
# Check file permissions
ls -la docs/uat/sample-files/

# Verify file sizes
du -h docs/uat/sample-files/*

# Test with smaller files first
cp docs/uat/sample-files/sample-xliff-1.2.xlf test-small.xlf
```

#### 8.4 Test User Login Issues
**Symptoms**: Cannot login with test credentials, authentication errors

**Solutions**:
```sql
-- Verify test users exist (run in Supabase SQL editor)
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email LIKE '%testuser.com';

-- Reset test user passwords if needed
UPDATE auth.users 
SET encrypted_password = crypt('TestPass123!', gen_salt('bf'))
WHERE email = 'maria@testuser.com';
```

#### 8.5 Performance Issues
**Symptoms**: Slow page loads, processing delays, browser freezing

**Solutions**:
```bash
# Check system resources
top
df -h

# Clear browser cache completely
# Open DevTools > Application > Storage > Clear storage

# Disable browser extensions during testing
# Use incognito/private mode
```

### Debugging Tools

#### 8.6 Enable Debug Mode
Add to `.env`:
```bash
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

#### 8.7 Browser Developer Tools
- **Console**: Monitor JavaScript errors and logs
- **Network**: Check API calls and response times
- **Application**: Inspect localStorage and sessionStorage
- **Performance**: Profile page loading and rendering

#### 8.8 UAT-Specific Logging
The application includes UAT-specific logging that can be enabled:

```typescript
// In browser console
localStorage.setItem('uat_debug', 'true');
localStorage.setItem('uat_log_level', 'debug');

// Reload page to activate debug mode
location.reload();
```

---

## Setup Checklist

### Pre-UAT Environment Checklist

- [ ] **System Requirements**
  - [ ] Node.js 18+ installed
  - [ ] Modern browser available
  - [ ] Internet connection stable
  - [ ] Required ports (5173, 3000) available

- [ ] **Application Setup**
  - [ ] Repository cloned and dependencies installed
  - [ ] Environment variables configured (.env.uat)
  - [ ] Database connection tested
  - [ ] Application starts without errors

- [ ] **Test Data Preparation**
  - [ ] Sample XLIFF files generated
  - [ ] Batch test files created
  - [ ] Test user accounts configured
  - [ ] Database seeded with sample data

- [ ] **Monitoring Configuration**
  - [ ] UAT monitoring enabled
  - [ ] Debug logging configured
  - [ ] Session recording functional
  - [ ] Error tracking active

- [ ] **Documentation Ready**
  - [ ] UAT plan accessible to testers
  - [ ] Test scenarios documented
  - [ ] Feedback forms prepared
  - [ ] Troubleshooting guide available

### Post-UAT Cleanup Checklist

- [ ] **Data Collection**
  - [ ] UAT session data backed up
  - [ ] Feedback forms collected
  - [ ] Issues documented
  - [ ] Metrics exported

- [ ] **Environment Cleanup**
  - [ ] Test files removed
  - [ ] Logs archived
  - [ ] Database cleaned
  - [ ] Environment reset for next cycle

---

**Document Prepared By**: Technical Team  
**Last Updated**: June 4, 2025  
**Next Review**: June 11, 2025 