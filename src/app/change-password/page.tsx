'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Key, Lock, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';
import { UniversalHeader } from '@/components/universal-header';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile update form
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setUsername(user.username);
    }
  }, [user]);

  // Redirect if user doesn't need to change password
  useEffect(() => {
    if (user && !user.requirePasswordChange) {
      router.push('/');
    }
  }, [user, router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        toast.success('Password updated successfully!');
        await refreshUser();

        // Redirect after a short delay with fallback
        setTimeout(() => {
          try {
            router.push('/');
            // If router.push doesn't work, use fallback
            setTimeout(() => {
              window.location.href = '/';
            }, 1000);
          } catch (error) {
            // Fallback: force page reload to go to root
            window.location.href = '/';
          }
        }, 2000);
      } else {
        setError(data.error || 'Failed to update password');
        toast.error(data.error || 'Failed to update password');
      }
    } catch {
      const errorMessage = 'Failed to update password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'profile',
          email,
          username,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Profile updated successfully!');
        await refreshUser();
      } else {
        setError(data.error || 'Failed to update profile');
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      const errorMessage = 'Failed to update profile';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <UniversalHeader title="AutoPWN" />
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <UniversalHeader title="AutoPWN" />
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold">Password Updated!</h1>
              <p className="text-muted-foreground">
                Your account is now secured
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="text-lg font-semibold text-green-600">
                    Success!
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-muted-foreground">
                        Your password has been changed successfully.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        You will be redirected to the dashboard shortly...
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        // Use multiple redirect methods for maximum compatibility
                        try {
                          router.push('/');
                          // Fallback immediate redirect if router doesn't work
                          setTimeout(() => {
                            window.location.href = '/';
                          }, 100);
                        } catch (error) {
                          // Force redirect
                          window.location.href = '/';
                        }
                      }}
                      className="w-full"
                    >
                      Go to Dashboard Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UniversalHeader title="AutoPWN" />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <Lock className="h-8 w-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold">Welcome to AutoPWN</h1>
            <p className="text-muted-foreground">
              You must change your password to continue
            </p>
          </div>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 mb-6">
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-blue-900 dark:text-blue-100 font-medium">
              You must change your password before accessing the dashboard.
              Please choose a strong password that you haven&apos;t used before.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Password Change Form */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Key className="h-5 w-5 text-orange-600" />
                  </div>
                  <span>Change Password</span>
                </CardTitle>
                <CardDescription className="text-base">
                  Set a new secure password for your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription className="font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="currentPassword"
                      className="text-base font-medium"
                    >
                      Current Password
                    </Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 focus-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="newPassword"
                      className="text-base font-medium"
                    >
                      New Password
                    </Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="Enter new password (min 8 characters)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                      className="h-11 focus-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-base font-medium"
                    >
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 focus-ring"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full hover-lift glow-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Profile Update Form */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <span>Update Profile</span>
                </CardTitle>
                <CardDescription className="text-base">
                  Update your email and username
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 focus-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-base font-medium">
                      Username
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={3}
                      className="h-11 focus-ring"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full hover-lift"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Profile...
                      </>
                    ) : (
                      'Update Profile'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
