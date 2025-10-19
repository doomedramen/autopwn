'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Wifi, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    // eslint-disable-next-line no-console
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        <div className="flex justify-center space-x-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <Shield className="h-12 w-12 text-muted-foreground" />
          <Wifi className="h-12 w-12 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-destructive">Error</h1>
          <h2 className="text-xl font-semibold text-muted-foreground">
            Something went wrong
          </h2>
          <p className="text-muted-foreground">
            {error.message ||
              'An unexpected error occurred in the AutoPWN application.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/">Return to Dashboard</Link>
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left text-sm text-muted-foreground border rounded p-3">
            <summary className="cursor-pointer font-medium">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </details>
        )}

        <p className="text-sm text-muted-foreground">
          If the problem persists, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}
