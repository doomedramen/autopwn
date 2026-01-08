"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { SkullIcon } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
        credentials: "include",
      });

      const data = await response.json();

      // Better Auth returns 200 OK even for errors - check for error code in response
      if (data.code) {
        throw new Error(data.message || "Sign up failed");
      }

      // Better Auth automatically signs in users after successful sign-up
      // Redirect to dashboard
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* CrackHouse Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <SkullIcon size={48} />
            <div>
              <h1
                className="text-2xl font-bold font-mono uppercase tracking-wider text-foreground"
                data-testid="branding-title"
              >
                CrackHouse
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                Network Security Platform
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-card rounded-lg shadow-lg p-6"
          data-testid="signup-form-container"
        >
          <h2 className="text-xl font-semibold mb-6">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                data-testid="signup-name-input"
              />
            </div>

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
                data-testid="signup-email-input"
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
                data-testid="signup-password-input"
              />
            </div>

            {error && (
              <div
                className="text-sm text-destructive bg-destructive/10 p-3 rounded"
                data-testid="signup-error-message"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="signup-submit-button"
            >
              {loading ? "Creating account..." : "Create an account"}
            </Button>
          </form>

          {/* Sign in link */}
          <div className="mt-6 text-center" data-testid="signin-link-container">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-primary hover:underline font-medium"
                data-testid="signin-link"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
