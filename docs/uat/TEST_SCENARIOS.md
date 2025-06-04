# UAT Test Scenarios - Detailed Instructions
## AI-Powered Linguistic QA Platform

**Document Version:** 1.0  
**Date:** June 4, 2025  
**Purpose**: Detailed test scenario instructions for UAT participants

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Scenario 1: New User Onboarding](#scenario-1-new-user-onboarding)
3. [Scenario 2: Batch File Processing](#scenario-2-batch-file-processing)
4. [Scenario 3: Quality Report Analysis](#scenario-3-quality-report-analysis)
5. [Scenario 4: Dashboard Analytics](#scenario-4-dashboard-analytics)
6. [Scenario 5: User Administration](#scenario-5-user-administration)
7. [Scenario 6: Error Handling](#scenario-6-error-handling)
8. [Scenario 7: Mobile Responsiveness](#scenario-7-mobile-responsiveness)
9. [Feedback Forms](#feedback-forms)

---

## Getting Started

### Pre-Test Setup
1. **Access URL**: Navigate to `http://localhost:5173`
2. **Browser**: Use Chrome, Firefox, Safari, or Edge (latest version)
3. **Test Duration**: Allow 30-45 minutes per scenario
4. **Recording**: Enable screen recording if possible for later analysis

### Test Credentials
- **Translation Professional**: `maria@testuser.com` / `TestPass123!`
- **QA Manager**: `david@testuser.com` / `TestPass123!`
- **Project Manager**: `sarah@testuser.com` / `TestPass123!`
- **Administrator**: `alex@testuser.com` / `TestPass123!`

### Sample Test Files
Test files are available in the project under `docs/uat/sample-files/`:
- `sample-xliff-1.2.xlf` (Small file, ~100KB)
- `sample-xliff-2.0.xlf` (Medium file, ~500KB)
- `sample-mxliff.mxliff` (Large file, ~2MB)
- `batch-test-files/` (Multiple files for batch testing)

---

## Scenario 1: New User Onboarding
**Persona**: Translation Professional (Maria)  
**Objective**: Complete account setup and process first file  
**Duration**: 30-40 minutes

### Step-by-Step Instructions

#### Phase 1: Account Registration (10 minutes)

1. **Navigate to Registration**
   - Open the application URL
   - Click "Sign Up" or "Register" button
   - **Expected**: Registration form displays

2. **Complete Registration Form**
   - Email: Use your own email for testing
   - Password: Create secure password (min 8 characters)
   - Confirm password
   - Accept terms and conditions
   - Click "Create Account"
   - **Expected**: Success message and email verification prompt

3. **Email Verification**
   - Check your email inbox
   - Click verification link
   - **Expected**: Redirected to login page with confirmation message

#### Phase 2: First Login and Profile Setup (10 minutes)

4. **Login Process**
   - Enter email and password
   - Click "Login"
   - **Expected**: Successful login to dashboard

5. **Profile Completion**
   - Navigate to Profile/Settings
   - Complete profile information:
     - Full name: "Maria Santos"
     - Company: "Global Translation Services"
     - Role: "Senior Translator"
     - Preferred language pairs
   - Save profile
   - **Expected**: Profile saved successfully

6. **Dashboard Orientation**
   - Explore main navigation menu
   - Review dashboard overview
   - Check available features and options
   - **Expected**: Intuitive navigation, clear layout

#### Phase 3: First File Upload (15 minutes)

7. **Navigate to Upload**
   - Find and click "Upload" or "New Project" button
   - **Expected**: Upload interface appears

8. **File Upload Process**
   - Use drag-and-drop with `sample-xliff-1.2.xlf`
   - OR use browse button to select file
   - Add project name: "Maria Test Project 1"
   - Add description: "Testing file upload functionality"
   - Click "Start Processing" or "Upload"
   - **Expected**: Upload progress indicator appears

9. **Monitor Processing**
   - Watch upload progress
   - Note processing status updates
   - **Expected**: Clear progress indicators, status messages

10. **Review Results**
    - Wait for processing completion
    - Click to view quality assessment
    - Explore the generated report
    - **Expected**: Comprehensive quality report with MQM scores

#### Phase 4: Dashboard Exploration (5 minutes)

11. **Navigate Dashboard Features**
    - Return to main dashboard
    - Review project history
    - Check quality trends (if available)
    - Explore analytics section
    - **Expected**: Logical organization, easy navigation

### Success Criteria
- ✅ Successfully created account and verified email
- ✅ Completed profile setup without errors
- ✅ Uploaded file processed successfully
- ✅ Quality report generated and accessible
- ✅ Dashboard navigation is intuitive

### Feedback Points
- Rate ease of registration process (1-5)
- Comment on profile setup clarity
- Evaluate file upload user experience
- Assess quality report usefulness
- Note any confusing or unclear elements

---

## Scenario 2: Batch File Processing
**Persona**: QA Manager (David)  
**Objective**: Process multiple files efficiently  
**Duration**: 35-45 minutes

### Step-by-Step Instructions

#### Phase 1: Login and Setup (5 minutes)

1. **Login as QA Manager**
   - Use credentials: `david@testuser.com` / `TestPass123!`
   - Navigate to main dashboard
   - **Expected**: QA Manager dashboard with batch processing options

2. **Batch Processing Access**
   - Look for "Batch Upload" or "Multiple Files" option
   - Click to access batch processing interface
   - **Expected**: Batch upload interface with multi-file support

#### Phase 2: Multi-File Upload (15 minutes)

3. **Select Multiple Files**
   - Navigate to `docs/uat/sample-files/batch-test-files/`
   - Select 3-5 files of different formats:
     - At least one XLIFF 1.2 file
     - At least one XLIFF 2.0 file
     - At least one MXLIFF file
   - **Expected**: All files selected and displayed

4. **Configure Batch Settings**
   - Set batch name: "David QA Batch Test"
   - Configure processing options (if available)
   - Set priority level (if available)
   - Add batch description
   - **Expected**: Configuration options are clear and functional

5. **Start Batch Processing**
   - Click "Start Batch Processing"
   - Monitor initial upload progress
   - **Expected**: All files begin uploading simultaneously

#### Phase 3: Progress Monitoring (15 minutes)

6. **Track Individual File Progress**
   - Monitor each file's upload/processing status
   - Note any files that complete faster/slower
   - Check for any error messages
   - **Expected**: Individual progress tracking for each file

7. **Batch Status Overview**
   - Review overall batch completion percentage
   - Check estimated time remaining
   - Monitor system resource usage indicators (if available)
   - **Expected**: Clear batch-level status information

8. **Handle Processing Issues**
   - If any files encounter errors, note the error messages
   - Try canceling and restarting individual files (if possible)
   - **Expected**: Clear error handling and recovery options

#### Phase 4: Results Analysis (10 minutes)

9. **Batch Results Summary**
   - Access completed batch results
   - Review summary statistics across all files
   - Compare quality scores between files
   - **Expected**: Comprehensive batch summary report

10. **Individual File Analysis**
    - Click into individual file reports
    - Compare error patterns between files
    - Note differences in MQM scoring
    - **Expected**: Detailed individual reports accessible from batch view

11. **Export Batch Report**
    - Look for export options (PDF, CSV, Excel)
    - Download batch summary report
    - Verify report contains all expected data
    - **Expected**: Successful export with comprehensive data

### Success Criteria
- ✅ Successfully uploaded multiple files simultaneously
- ✅ Batch processing completed without major issues
- ✅ Individual and batch progress tracking worked properly
- ✅ Results summary provided valuable insights
- ✅ Export functionality worked correctly

### Feedback Points
- Rate batch upload user experience (1-5)
- Comment on progress tracking clarity
- Evaluate batch results presentation
- Assess export functionality usefulness
- Note any performance issues or delays

---

## Scenario 3: Quality Report Analysis
**Persona**: Translation Professional (Maria)  
**Objective**: Analyze detailed quality assessment  
**Duration**: 25-35 minutes

### Step-by-Step Instructions

#### Phase 1: Report Access (5 minutes)

1. **Login and Navigate**
   - Login as Maria (`maria@testuser.com`)
   - Navigate to Reports or Project History
   - Select a completed quality assessment
   - **Expected**: Access to detailed quality report

2. **Report Overview**
   - Review overall quality score
   - Check MQM scoring summary
   - Note total errors found
   - **Expected**: Clear, high-level quality overview

#### Phase 2: MQM Analysis (15 minutes)

3. **MQM Scoring Breakdown**
   - Explore MQM dimensions (Accuracy, Fluency, etc.)
   - Click into specific categories
   - Review error distribution
   - **Expected**: Detailed MQM categorization with explanations

4. **Error Examination**
   - Click on individual errors
   - Review error context in source/target text
   - Read AI explanations for each error
   - Check severity classifications
   - **Expected**: Clear error details with context and explanations

5. **Severity Impact Analysis**
   - Review critical vs. major vs. minor errors
   - Understand impact on overall score
   - Check penalty calculations
   - **Expected**: Clear severity impact on quality scoring

#### Phase 3: Actionable Insights (10 minutes)

6. **AI Recommendations**
   - Review AI-generated improvement suggestions
   - Check recommendations by error type
   - Evaluate suggestion relevance
   - **Expected**: Useful, actionable improvement recommendations

7. **Trend Analysis** (if multiple reports available)
   - Compare with previous assessments
   - Check quality improvement/decline trends
   - Review recurring error patterns
   - **Expected**: Meaningful trend insights

8. **Report Sharing and Export**
   - Use export options (PDF, Excel)
   - Test email sharing functionality (if available)
   - Download detailed report
   - **Expected**: Professional export formats suitable for sharing

#### Phase 4: Report Usefulness (5 minutes)

9. **Navigation and Usability**
   - Test report navigation features
   - Use search/filter functions
   - Check report printing format
   - **Expected**: Easy navigation and professional presentation

10. **Action Item Creation**
    - Create notes or action items (if feature exists)
    - Mark errors as reviewed
    - Add personal comments
    - **Expected**: Workflow support features function properly

### Success Criteria
- ✅ Quality report data is accurate and comprehensive
- ✅ MQM categorization is clear and useful
- ✅ Error details provide sufficient context
- ✅ AI recommendations are relevant and actionable
- ✅ Export functionality produces professional reports

### Feedback Points
- Rate report clarity and usefulness (1-5)
- Comment on MQM categorization accuracy
- Evaluate AI recommendation relevance
- Assess export quality and format
- Note any missing information or features

---

## Scenario 4: Dashboard Analytics
**Persona**: Project Manager (Sarah)  
**Objective**: Monitor quality trends and project status  
**Duration**: 30-40 minutes

### Step-by-Step Instructions

#### Phase 1: Dashboard Access (5 minutes)

1. **Login as Project Manager**
   - Use credentials: `sarah@testuser.com` / `TestPass123!`
   - Navigate to main dashboard
   - **Expected**: Project manager view with analytics focus

2. **Analytics Overview**
   - Review dashboard widgets and metrics
   - Check available analytics sections
   - Note key performance indicators
   - **Expected**: Comprehensive project overview

#### Phase 2: Quality Trend Analysis (15 minutes)

3. **Historical Data Review**
   - Access quality trends section
   - Select different time ranges (7 days, 30 days, 90 days)
   - Review quality score trends
   - **Expected**: Clear historical quality data visualization

4. **Enhanced Reporting Features**
   - Explore EnhancedTaxonomyChart
   - Use SeverityImpactChart for impact analysis
   - Review TrendAnalysisChart features
   - Test drill-down capabilities
   - **Expected**: Advanced visualization tools work properly

5. **Filtering and Segmentation**
   - Filter by project type
   - Segment by language pairs
   - Filter by date ranges
   - Group by translator/QA reviewer
   - **Expected**: Flexible filtering produces relevant insights

#### Phase 3: Project Management Features (10 minutes)

6. **Project Status Monitoring**
   - Review active projects status
   - Check processing queues
   - Monitor resource utilization
   - **Expected**: Real-time project status visibility

7. **Performance Metrics**
   - Review team performance statistics
   - Check processing times and efficiency
   - Analyze cost per project metrics
   - **Expected**: Meaningful performance indicators

8. **Alerts and Notifications**
   - Check for quality alerts
   - Review system notifications
   - Test alert configuration (if available)
   - **Expected**: Useful alerting system

#### Phase 4: Reporting and Export (10 minutes)

9. **Custom Report Generation**
   - Create custom date range report
   - Select specific metrics to include
   - Generate executive summary
   - **Expected**: Flexible report generation options

10. **Export Analytics**
    - Export analytics data to Excel/CSV
    - Generate PDF executive summary
    - Test email report functionality
    - **Expected**: Professional export formats

11. **Dashboard Customization**
    - Rearrange dashboard widgets (if possible)
    - Customize metric displays
    - Set up personal preferences
    - **Expected**: Customizable dashboard experience

### Success Criteria
- ✅ Analytics provide meaningful project insights
- ✅ Trend analysis tools are functional and useful
- ✅ Filtering and segmentation work properly
- ✅ Export functionality produces professional reports
- ✅ Dashboard customization meets user needs

### Feedback Points
- Rate analytics usefulness for project management (1-5)
- Comment on visualization clarity and effectiveness
- Evaluate filtering and customization options
- Assess export quality and format
- Note any missing metrics or features

---

## Scenario 5: User Administration
**Persona**: Administrator (Alex)  
**Objective**: Manage user accounts and permissions  
**Duration**: 35-45 minutes

### Step-by-Step Instructions

#### Phase 1: Admin Panel Access (5 minutes)

1. **Login as Administrator**
   - Use credentials: `alex@testuser.com` / `TestPass123!`
   - Navigate to administration panel
   - **Expected**: Admin interface with user management options

2. **Admin Dashboard Overview**
   - Review system status indicators
   - Check user activity summary
   - Note available administrative functions
   - **Expected**: Comprehensive admin dashboard

#### Phase 2: User Management (20 minutes)

3. **User Account Creation**
   - Click "Add New User" or similar
   - Create test user account:
     - Email: `testuser1@example.com`
     - Role: "Translation Professional"
     - Permissions: Standard user
   - Send invitation email
   - **Expected**: Successful user creation and invitation

4. **User Role Management**
   - Access existing user list
   - Modify user roles and permissions
   - Test role-based access controls
   - Assign users to specific projects/groups
   - **Expected**: Flexible role and permission management

5. **User Activity Monitoring**
   - Review user login activity
   - Check file processing history
   - Monitor user resource usage
   - Review audit logs
   - **Expected**: Comprehensive user activity tracking

6. **Bulk User Operations**
   - Test bulk user imports (if available)
   - Perform bulk role changes
   - Send bulk notifications
   - **Expected**: Efficient bulk management tools

#### Phase 3: System Configuration (10 minutes)

7. **System Settings**
   - Access global system settings
   - Configure upload limits and restrictions
   - Set processing timeouts
   - Manage subscription settings
   - **Expected**: Comprehensive system configuration options

8. **Security Administration**
   - Review security settings
   - Configure two-factor authentication policies
   - Set password requirements
   - Manage session timeouts
   - **Expected**: Robust security configuration tools

9. **API and Integration Management**
   - Review API usage statistics
   - Manage API keys and access
   - Configure external integrations
   - **Expected**: Comprehensive API management

#### Phase 4: Monitoring and Reporting (10 minutes)

10. **System Health Monitoring**
    - Check server resource usage
    - Review processing queue status
    - Monitor database performance
    - Check error logs
    - **Expected**: Real-time system health visibility

11. **Administrative Reporting**
    - Generate user activity reports
    - Create system usage reports
    - Export administrative data
    - **Expected**: Comprehensive administrative reporting

12. **Backup and Maintenance**
    - Review backup status
    - Check maintenance schedules
    - Test system alerts
    - **Expected**: Proper backup and maintenance tools

### Success Criteria
- ✅ User management functions work correctly
- ✅ Role-based access controls are effective
- ✅ System configuration options are comprehensive
- ✅ Monitoring tools provide useful insights
- ✅ Administrative reporting meets requirements

### Feedback Points
- Rate admin interface usability (1-5)
- Comment on user management efficiency
- Evaluate security configuration options
- Assess monitoring and reporting capabilities
- Note any missing administrative features

---

## Scenario 6: Error Handling
**Persona**: Any User  
**Objective**: Test system resilience and error messaging  
**Duration**: 20-30 minutes

### Step-by-Step Instructions

#### Phase 1: File Upload Errors (10 minutes)

1. **Invalid File Format**
   - Attempt to upload a .txt file
   - Try uploading an image file
   - Upload a corrupted XLIFF file
   - **Expected**: Clear error messages with guidance

2. **File Size Limits**
   - Try uploading an extremely large file (>100MB)
   - Test multiple large files simultaneously
   - **Expected**: Appropriate size limit messages

3. **Network Interruption Simulation**
   - Start a large file upload
   - Disable internet connection mid-upload
   - Reconnect and observe behavior
   - **Expected**: Graceful handling with recovery options

#### Phase 2: Authentication Errors (5 minutes)

4. **Login Error Handling**
   - Try incorrect password multiple times
   - Test password reset functionality
   - Attempt to access restricted areas without permission
   - **Expected**: Secure error handling without information leakage

#### Phase 3: Processing Errors (10 minutes)

5. **Service Overload**
   - Submit multiple large files simultaneously
   - Monitor system response under load
   - **Expected**: Appropriate queue management and status messages

6. **Data Validation**
   - Enter invalid data in forms
   - Test input field validation
   - Submit incomplete forms
   - **Expected**: Clear validation messages and prevention

#### Phase 4: Recovery Testing (5 minutes)

7. **Session Recovery**
   - Refresh page during processing
   - Test browser back/forward buttons
   - Close and reopen browser
   - **Expected**: Proper session handling and progress preservation

### Success Criteria
- ✅ Error messages are clear and helpful
- ✅ System handles invalid inputs gracefully
- ✅ Network issues are managed properly
- ✅ Recovery mechanisms work correctly
- ✅ Security is maintained during error conditions

### Feedback Points
- Rate error message clarity (1-5)
- Comment on recovery mechanism effectiveness
- Evaluate system stability under stress
- Note any confusing or unclear error situations

---

## Scenario 7: Mobile Responsiveness
**Persona**: Any User  
**Objective**: Test mobile device compatibility  
**Duration**: 20-30 minutes

### Step-by-Step Instructions

#### Phase 1: Mobile Browser Testing (15 minutes)

1. **Access on Mobile Device**
   - Open application on smartphone/tablet
   - Test landscape and portrait orientations
   - **Expected**: Responsive design adapts properly

2. **Navigation Testing**
   - Test menu navigation on mobile
   - Try all major page transitions
   - Test touch interactions
   - **Expected**: Smooth navigation and interactions

3. **File Upload on Mobile**
   - Test file upload from mobile device
   - Try camera-based file selection
   - Test progress monitoring
   - **Expected**: Mobile file upload works properly

#### Phase 2: Touch Interface (10 minutes)

4. **Touch Interactions**
   - Test all buttons and links
   - Try scrolling and swiping
   - Test form input on mobile
   - **Expected**: All touch interactions work correctly

5. **Mobile-Specific Features**
   - Test any mobile-optimized features
   - Check mobile notifications
   - Test offline behavior (if applicable)
   - **Expected**: Mobile features enhance user experience

#### Phase 3: Performance on Mobile (5 minutes)

6. **Mobile Performance**
   - Check page load times
   - Test processing speed
   - Monitor battery usage impact
   - **Expected**: Acceptable performance on mobile devices

### Success Criteria
- ✅ Application is fully responsive on mobile devices
- ✅ All functionality works on touch interfaces
- ✅ Performance is acceptable on mobile
- ✅ Mobile user experience is positive
- ✅ File upload works on mobile devices

### Feedback Points
- Rate mobile user experience (1-5)
- Comment on responsive design quality
- Evaluate mobile-specific functionality
- Note any mobile usability issues

---

## Feedback Forms

### Post-Scenario Survey Template

**Scenario**: [Scenario Name]  
**User Persona**: [Persona Name]  
**Date**: [Date]  
**Duration**: [Actual time taken]

#### Task Completion
1. Were you able to complete all tasks in this scenario? (Yes/No)
2. If no, which tasks were you unable to complete?
3. What prevented task completion?

#### Usability Rating (1-5 scale, 5 being excellent)
1. Overall ease of use: ⭐⭐⭐⭐⭐
2. Navigation clarity: ⭐⭐⭐⭐⭐
3. Information organization: ⭐⭐⭐⭐⭐
4. Error message helpfulness: ⭐⭐⭐⭐⭐
5. Visual design appeal: ⭐⭐⭐⭐⭐

#### Detailed Feedback
1. What did you like most about this experience?
2. What was most frustrating or confusing?
3. What features would you add or improve?
4. Would you recommend this system to colleagues? (Yes/No/Maybe)
5. Additional comments:

#### Technical Issues
1. Did you encounter any errors or bugs? (Yes/No)
2. If yes, please describe:
3. Browser and device used:
4. Any performance issues noted:

---

**Document Prepared By**: QA Team  
**Last Updated**: June 4, 2025  
**Next Review**: June 11, 2025 