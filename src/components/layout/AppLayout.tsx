import React from 'react'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  className?: string
  sidebar?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  className,
  sidebar,
  header,
  footer
}) => {
  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col",
      className
    )}>
      {/* Header */}
      {header && (
        <header className="sticky top-0 z-sticky border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {header}
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        {sidebar && (
          <aside className="fixed inset-y-0 left-0 z-sidebar w-64 border-r bg-background transition-transform duration-200 ease-in-out lg:relative lg:z-auto lg:translate-x-0">
            {sidebar}
          </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 overflow-auto",
          sidebar && "lg:pl-0 pl-0" // Account for sidebar
        )}>
          {children}
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <footer className="border-t bg-background">
          {footer}
        </footer>
      )}
    </div>
  )
}

// Content container with consistent spacing
interface ContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export const Container: React.FC<ContainerProps> = ({
  children,
  className,
  size = 'lg'
}) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl', 
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-none'
  }

  return (
    <div className={cn(
      "container mx-auto px-4 sm:px-6 lg:px-8",
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  )
}

// Grid layout component
interface GridProps {
  children: React.ReactNode
  className?: string
  cols?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: 'sm' | 'md' | 'lg'
  responsive?: boolean
}

export const Grid: React.FC<GridProps> = ({
  children,
  className,
  cols = 1,
  gap = 'md',
  responsive = true
}) => {
  const colClasses = {
    1: 'grid-cols-1',
    2: responsive ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2',
    3: responsive ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-3',
    4: responsive ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-4',
    6: responsive ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-6',
    12: responsive ? 'grid-cols-1 md:grid-cols-6 lg:grid-cols-12' : 'grid-cols-12'
  }

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  return (
    <div className={cn(
      "grid",
      colClasses[cols],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Flex layout utilities
interface FlexProps {
  children: React.ReactNode
  className?: string
  direction?: 'row' | 'col'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean
  gap?: 'sm' | 'md' | 'lg'
}

export const Flex: React.FC<FlexProps> = ({
  children,
  className,
  direction = 'row',
  align = 'start',
  justify = 'start',
  wrap = false,
  gap = 'md'
}) => {
  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col'
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  return (
    <div className={cn(
      "flex",
      directionClasses[direction],
      alignClasses[align],
      justifyClasses[justify],
      wrap && 'flex-wrap',
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Section component for content organization
interface SectionProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
  padding?: 'sm' | 'md' | 'lg'
}

export const Section: React.FC<SectionProps> = ({
  children,
  className,
  title,
  description,
  padding = 'md'
}) => {
  const paddingClasses = {
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12'
  }

  return (
    <section className={cn(
      paddingClasses[padding],
      className
    )}>
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
} 