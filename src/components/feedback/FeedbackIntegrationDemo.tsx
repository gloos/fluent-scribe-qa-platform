import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorCard, ErrorList, type QAError } from '@/components/data-display'
import { TranslationSegmentLayout, QASessionLayout } from '@/components/layout/QALayout'
import { FeedbackButton } from './FeedbackButton'
import { FeedbackTargetType, FeedbackFormData } from '@/lib/types/user-feedback'
import { feedbackService } from '@/lib/services/feedback'

// Demo component showing integrated feedback functionality
export const FeedbackIntegrationDemo: React.FC = () => {
  const [demoErrors] = useState<QAError[]>([
    {
      id: 'demo-error-1',
      type: 'Terminology',
      severity: 'major' as const,
      message: 'Inconsistent terminology usage',
      description: 'The term "user interface" should be "user interface" throughout the document.',
      segmentId: 'seg_001',
      segmentText: 'The UI provides access to all system features.',
      category: 'Terminology',
      subcategory: 'Inconsistency',
      createdAt: new Date().toISOString(),
      createdBy: 'QA System',
      resolved: false
    },
    {
      id: 'demo-error-2',
      type: 'Grammar',
      severity: 'minor' as const,
      message: 'Subject-verb disagreement',
      description: 'The subject and verb do not agree in number.',
      segmentId: 'seg_002',
      segmentText: 'The features is available to all users.',
      category: 'Grammar',
      subcategory: 'Agreement',
      createdAt: new Date().toISOString(),
      createdBy: 'QA System',
      resolved: false
    }
  ])

  const handleFeedbackSubmit = async (errorId: string, feedbackData: FeedbackFormData) => {
    try {
      console.log('Submitting feedback for error:', errorId, feedbackData)
      
      // In a real application, you would call the feedback service:
      // await feedbackService.submitFeedback({
      //   target_type: FeedbackTargetType.ERROR_CATEGORIZATION,
      //   target_id: errorId,
      //   ...feedbackData
      // })
      
      // For demo purposes, just log the feedback
      alert(`Feedback submitted for error ${errorId}!\nType: ${feedbackData.feedback_type}\nRating: ${feedbackData.rating || 'None'}\nComment: ${feedbackData.comment || 'None'}`)
      
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Error submitting feedback. Please try again.')
    }
  }

  const handleSessionFeedback = async (feedbackData: FeedbackFormData) => {
    try {
      console.log('Submitting session feedback:', feedbackData)
      
      alert(`Session feedback submitted!\nType: ${feedbackData.feedback_type}\nRating: ${feedbackData.rating || 'None'}\nComment: ${feedbackData.comment || 'None'}`)
      
    } catch (error) {
      console.error('Error submitting session feedback:', error)
      alert('Error submitting feedback. Please try again.')
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Feedback Integration Demo</h1>
        <p className="text-muted-foreground">
          This demo shows how feedback components are integrated into existing QA displays.
        </p>
      </div>

      {/* Session-Level Feedback Demo */}
      <Card>
        <CardHeader>
          <CardTitle>1. Session-Level Feedback</CardTitle>
          <CardDescription>
            Users can provide feedback on overall assessment quality and system performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QASessionLayout
            sessionInfo={{
              fileName: 'demo-translation.xliff',
              status: 'completed',
              mqmScore: 18.5,
              errorCount: 2
            }}
          >
            <div className="text-sm text-muted-foreground mt-4">
              Session-level feedback button is shown in the header for completed sessions.
            </div>
          </QASessionLayout>
        </CardContent>
      </Card>

      {/* Error List with Feedback Demo */}
      <Card>
        <CardHeader>
          <CardTitle>2. Error List with Integrated Feedback</CardTitle>
          <CardDescription>
            Each error in the list includes a feedback button for user input on categorization accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorList
            errors={demoErrors}
            onErrorClick={(error) => {
              console.log('Error clicked:', error)
            }}
            onErrorResolve={(errorId) => {
              console.log('Resolving error:', errorId)
              alert(`Error ${errorId} marked as resolved`)
            }}
          />
        </CardContent>
      </Card>

      {/* Individual Error Card Demo */}
      <Card>
        <CardHeader>
          <CardTitle>3. Individual Error Cards</CardTitle>
          <CardDescription>
            Standalone error cards with built-in feedback functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoErrors.map((error) => (
            <ErrorCard
              key={error.id}
              error={error}
              onErrorClick={(error) => {
                console.log('Error clicked:', error)
              }}
              onErrorResolve={(errorId) => {
                console.log('Resolving error:', errorId)
                alert(`Error ${errorId} marked as resolved`)
              }}
              onFeedbackSubmit={handleFeedbackSubmit}
              showFeedback={true}
            />
          ))}
        </CardContent>
      </Card>

      {/* Segment-Level Feedback Demo */}
      <Card>
        <CardHeader>
          <CardTitle>4. Segment-Level Error Display</CardTitle>
          <CardDescription>
            Translation segments with errors include feedback buttons for each issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TranslationSegmentLayout
            segmentId="seg_001"
            sourceText="The user interface provides access to all system features."
            targetText="The UI provides access to all system features."
            errors={[
              {
                id: 'demo-error-1',
                severity: 'major' as const,
                type: 'Terminology',
                description: 'Inconsistent terminology: "UI" vs "user interface"'
              }
            ]}
          >
            <div className="text-sm text-muted-foreground mt-4">
              Individual errors within segments include feedback buttons.
            </div>
          </TranslationSegmentLayout>
        </CardContent>
      </Card>

      {/* Standalone Feedback Button Demo */}
      <Card>
        <CardHeader>
          <CardTitle>5. Standalone Feedback Components</CardTitle>
          <CardDescription>
            Feedback buttons can be used independently in various contexts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Button Variant</h4>
              <FeedbackButton
                targetType={FeedbackTargetType.ERROR_CATEGORIZATION}
                targetId="demo-standalone-1"
                onFeedbackSubmit={async (feedbackData) => {
                  console.log('Standalone feedback:', feedbackData)
                  alert('Standalone feedback submitted!')
                }}
                variant="button"
                size="md"
                showQuickRating={true}
              />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Icon Variant</h4>
              <FeedbackButton
                targetType={FeedbackTargetType.ASSESSMENT_RESULT}
                targetId="demo-standalone-2"
                onFeedbackSubmit={async (feedbackData) => {
                  console.log('Icon feedback:', feedbackData)
                  alert('Icon feedback submitted!')
                }}
                variant="icon"
                size="md"
                showFeedbackCount={true}
                feedbackCount={5}
              />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Minimal Variant</h4>
              <FeedbackButton
                targetType={FeedbackTargetType.TAXONOMY_STRUCTURE}
                targetId="demo-standalone-3"
                onFeedbackSubmit={async (feedbackData) => {
                  console.log('Minimal feedback:', feedbackData)
                  alert('Minimal feedback submitted!')
                }}
                variant="minimal"
                size="sm"
                showQuickRating={true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Key Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Feedback buttons are integrated into existing error display components</li>
              <li>Multiple feedback variants (button, icon, minimal) for different contexts</li>
              <li>Support for quick ratings and detailed feedback forms</li>
              <li>Session-level and error-level feedback collection</li>
              <li>Built-in validation and error handling</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Backend Integration:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Database schema supports comprehensive feedback storage and analytics</li>
              <li>Feedback service handles API interactions with Supabase</li>
              <li>RLS policies ensure secure access to feedback data</li>
              <li>Support for feedback aggregation and effectiveness metrics</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default FeedbackIntegrationDemo 