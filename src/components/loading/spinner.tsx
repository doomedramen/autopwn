'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner as ShadcnSpinner } from '@/components/ui/spinner';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-6',
    lg: 'size-8'
  };

  return <ShadcnSpinner className={cn(sizeClasses[size], className)} />;
}

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loading({ message, size = 'md', className }: LoadingProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Spinner size={size} />
      {message && (
        <span className='text-sm text-muted-foreground'>{message}</span>
      )}
    </div>
  );
}

export default Spinner;