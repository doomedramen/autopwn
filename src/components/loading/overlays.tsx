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
        <div className='absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg border animate-fade-in'>
          <div className='flex flex-col items-center space-y-4 p-6'>
            <div className='relative'>
              <Spinner size='lg' />
              <div className='absolute inset-0 rounded-full border-2 border-primary/20 animate-ping' />
            </div>
            {message && (
              <p className='text-base text-muted-foreground animate-pulse font-medium'>{message}</p>
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
    <div className={cn('flex min-h-screen items-center justify-center animate-fade-in', className)}>
      <div className='flex flex-col items-center space-y-6 max-w-md mx-auto p-8'>
        <div className='relative'>
          <Spinner size='lg' />
          <div className='absolute inset-0 rounded-full border-4 border-primary/10 animate-ping' />
          <div className='absolute inset-0 rounded-full border-2 border-primary/20 animate-ping animation-delay-200' />
        </div>
        <div className='text-center space-y-3'>
          <h2 className='text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent animate-slide-up'>
            {message}
          </h2>
          <p className='text-base text-muted-foreground animate-slide-up animation-delay-100'>
            Please wait while we load your data
          </p>
        </div>
        <div className='flex space-x-1 animate-slide-up animation-delay-200'>
          <div className='w-2 h-2 bg-primary rounded-full animate-bounce' />
          <div className='w-2 h-2 bg-primary rounded-full animate-bounce animation-delay-100' />
          <div className='w-2 h-2 bg-primary rounded-full animate-bounce animation-delay-200' />
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