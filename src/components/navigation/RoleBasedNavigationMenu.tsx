import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, Permission } from '@/lib/rbac';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { 
  Bell, 
  Settings, 
  LogOut, 
  User, 
  FileText, 
  BarChart3, 
  Upload,
  ChevronDown,
  MessageSquare,
  AlertTriangle,
  Users,
  Shield,
  CreditCard,
  UserCog
} from 'lucide-react';

interface NavigationItem {
  title: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  children?: NavigationItem[];
  
  // Access control
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAllPermissions?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    description: 'Overview of your QA sessions and metrics',
    icon: <BarChart3 className="h-4 w-4" />,
    // Available to all authenticated users
  },
  {
    title: 'QA Sessions',
    href: '/sessions',
    description: 'Manage and review your analysis sessions',
    icon: <FileText className="h-4 w-4" />,
    requiredPermission: Permission.VIEW_QA_SESSION,
    children: [
      {
        title: 'All Sessions',
        href: '/sessions',
        description: 'View all QA sessions',
        requiredPermission: Permission.VIEW_QA_SESSION
      },
      {
        title: 'Active Sessions',
        href: '/sessions?status=processing',
        description: 'Currently processing files',
        requiredPermission: Permission.VIEW_QA_SESSION
      },
      {
        title: 'Completed',
        href: '/sessions?status=completed',
        description: 'Finished analysis sessions',
        requiredPermission: Permission.VIEW_QA_SESSION
      },
      {
        title: 'QA Error Analysis',
        href: '/qa-errors',
        description: 'Review errors with feedback system',
        requiredPermission: Permission.VIEW_QA_SESSION
      }
    ]
  },
  {
    title: 'Upload',
    href: '/upload',
    description: 'Upload new XLIFF files for analysis',
    icon: <Upload className="h-4 w-4" />,
    requiredPermission: Permission.UPLOAD_FILES
  },
  {
    title: 'Reports',
    href: '/reports',
    description: 'View and analyze QA reports',
    icon: <BarChart3 className="h-4 w-4" />,
    requiredPermission: Permission.VIEW_REPORTS,
    children: [
      {
        title: 'Quality Metrics',
        href: '/reports?type=quality',
        description: 'MQM scores and trends',
        requiredPermission: Permission.VIEW_REPORTS
      },
      {
        title: 'Error Analysis',
        href: '/reports?type=errors',
        description: 'Error patterns and insights',
        requiredPermission: Permission.VIEW_REPORTS
      },
      {
        title: 'Performance',
        href: '/reports?type=performance',
        description: 'Processing time and efficiency',
        requiredPermission: Permission.VIEW_REPORTS
      }
    ]
  },
  {
    title: 'Feedback',
    href: '/feedback-demo',
    description: 'User feedback system demonstration',
    icon: <MessageSquare className="h-4 w-4" />,
    badge: 'New',
    // Available to all authenticated users
  },
  {
    title: 'Permission Demo',
    href: '/demo/permissions',
    description: 'Showcase of permission-aware UI components',
    icon: <Shield className="h-4 w-4" />,
    badge: 'Demo',
    // Available to all authenticated users
  },
  {
    title: 'Administration',
    href: '/admin',
    description: 'Administrative functions',
    icon: <Settings className="h-4 w-4" />,
    minRole: UserRole.MANAGER,
    children: [
      {
        title: 'User Management',
        href: '/admin/users',
        description: 'Manage user accounts and roles',
        icon: <Users className="h-4 w-4" />,
        requiredPermission: Permission.VIEW_USERS
      },
      {
        title: 'Security',
        href: '/admin/security',
        description: 'Security settings and audit logs',
        icon: <Shield className="h-4 w-4" />,
        requiredPermission: Permission.VIEW_SECURITY_LOGS
      },
      {
        title: 'Billing',
        href: '/billing',
        description: 'Subscription and billing management',
        icon: <CreditCard className="h-4 w-4" />,
        requiredPermission: Permission.VIEW_BILLING
      }
    ]
  },
  {
    title: 'Profile',
    href: '/profile',
    description: 'User profile and preferences',
    icon: <UserCog className="h-4 w-4" />,
    // Available to all authenticated users
  }
];

