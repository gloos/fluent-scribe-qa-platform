# Feedback System Integration Tests

## Overview
This document outlines the comprehensive test plan for the feedback system integration. These tests verify that all components work together correctly and that the user experience is smooth.

## Test Environment Setup

### Prerequisites
1. **Database Setup**: Ensure feedback tables are created in Supabase
2. **Authentication**: Test user logged in with appropriate permissions
3. **Sample Data**: QA errors and assessment results available for testing

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Test Cases

### 1. Component Rendering Tests

#### Test 1.1: FeedbackButton Variants
**Objective**: Verify all FeedbackButton variants render correctly
**Steps**:
1. Navigate to the feedback demo page
2. Verify button variant shows "Feedback" text
3. Verify icon variant shows only icon
4. Verify minimal variant has minimal styling
5. Check feedback count badge appears when specified

**Expected Results**:
- All variants render without errors
- Visual differences are apparent between variants
- Feedback count displays correctly when provided

#### Test 1.2: Error List Integration
**Objective**: Verify feedback buttons appear in error lists
**Steps**:
1. Navigate to QA session with errors
2. Check each error card has a feedback button
3. Verify feedback button is positioned correctly
4. Check hover states work properly

**Expected Results**:
- Feedback buttons visible on all error cards
- No layout issues or overlapping elements
- Hover states provide visual feedback

### 2. User Interaction Tests

#### Test 2.1: Quick Rating Feedback
**Objective**: Test rapid feedback collection
**Steps**:
1. Click feedback button on an error
2. Select thumbs up rating
3. Verify feedback is submitted
4. Check feedback count updates
5. Verify button shows "feedback provided" state

**Expected Results**:
- Quick rating submits successfully
- UI provides immediate feedback to user
- Button state changes to indicate feedback given
- Database record created with correct data

#### Test 2.2: Detailed Feedback Form
**Objective**: Test comprehensive feedback submission
**Steps**:
1. Click feedback button on an error
2. Open detailed feedback form
3. Fill out all fields (rating, comment, category suggestion)
4. Submit feedback
5. Verify form closes and success indication appears

**Expected Results**:
- Form opens without errors
- All form validation works correctly
- Submission succeeds with all data
- User receives clear success feedback

#### Test 2.3: Session-Level Feedback
**Objective**: Test feedback on overall assessment quality
**Steps**:
1. Navigate to completed QA session
2. Use session-level feedback button
3. Provide rating and comments on overall quality
4. Submit feedback

**Expected Results**:
- Session feedback button visible only for completed sessions
- Feedback form appropriate for session-level feedback
- Submission links to correct session/assessment ID

### 3. Database Integration Tests

#### Test 3.1: Feedback Persistence
**Objective**: Verify feedback data is stored correctly
**Steps**:
1. Submit various types of feedback
2. Check database records in user_feedback table
3. Verify all fields populated correctly
4. Check timestamps and user attribution

**Expected Results**:
- All feedback types create database records
- Data integrity maintained (no null required fields)
- Proper user attribution and timestamps
- JSON fields (category_suggestion) stored correctly

#### Test 3.2: Feedback Retrieval
**Objective**: Test feedback querying and display
**Steps**:
1. Submit feedback on multiple errors
2. Refresh page/navigate away and back
3. Verify feedback state persists
4. Check feedback count displays correctly

**Expected Results**:
- Feedback state persists across page refreshes
- Correct feedback counts displayed
- Previously given feedback indicated on UI

#### Test 3.3: Row Level Security (RLS)
**Objective**: Verify feedback access controls
**Steps**:
1. Submit feedback as regular user
2. Try to access feedback as different user
3. Test admin access to all feedback
4. Verify unauthorized access is blocked

**Expected Results**:
- Users can only see their own feedback
- Admins can access all feedback
- RLS policies prevent unauthorized access
- Proper error handling for access violations

### 4. Performance Tests

#### Test 4.1: Feedback Submission Performance
**Objective**: Verify feedback submission is fast and responsive
**Steps**:
1. Submit feedback with network throttling
2. Measure response times
3. Test with large comment text
4. Verify UI remains responsive during submission

**Expected Results**:
- Feedback submission completes within 2 seconds
- UI provides loading indicators during submission
- Large text doesn't cause performance issues
- No UI blocking during async operations

#### Test 4.2: Feedback Loading Performance
**Objective**: Test feedback retrieval speed
**Steps**:
1. Load page with many errors that have feedback
2. Measure time to display feedback indicators
3. Test scrolling performance with many feedback buttons

**Expected Results**:
- Feedback state loads quickly on page load
- Scrolling remains smooth with many feedback buttons
- No noticeable lag in UI interactions

### 5. Error Handling Tests

