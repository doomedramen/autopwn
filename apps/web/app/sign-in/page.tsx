'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Sign in failed')
      }

      // Redirect to home page after successful sign in
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* AutoPWN Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
              <svg className="h-8 w-8 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-3.5l6-4.5-6-4.5v9z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono uppercase tracking-wider text-foreground" data-testid="branding-title">
                AutoPWN
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                Network Security Platform
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-lg p-6" data-testid="signin-form-container">
          <h2 className="text-xl font-semibold mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                data-testid="signin-email-input"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                data-testid="signin-password-input"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded" data-testid="signin-error-message">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="signin-submit-button">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center" data-testid="signup-link-container">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                href="/sign-up"
                className="text-primary hover:underline font-medium"
                data-testid="signup-link"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
