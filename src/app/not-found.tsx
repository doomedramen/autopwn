import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, Wifi } from 'lucide-react';

// Force dynamic rendering to prevent HTML import errors during build
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        <div className="flex justify-center space-x-4">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <Wifi className="h-12 w-12 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold">404</h1>
          <h2 className="text-xl font-semibold text-muted-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The WiFi network analysis page you&apos;re looking for doesn&apos;t
            exist or has been moved.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/">Return to Dashboard</Link>
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          If &quot;you&quot; believe this is an error, please contact your
          system administrator.
        </p>
      </div>
    </div>
  );
}
