import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
  isActive?: boolean
}

interface BreadcrumbProps {
  className?: string
  items?: BreadcrumbItem[]
  separator?: React.ReactNode
  showHome?: boolean
  maxItems?: number
}

// Mapping for dynamic route segments to readable labels
const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'sessions': 'QA Sessions',
  'upload': 'Upload',
  'analytics': 'Analytics',
  'quality': 'Quality Metrics',
  'errors': 'Error Analysis',
  'performance': 'Performance',
  'profile': 'Profile',
  'settings': 'Settings',
  'new': 'New Session',
  'edit': 'Edit',
  'view': 'View Details'
}

// Generate breadcrumbs from current path
const generateBreadcrumbsFromPath = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Add home if not on root
  if (segments.length > 0) {
    breadcrumbs.push({
      label: 'Dashboard',
      href: '/',
      icon: <Home className="h-3 w-3" />
    })
  }

  // Build breadcrumbs from path segments
  segments.forEach((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1
    
    // Handle dynamic segments (like IDs)
    let label = routeLabels[segment] || segment
    
    // For UUIDs or long IDs, truncate them
    if (segment.length > 20 && /^[a-f0-9-]+$/i.test(segment)) {
      label = `Session ${segment.slice(0, 8)}...`
    }
    
    // Capitalize and format labels
    if (!routeLabels[segment]) {
      label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    }

    breadcrumbs.push({
      label,
      href: isLast ? undefined : href,
      isActive: isLast
    })
  })

  return breadcrumbs
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  className,
  items,
  separator = <ChevronRight className="h-3 w-3 text-muted-foreground" />,
  showHome = true,
  maxItems = 5
}) => {
  const location = useLocation()
  
  // Use provided items or generate from current path
  const breadcrumbItems = items || generateBreadcrumbsFromPath(location.pathname)
  
  // Truncate items if exceeding maxItems
  const displayItems = breadcrumbItems.length > maxItems
    ? [
        breadcrumbItems[0],
        { label: '...', isActive: false },
        ...breadcrumbItems.slice(-(maxItems - 2))
      ]
    : breadcrumbItems

  if (displayItems.length === 0) return null

  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {displayItems.map((item, index) => (
          <li key={index} className="flex items-center space-x-1">
            {index > 0 && (
              <span className="flex-shrink-0" aria-hidden="true">
                {separator}
              </span>
            )}
            
            {item.label === '...' ? (
              <span className="text-muted-foreground px-1">...</span>
            ) : item.href && !item.isActive ? (
              <Link
                to={item.href}
                className="flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span 
                className={cn(
                  "flex items-center space-x-1",
                  item.isActive 
                    ? "text-foreground font-medium" 
                    : "text-muted-foreground"
                )}
                aria-current={item.isActive ? "page" : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Specialized QA Session Breadcrumb
interface QASessionBreadcrumbProps {
  sessionId?: string
  sessionName?: string
  fileName?: string
  className?: string
}

export const QASessionBreadcrumb: React.FC<QASessionBreadcrumbProps> = ({
  sessionId,
  sessionName,
  fileName,
  className
}) => {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)
  
  const items: BreadcrumbItem[] = [
    {
      label: 'Dashboard',
      href: '/',
      icon: <Home className="h-3 w-3" />
    },
    {
      label: 'QA Sessions',
      href: '/sessions'
    }
  ]

  if (sessionId) {
    const sessionLabel = sessionName || fileName || `Session ${sessionId.slice(0, 8)}...`
    items.push({
      label: sessionLabel,
      href: `/sessions/${sessionId}`
    })

    // Add sub-pages if present
    if (pathSegments.includes('errors')) {
      items.push({
        label: 'Errors',
        href: `/sessions/${sessionId}/errors`
      })
    }
    
    if (pathSegments.includes('segments')) {
      items.push({
        label: 'Segments',
        href: `/sessions/${sessionId}/segments`
      })
    }
    
    if (pathSegments.includes('analytics')) {
      items.push({
        label: 'Analytics',
        isActive: true
      })
    }
  }

  return <Breadcrumb items={items} className={className} />
}

export default Breadcrumb 