'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/Logo';
import { useLogo } from '@/components/logo';
import { useEffect } from 'react';

// Extend Window interface for login timeout tracking
declare global {
  interface Window {
    __loginTimeout?: NodeJS.Timeout;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { data: session, isPending } = useSession();
  const { setFace, setTemporaryFace } = useLogo();

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  // If user is already authenticated, redirect them
  useEffect(() => {
    if (session && !isPending) {
      // Clear login timeout if it exists
      if (window.__loginTimeout) {
        clearTimeout(window.__loginTimeout);
        window.__loginTimeout = undefined;
      }

      toast.success('Login successful!');
      setTemporaryFace('HAPPY', 3000, 'I love my friends!');
      router.push(redirect);
    }
  }, [session, isPending, router, redirect, setTemporaryFace]);

  // Set initial logo state for login page
  useEffect(() => {
    setFace('AWAKE', "Hi, I'm Pwnagotchi! Starting ...");
  }, [setFace]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (window.__loginTimeout) {
        clearTimeout(window.__loginTimeout);
        window.__loginTimeout = undefined;
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFace('INTENSE', 'Reading last session logs ...');

    try {
      const { error } = await signIn.email({
        email,
        password,
        callbackURL: redirect,
      });

      // Check if sign-in failed
      if (error) {
        let errorMessage: string;

        // SECURITY: Use generic messages for authentication failures to prevent account enumeration
        // Never reveal whether an email exists or if the password was wrong
        if (error.status === 401 || error.status === 403) {
          // Authentication or authorization failed
          if (
            error.message?.toLowerCase().includes('too many') ||
            error.message?.toLowerCase().includes('rate limit')
          ) {
            errorMessage = 'Too many login attempts. Please try again later';
          } else if (error.message?.toLowerCase().includes('verify')) {
            errorMessage = 'Please verify your email address before signing in';
          } else {
            // Generic message for wrong credentials (could be wrong email OR wrong password)
            errorMessage = 'Invalid email or password';
          }
        } else if (error.status === 500 || error.status === 503) {
          // Server/database errors
          errorMessage =
            'Service temporarily unavailable. Please try again in a moment';
        } else {
          // Other errors - show a generic message
          errorMessage = error.message || 'Unable to sign in. Please try again';
        }

        setError(errorMessage);
        toast.error(errorMessage);
        setFace('SAD', "I'm mad at you!");
        setIsLoading(false);
        return;
      }

      // Sign-in succeeded, wait for session with timeout
      // The session hook will detect the change, but we need a fallback
      window.__loginTimeout = setTimeout(() => {
        // If we're still loading after 10 seconds, something went wrong
        setError(
          'Login is taking longer than expected. The authentication service may be unavailable. Please try again'
        );
        toast.error('Login timeout - service may be unavailable');
        setFace('SAD', 'Connection timeout!');
        setIsLoading(false);
      }, 10000); // 10 second timeout
    } catch (error: unknown) {
      // Network or unexpected errors
      let errorMessage: string;

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('fetch') || msg.includes('network')) {
          errorMessage =
            'Cannot connect to server. Please check your connection and try again';
        } else if (msg.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again';
        } else {
          errorMessage = 'An unexpected error occurred. Please try again';
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again';
      }

      setError(errorMessage);
      toast.error(errorMessage);
      setFace('SAD', "I'm mad at you!");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 animate-scale-in">
            <Logo size="lg" className="text-primary" />
          </div>
          <div className="hidden" data-testid="login-page-title">
            <h1 className="text-3xl font-bold" data-testid="autopwn-title">
              AutoPWN
            </h1>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>

        <Card className="animate-slide-up">
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@autopwn.local"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFace('SLEEP', 'Zzzzz')}
                  onBlur={() => setFace('AWAKE', 'Ready to login')}
                  required
                  disabled={isLoading}
                  data-testid="password-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full hover-lift focus-ring"
                disabled={isLoading}
                data-testid="login-button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/setup"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                First time setup? Initialize your system
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4 animate-scale-in">
                <Logo size="lg" className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
              <p className="text-muted-foreground">Loading...</p>
            </div>
            <Card className="animate-slide-up">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
