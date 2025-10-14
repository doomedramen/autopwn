'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Loader2, Key } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/Logo';

interface SuperUserData {
  userId: string;
  username: string;
  email: string;
  password: string;
  role: string;
  requirePasswordChange: boolean;
}

export default function SetupPage() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [superUser, setSuperUser] = useState<SuperUserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkInitializationStatus();
  }, []);

  const checkInitializationStatus = async () => {
    try {
      const response = await fetch('/api/init');
      const data = await response.json();

      if (data.initialized && data.hasSuperUser) {
        setIsInitialized(true);
      } else {
        setIsInitialized(false);
      }
    } catch {
      console.error('Failed to check initialization status');
      setError('Failed to check system status');
    }
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const response = await fetch('/api/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuperUser(data.data);
        setIsInitialized(true);
        toast.success('System initialized successfully!');

        // Show credentials in console as well
        console.log('🔐 Initial Superuser Credentials:');
        console.log(`   Email: ${data.data.email}`);
        console.log(`   Password: ${data.data.password}`);
        console.log(`   Username: ${data.data.username}`);
        console.log(
          '⚠️  Please save these credentials and change them after first login!'
        );
      } else {
        setError(data.error || 'Initialization failed');
        toast.error(data.error || 'Initialization failed');
      }
    } catch (_error) {
      const errorMessage = 'Failed to initialize system';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-muted-foreground">Checking system status...</p>
        </div>
      </div>
    );
  }

  if (isInitialized && !superUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1
              className="text-3xl font-bold mb-2"
              data-testid="system-ready-title"
            >
              System Ready
            </h1>
            <p className="text-muted-foreground">
              Your AutoPWN instance is already configured
            </p>
          </div>

          <Card className="animate-slide-up">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    System Already Initialized. The system has already been set
                    up.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    If you need to reset the system, please contact your system
                    administrator or clear the database.
                  </AlertDescription>
                </Alert>

                <Button asChild className="w-full hover-lift focus-ring">
                  <Link href="/login">Go to Login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (superUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Logo size="lg" className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">AutoPWN</h1>
            <p className="text-muted-foreground">
              WiFi Network Analysis Platform
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Initialization Complete!</span>
              </CardTitle>
              <CardDescription>
                Your superuser account has been created. Save these credentials
                securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-yellow-200 bg-yellow-50">
                <Key className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">🔐 Superuser Credentials:</p>
                  <div className="bg-white p-4 rounded border font-mono text-sm space-y-2">
                    <div data-testid="superuser-email">
                      <strong>Email:</strong> {superUser.email}
                    </div>
                    <div data-testid="superuser-password">
                      <strong>Password:</strong>{' '}
                      <span className="text-red-600 font-bold">
                        {superUser.password}
                      </span>
                    </div>
                    <div data-testid="superuser-username">
                      <strong>Username:</strong> {superUser.username}
                    </div>
                    <div data-testid="superuser-role">
                      <strong>Role:</strong> {superUser.role}
                    </div>
                  </div>
                  <p className="text-red-600 font-semibold">
                    ⚠️ IMPORTANT: Save these credentials now! You will be
                    required to change them on first login.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="flex space-x-4">
                <Button asChild className="flex-1">
                  <Link href="/login">Go to Login</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Email: ${superUser.email}\nPassword: ${superUser.password}\nUsername: ${superUser.username}`
                    );
                    toast.success('Credentials copied to clipboard');
                  }}
                >
                  Copy Credentials
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo size="lg" className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold">AutoPWN</h1>
          <p className="text-muted-foreground">
            WiFi Network Analysis Platform
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Initialize System</CardTitle>
            <CardDescription>
              Set up your AutoPWN instance by creating the initial superuser
              account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will create the first superuser account with randomly
                generated credentials. You will be required to change these
                credentials on first login.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full"
              data-testid="initialize-system-button"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Initialize System'
              )}
            </Button>

            {/* <div className="text-center">
              <p className="text-sm text-muted-foreground">
                First time setup? Initialize your system above.
              </p>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
