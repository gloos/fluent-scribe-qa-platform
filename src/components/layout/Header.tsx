import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, User, Settings, LogOut, Menu, X, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { sessionManager } from "@/lib/sessionManager";
import { toast } from "@/hooks/use-toast";
import { Permission } from "@/lib/rbac";
import PermissionGuard from "@/components/PermissionGuard";
import { RoleBasedNavigationMenu } from "@/components/navigation/RoleBasedNavigationMenu";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, signOut } = useAuth();
  const { userProfile, hasPermission, getRoleDisplayName } = useRBAC();

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      
      toast({
        title: "Logging out...",
        description: "Securely ending your session.",
        variant: "default"
      });

      // Use session manager for secure logout
      const result = await sessionManager.secureLogout();
      
      if (result.success) {
        // Also call the auth hook's signOut for consistency
        await signOut();
        
        toast({
          title: "Logged out successfully",
          description: "You have been securely logged out.",
          variant: "default"
        });
      } else {
        // Even if session manager fails, try the auth signOut
        await signOut();
        
        toast({
          title: "Logged out",
          description: "Session ended. Please log in again if needed.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      
      // Force logout even if there's an error
      await signOut();
      
      toast({
        title: "Logout Error",
        description: "There was an issue logging out, but your session has been cleared.",
        variant: "destructive"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Helper function to get user's initials
  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LinguaQA</span>
          </Link>

          {/* Desktop Navigation - Now using RoleBasedNavigationMenu */}
          {isAuthenticated && (
            <div className="hidden md:block">
              <RoleBasedNavigationMenu />
            </div>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={undefined} alt={userProfile?.full_name || user.email} />
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userProfile?.full_name || 'No name provided'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      {userProfile?.role && (
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-500">
                            {getRoleDisplayName(userProfile.role)}
                          </span>
                        </div>
                      )}
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
                  <PermissionGuard permission={Permission.VIEW_USERS}>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/users" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>User Management</span>
                      </Link>
                    </DropdownMenuItem>
                  </PermissionGuard>
                  <PermissionGuard permission={Permission.VIEW_SYSTEM_LOGS}>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/security" className="flex items-center">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Security Admin</span>
                      </Link>
                    </DropdownMenuItem>
                  </PermissionGuard>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="cursor-pointer"
                    disabled={isLoggingOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex space-x-2">
                <Link to="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation - Now using RoleBasedNavigationMenu */}
        {isMenuOpen && isAuthenticated && (
          <div className="md:hidden py-4 border-t">
            <RoleBasedNavigationMenu 
              isMobile={true}
              className="space-y-2"
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
