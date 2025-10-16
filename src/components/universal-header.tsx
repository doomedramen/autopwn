'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Logo } from '@/components/logo';
import { useLogo } from '@/components/logo';
import { Shield, Wifi } from 'lucide-react';

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
          </div>
        </div>
      </div>
    </header>
  );
}
