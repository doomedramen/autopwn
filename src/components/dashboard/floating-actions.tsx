'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Play
} from 'lucide-react';

interface FloatingActionsProps {
  networksWithHandshakesCount: number;
  dictionariesCount: number;
  onUploadClick: () => void;
  onCreateJobClick: () => void;
}

export function FloatingActions({
  networksWithHandshakesCount,
  dictionariesCount,
  onUploadClick,
  onCreateJobClick
}: FloatingActionsProps) {
  return (
    <div className="md:hidden fixed bottom-6 right-6 z-50 flex flex-col space-y-2">
      <Button
        onClick={onCreateJobClick}
        size="lg"
        className="rounded-full h-14 w-14 shadow-lg"
        disabled={networksWithHandshakesCount === 0 || dictionariesCount === 0}
      >
        <Play className="h-5 w-5" />
      </Button>
      <Button
        onClick={onUploadClick}
        size="lg"
        variant="outline"
        className="rounded-full h-14 w-14 shadow-lg bg-background"
      >
        <Upload className="h-5 w-5" />
      </Button>
    </div>
  );
}