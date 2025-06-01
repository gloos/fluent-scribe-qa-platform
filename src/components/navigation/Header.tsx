import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { 
  Menu, 
  Bell, 
  Settings, 
  LogOut, 
  User, 
  FileText, 
  BarChart3, 
  Upload,
  Zap,
  ChevronDown,
  MessageSquare,
  AlertTriangle
} from 'lucide-react'

interface HeaderProps {
  className?: string
  user?: {
    name: string
    email: string
    avatar?: string
  }
  notifications?: number
  onLogout?: () => void
}

interface NavigationItem {
  title: string
  href: string
  description?: string
  icon?: React.ReactNode
  badge?: string
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    description: 'Overview of your QA sessions and metrics',
    icon: <BarChart3 className="h-4 w-4" />
  },
  {
    title: 'QA Sessions',
    href: '/sessions',
    description: 'Manage and review your analysis sessions',
    icon: <FileText className="h-4 w-4" />,
    children: [
      {
        title: 'All Sessions',
        href: '/sessions',
        description: 'View all QA sessions'
      },
      {
        title: 'Active Sessions',
        href: '/sessions?status=processing',
        description: 'Currently processing files'
      },
      {
        title: 'Completed',
        href: '/sessions?status=completed',
        description: 'Finished analysis sessions'
      },
      {
        title: 'QA Error Analysis',
        href: '/qa-errors',
        description: 'Review errors with feedback system'
      }
    ]
  },
  {
    title: 'Upload',
    href: '/upload',
    description: 'Upload new XLIFF files for analysis',
    icon: <Upload className="h-4 w-4" />
  },
  {
    title: 'Analytics',
    href: '/analytics',
    description: 'Detailed analytics and reporting',
    icon: <BarChart3 className="h-4 w-4" />,
    children: [
      {
        title: 'Quality Metrics',
        href: '/analytics/quality',
        description: 'MQM scores and trends'
      },
      {
        title: 'Error Analysis',
        href: '/analytics/errors',
        description: 'Error patterns and insights'
      },
      {
        title: 'Performance',
        href: '/analytics/performance',
        description: 'Processing time and efficiency'
      }
    ]
  },
  {
    title: 'Feedback',
    href: '/feedback-demo',
    description: 'User feedback system demonstration',
    icon: <MessageSquare className="h-4 w-4" />,
    badge: 'New'
  }
]

export const Header: React.FC<HeaderProps> = ({
  className,
  user,
  notifications = 0,
  onLogout
}) => {
  const location = useLocation()

  const isActivePath = (href: string) => {
    if (href === '/' || href === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(href)
  }

  const MobileNavigation = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-primary rounded-lg">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">QA Platform</h2>
            <p className="text-xs text-muted-foreground">Linguistic Quality Assessment</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navigationItems.map((item) => (
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
      </SheetContent>
    </Sheet>
  )

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Mobile Menu */}
        <div className="flex items-center gap-4">
          <MobileNavigation />
          
          <Link to="/" className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-lg">QA Platform</h1>
              <p className="text-xs text-muted-foreground leading-none">
                Linguistic Quality Assessment
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.href}>
                  {item.children ? (
                    <>
                      <NavigationMenuTrigger 
                        className={cn(
                          isActivePath(item.href) && "bg-accent text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {item.icon}
                          {item.title}
                        </div>
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid w-80 gap-3 p-4">
                          <div className="row-span-3">
                            <NavigationMenuLink asChild>
                              <Link
                                to={item.href}
                                className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                              >
                                {item.icon}
                                <div className="mb-2 mt-4 text-lg font-medium">
                                  {item.title}
                                </div>
                                <p className="text-sm leading-tight text-muted-foreground">
                                  {item.description}
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                          <div className="space-y-1">
                            {item.children.map((child) => (
                              <NavigationMenuLink key={child.href} asChild>
                                <Link
                                  to={child.href}
                                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                >
                                  <div className="text-sm font-medium leading-none">
                                    {child.title}
                                  </div>
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                    {child.description}
                                  </p>
                                </Link>
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <NavigationMenuLink asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                          isActivePath(item.href) && "bg-accent text-accent-foreground"
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
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
              >
                {notifications > 99 ? '99+' : notifications}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 