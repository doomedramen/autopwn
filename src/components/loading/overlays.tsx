'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({ isLoading, message, children, className }: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className='absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg'>
          <div className='flex flex-col items-center space-y-2'>
            <Spinner size='lg' />
            {message && (
              <p className='text-sm text-muted-foreground animate-pulse'>{message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = 'Loading...', className }: PageLoadingProps) {
  return (
    <div className={cn('flex min-h-screen items-center justify-center', className)}>
      <div className='flex flex-col items-center space-y-4'>
        <Spinner size='lg' />
        <div className='text-center space-y-2'>
          <h2 className='text-lg font-semibold'>{message}</h2>
          <p className='text-sm text-muted-foreground'>Please wait while we load your data</p>
        </div>
      </div>
    </div>
  );
}

interface CenteredLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CenteredLoading({ message, size = 'md', className }: CenteredLoadingProps) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className='flex flex-col items-center space-y-3'>
        <Spinner size={size} />
        {message && (
          <p className='text-sm text-muted-foreground animate-pulse'>{message}</p>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && <div className='mb-4 text-muted-foreground'>{icon}</div>}
      <h3 className='text-lg font-semibold mb-2'>{title}</h3>
      {description && (
        <p className='text-sm text-muted-foreground mb-4 max-w-md'>{description}</p>
      )}
      {action}
    </div>
  );
}