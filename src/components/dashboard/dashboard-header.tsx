'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Upload, Play } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Logo } from '@/components/ui/Logo';

interface DashboardHeaderProps {
  onUploadClick: () => void;
  onCreateJobClick: () => void;
  disabledJobButton: boolean;
}

export function DashboardHeader({
  onUploadClick,
  onCreateJobClick,
  disabledJobButton,
}: DashboardHeaderProps) {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Logo size="md" className="text-primary" />
              <div>
                <span className="text-2xl font-bold">AutoPWN</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button onClick={onUploadClick} className="hidden md:flex">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
            <Button
              onClick={onCreateJobClick}
              className="hidden md:flex"
              disabled={disabledJobButton}
            >
              <Play className="h-4 w-4 mr-2" />
              Create Job
            </Button>

            <Separator orientation="vertical" className="h-8 hidden md:block" />

            <ThemeSwitcher />

            {/* <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted">
                <Settings className="h-4 w-4" />
              </AvatarFallback>
            </Avatar> */}
          </div>
        </div>
      </div>
    </header>
  );
}
