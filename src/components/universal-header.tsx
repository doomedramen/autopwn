'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Logo } from '@/components/logo';
import { useLogo } from '@/components/logo';
import { Shield, Wifi, LogOut, User, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth-provider';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface UniversalHeaderProps {
  showActions?: boolean;
  onUploadClick?: () => void;
  onCreateJobClick?: () => void;
  disabledJobButton?: boolean;
  title?: string;
}

export function UniversalHeader({
  showActions = false,
  onUploadClick,
  onCreateJobClick,
  disabledJobButton = false,
  title = 'AutoPWN',
}: UniversalHeaderProps) {
  const { state } = useLogo();
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';
    const name = user.username || user.email || '';
    const parts = name.split(/[\s@]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link
            href="/"
            className="flex items-center space-x-3 sm:space-x-4 group"
          >
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Logo size="md" className="text-primary" withBackground={true} />
              <div className="block">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {title}
                </h1>
                {state.reason && (
                  <p
                    className="text-xs text-muted-foreground animate-fade-in block"
                    style={{
                      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                      letterSpacing: '0.05em',
                    }}
                    title={state.reason}
                  >
                    {state.reason}
                  </p>
                )}
              </div>
            </div>
          </Link>

          {/* Actions and Theme */}
          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
            {showActions && (
              <>
                <Button
                  onClick={onUploadClick}
                  variant="outline"
                  size="sm"
                  className="hidden md:flex hover-lift"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
                <Button
                  onClick={onCreateJobClick}
                  size="sm"
                  disabled={disabledJobButton}
                  className="hidden md:flex hover-lift glow-primary"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Create Job
                </Button>
              </>
            )}

            <ThemeSwitcher />

            {/* User Avatar Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.username}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      {user.role && (
                        <p className="text-xs leading-none text-muted-foreground mt-1">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {user.role.charAt(0).toUpperCase() +
                              user.role.slice(1)}
                          </span>
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="cursor-not-allowed">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="cursor-not-allowed">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
