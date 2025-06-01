import React from 'react'
import Header from '@/components/layout/Header'
import { FeedbackIntegrationDemo } from '@/components/feedback'

const FeedbackDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FeedbackIntegrationDemo />
      </div>
    </div>
  )
}

export default FeedbackDemo 