interface RoleBasedNavigationMenuProps {
  className?: string;
  isMobile?: boolean;
}

export const RoleBasedNavigationMenu: React.FC<RoleBasedNavigationMenuProps> = ({
  className,
  isMobile = false
}) => {
  const location = useLocation();
  const { userRole, hasPermission, hasAnyPermission, loading } = useRBAC();

  // Helper function to get role hierarchy level
  const getRoleLevel = (role: UserRole): number => {
    const levels = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.QA_ANALYST]: 2,
      [UserRole.MANAGER]: 3,
      [UserRole.ADMIN]: 4,
      [UserRole.SUPER_ADMIN]: 5
    };
    return levels[role] || 0;
  };

  // Check if user can access a navigation item
  const canAccessItem = (item: NavigationItem): boolean => {
    // Check minimum role requirement
    if (item.minRole) {
      const userLevel = getRoleLevel(userRole);
      const minLevel = getRoleLevel(item.minRole);
      if (userLevel < minLevel) return false;
    }

    // Check allowed roles
    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
      return false;
    }

    // Check single permission
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }

    // Check multiple permissions
    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      if (item.requireAllPermissions) {
        // User must have ALL permissions
        return item.requiredPermissions.every(permission => hasPermission(permission));
      } else {
        // User must have ANY permission
        return hasAnyPermission(item.requiredPermissions);
      }
    }

    return true;
  };

  // Filter navigation items based on user permissions
  const getAccessibleItems = (items: NavigationItem[]): NavigationItem[] => {
    return items
      .filter(canAccessItem)
      .map(item => ({
        ...item,
        children: item.children ? getAccessibleItems(item.children) : undefined
      }))
      .filter(item => !item.children || item.children.length > 0); // Remove items with no accessible children
  };

  const isActivePath = (href: string) => {
    if (href === '/' || href === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href.split('?')[0]);
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  const accessibleItems = getAccessibleItems(navigationItems);

  if (isMobile) {
    // Mobile navigation layout
    return (
      <nav className={cn("space-y-1", className)}>
        {accessibleItems.map((item) => (
          <div key={item.href}>
            <Link
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActivePath(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {item.icon}
              {item.title}
              {item.badge && (
                <Badge variant="secondary" className="ml-auto">
                  {item.badge}
                </Badge>
              )}
            </Link>
            
            {item.children && isActivePath(item.href) && (
              <div className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    to={child.href}
                    className="block rounded-lg px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {child.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    );
  }

  // Desktop navigation layout
  return (
    <NavigationMenu className={className}>
      <NavigationMenuList>
        {accessibleItems.map((item) => (
          <NavigationMenuItem key={item.href}>
            {item.children && item.children.length > 0 ? (
              <>
                <NavigationMenuTrigger
                  className={cn(
                    "flex items-center gap-2",
                    isActivePath(item.href) && "text-primary"
                  )}
                >
                  {item.icon}
                  {item.title}
                  {item.badge && (
                    <Badge variant="secondary" className="ml-1">
                      {item.badge}
                    </Badge>
                  )}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid gap-3 p-4 w-[400px]">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="flex items-center gap-2">
                          {child.icon}
                          <div className="text-sm font-medium leading-none">
                            {child.title}
                          </div>
                          {child.badge && (
                            <Badge variant="secondary" className="ml-auto">
                              {child.badge}
                            </Badge>
                          )}
                        </div>
                        {child.description && (
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            {child.description}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink asChild>
                <Link
                  to={item.href}
                  className={cn(
                    "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                    isActivePath(item.href) && "text-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    {item.title}
                    {item.badge && (
                      <Badge variant="secondary" className="ml-1">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}; 