#### Test 5.1: Network Error Handling
**Objective**: Test graceful degradation when network fails
**Steps**:
1. Disable network connection
2. Attempt to submit feedback
3. Re-enable network
4. Verify retry mechanism works

**Expected Results**:
- Clear error message shown to user
- Feedback form remains open with data intact
- Retry succeeds when network restored
- No data loss during network issues

#### Test 5.2: Authentication Error Handling
**Objective**: Test behavior when user is not authenticated
**Steps**:
1. Log out user
2. Attempt to submit feedback
3. Verify appropriate error handling

**Expected Results**:
- Authentication error handled gracefully
- User prompted to log in
- Feedback data preserved during login flow
- Submission succeeds after re-authentication

### 6. Accessibility Tests

#### Test 6.1: Keyboard Navigation
**Objective**: Verify full keyboard accessibility
**Steps**:
1. Navigate to feedback buttons using only keyboard
2. Open feedback forms with Enter/Space
3. Navigate within forms using Tab
4. Submit feedback using keyboard only

**Expected Results**:
- All feedback components keyboard accessible
- Clear focus indicators visible
- Logical tab order throughout interface
- All actions completable via keyboard

#### Test 6.2: Screen Reader Compatibility
**Objective**: Test with screen reading software
**Steps**:
1. Use screen reader to navigate feedback interface
2. Verify all elements have appropriate labels
3. Test feedback form with screen reader
4. Verify success/error messages are announced

**Expected Results**:
- All feedback buttons have descriptive labels
- Form fields properly labeled for screen readers
- Status messages announced appropriately
- Logical reading order maintained

### 7. Cross-Browser Compatibility

#### Test 7.1: Modern Browser Testing
**Objective**: Verify functionality across major browsers
**Browsers**: Chrome, Firefox, Safari, Edge
**Steps**:
1. Test all feedback functionality in each browser
2. Verify visual consistency
3. Test form interactions
4. Check for JavaScript errors

**Expected Results**:
- Consistent functionality across browsers
- No visual layout issues
- All JavaScript features work properly
- No console errors in any browser

### 8. Mobile Responsiveness

#### Test 8.1: Mobile Device Testing
**Objective**: Verify feedback system works on mobile devices
**Steps**:
1. Test on various screen sizes (phone, tablet)
2. Verify touch interactions work properly
3. Check feedback form usability on small screens
4. Test with both portrait and landscape orientations

**Expected Results**:
- Feedback buttons appropriately sized for touch
- Forms usable on small screens
- No horizontal scrolling issues
- Consistent experience across orientations

## Test Data Setup

### Sample Error Data
```javascript
const testError = {
  id: 'test-error-1',
  type: 'Terminology',
  severity: 'major',
  message: 'Inconsistent terminology usage',
  category: 'Accuracy',
  subcategory: 'Terminology',
  segmentText: 'The UI provides access to features.',
  createdAt: new Date().toISOString(),
  createdBy: 'test-user'
}
```

### Sample Session Data
```javascript
const testSession = {
  id: 'test-session-1',
  fileName: 'test-document.xliff',
  status: 'completed',
  mqmScore: 18.5,
  errorCount: 3
}
```

## Success Criteria

### Functional Requirements
- ✅ All feedback variants render correctly
- ✅ Quick rating feedback works in < 1 second
- ✅ Detailed feedback forms submit successfully
- ✅ Database integration maintains data integrity
- ✅ Feedback state persists across sessions
- ✅ Error handling provides clear user feedback

### Performance Requirements
- ✅ Feedback submission: < 2 seconds
- ✅ Page load with feedback: < 3 seconds
- ✅ UI remains responsive during all operations

### Accessibility Requirements
- ✅ Full keyboard navigation support
- ✅ Screen reader compatible
- ✅ WCAG 2.1 AA compliance

### Browser Compatibility
- ✅ Works in all major modern browsers
- ✅ Mobile responsive design
- ✅ No JavaScript errors

## Automated Test Implementation

### Future Test Automation
This manual test plan serves as the foundation for implementing automated tests using:

1. **Unit Tests**: Vitest + React Testing Library
2. **Integration Tests**: Playwright for E2E testing
3. **Performance Tests**: Lighthouse CI
4. **Accessibility Tests**: axe-core integration

### Test File Structure
```
src/
├── components/feedback/
│   ├── __tests__/
│   │   ├── FeedbackButton.test.tsx
│   │   ├── FeedbackForm.test.tsx
│   │   ├── FeedbackRating.test.tsx
│   │   └── integration.test.tsx
│   └── __e2e__/
│       ├── feedback-workflow.spec.ts
│       └── accessibility.spec.ts
└── lib/services/
    └── __tests__/
        └── feedback.test.ts
```

## Conclusion

This comprehensive test plan ensures the feedback system provides a robust, accessible, and performant user experience. All tests should pass before the feedback system is considered production-ready. 