import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TabItem {
  id: string
  label: string
  content?: React.ReactNode
  icon?: React.ReactNode
  badge?: string | number
  disabled?: boolean
  className?: string
}

interface TabsProps {
  items: TabItem[]
  defaultActiveTab?: string
  activeTab?: string
  onTabChange?: (tabId: string) => void
  className?: string
  variant?: 'default' | 'pills' | 'underline'
  size?: 'sm' | 'md' | 'lg'
  orientation?: 'horizontal' | 'vertical'
  fullWidth?: boolean
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveTab,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
  variant = 'default',
  size = 'md',
  orientation = 'horizontal',
  fullWidth = false
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultActiveTab || items[0]?.id
  )

  const activeTab = controlledActiveTab ?? internalActiveTab
  const activeTabContent = items.find(item => item.id === activeTab)?.content

  const handleTabChange = (tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId)
    }
    onTabChange?.(tabId)
  }

  const sizeClasses = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3'
  }

  const getTabButtonClasses = (item: TabItem, isActive: boolean) => {
    const baseClasses = cn(
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
      sizeClasses[size],
      fullWidth && orientation === 'horizontal' && 'flex-1',
      item.disabled && 'opacity-50 cursor-not-allowed'
    )

    switch (variant) {
      case 'pills':
        return cn(
          baseClasses,
          'rounded-md',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          item.className
        )
      
      case 'underline':
        return cn(
          baseClasses,
          'border-b-2 rounded-none',
          isActive
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
          item.className
        )
      
      default:
        return cn(
          baseClasses,
          'border border-border rounded-t-md -mb-px',
          isActive
            ? 'bg-background text-foreground border-b-background z-10'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted',
          item.className
        )
    }
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Tab Navigation */}
      <div
        className={cn(
          "flex",
          orientation === 'vertical' ? 'flex-col space-y-1' : 'space-x-1',
          variant === 'default' && orientation === 'horizontal' && 'border-b',
          variant === 'underline' && orientation === 'horizontal' && 'border-b'
        )}
        role="tablist"
        aria-orientation={orientation}
      >
        {items.map((item) => {
          const isActive = activeTab === item.id
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={getTabButtonClasses(item, isActive)}
              onClick={() => !item.disabled && handleTabChange(item.id)}
              disabled={item.disabled}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              id={`tab-${item.id}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {item.badge}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTabContent && (
        <div
          className={cn(
            "mt-4",
            variant === 'default' && "border rounded-b-md bg-background p-4"
          )}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          id={`tabpanel-${activeTab}`}
        >
          {activeTabContent}
        </div>
      )}
    </div>
  )
}

// QA-specific tab configurations
export const QASessionTabs: React.FC<{
  sessionId: string
  className?: string
  activeTab?: string
  onTabChange?: (tabId: string) => void
}> = ({ sessionId, className, activeTab, onTabChange }) => {
  const qaTabItems: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: <div>Session overview content</div>
    },
    {
      id: 'segments',
      label: 'Segments',
      badge: '124',
      content: <div>Translation segments content</div>
    },
    {
      id: 'errors',
      label: 'Errors',
      badge: '23',
      content: <div>Error analysis content</div>
    },
    {
      id: 'analytics',
      label: 'Analytics',
      content: <div>Analytics content</div>
    }
  ]

  return (
    <Tabs
      items={qaTabItems}
      activeTab={activeTab}
      onTabChange={onTabChange}
      variant="underline"
      className={className}
    />
  )
}

// Error Analysis Tabs
export const ErrorAnalysisTabs: React.FC<{
  errors: Array<{ severity: string }>
  className?: string
}> = ({ errors, className }) => {
  const criticalCount = errors.filter(e => e.severity === 'critical').length
  const majorCount = errors.filter(e => e.severity === 'major').length
  const minorCount = errors.filter(e => e.severity === 'minor').length

  const errorTabItems: TabItem[] = [
    {
      id: 'all',
      label: 'All Errors',
      badge: errors.length,
      content: <div>All errors list</div>
    },
    {
      id: 'critical',
      label: 'Critical',
      badge: criticalCount,
      content: <div>Critical errors list</div>,
      disabled: criticalCount === 0
    },
    {
      id: 'major',
      label: 'Major',
      badge: majorCount,
      content: <div>Major errors list</div>,
      disabled: majorCount === 0
    },
    {
      id: 'minor',
      label: 'Minor',
      badge: minorCount,
      content: <div>Minor errors list</div>,
      disabled: minorCount === 0
    }
  ]

  return (
    <Tabs
      items={errorTabItems}
      variant="pills"
      className={className}
    />
  )
}

// Analytics Dashboard Tabs
export const AnalyticsTabs: React.FC<{
  className?: string
  activeTab?: string
  onTabChange?: (tabId: string) => void
}> = ({ className, activeTab, onTabChange }) => {
  const analyticsTabItems: TabItem[] = [
    {
      id: 'quality',
      label: 'Quality Metrics',
      content: <div>Quality metrics dashboard</div>
    },
    {
      id: 'trends',
      label: 'Trends',
      content: <div>Trends analysis</div>
    },
    {
      id: 'performance',
      label: 'Performance',
      content: <div>Performance analytics</div>
    },
    {
      id: 'exports',
      label: 'Reports',
      content: <div>Export and reporting</div>
    }
  ]

  return (
    <Tabs
      items={analyticsTabItems}
      activeTab={activeTab}
      onTabChange={onTabChange}
      variant="default"
      fullWidth
      className={className}
    />
  )
}

// Hook for managing tab state
export const useTabs = (items: TabItem[], defaultTab?: string) => {
  const [activeTab, setActiveTab] = useState(defaultTab || items[0]?.id)
  
  const setTab = (tabId: string) => {
    const tabExists = items.some(item => item.id === tabId)
    if (tabExists) {
      setActiveTab(tabId)
    }
  }

  const getActiveTabContent = () => {
    return items.find(item => item.id === activeTab)?.content
  }

  const getActiveTabIndex = () => {
    return items.findIndex(item => item.id === activeTab)
  }

  const goToNextTab = () => {
    const currentIndex = getActiveTabIndex()
    const nextIndex = (currentIndex + 1) % items.length
    setActiveTab(items[nextIndex].id)
  }

  const goToPreviousTab = () => {
    const currentIndex = getActiveTabIndex()
    const prevIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1
    setActiveTab(items[prevIndex].id)
  }

  return {
    activeTab,
    setTab,
    getActiveTabContent,
    getActiveTabIndex,
    goToNextTab,
    goToPreviousTab
  }
}

export default Tabs 