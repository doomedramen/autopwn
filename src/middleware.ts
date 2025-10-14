import { NextRequest, NextResponse } from 'next/server';

// Feature flag to disable authentication for testing
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/api/auth',
    '/api/init',
    '/login',
    '/setup',
    '/change-password',
    '/_next',
    '/favicon.ico',
  ];

  // If auth is disabled, allow all requests to proceed
  if (DISABLE_AUTH) {
    return NextResponse.next();
  }

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Skip authentication for public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For the root path, check if system is initialized and if user needs password change
  if (pathname === '/') {
    try {
      // Check if system is initialized by calling the API
      const baseUrl = request.nextUrl.origin;
      const response = await fetch(`${baseUrl}/api/init`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.initialized) {
          // System not initialized, redirect to setup
          const setupUrl = new URL('/setup', request.url);
          return NextResponse.redirect(setupUrl);
        }
      }

      // Check if authenticated user requires password change
      const userResponse = await fetch(`${baseUrl}/api/auth/user`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user?.requirePasswordChange) {
          // User requires password change, redirect to change password page
          const changePasswordUrl = new URL('/change-password', request.url);
          return NextResponse.redirect(changePasswordUrl);
        }
      }
    } catch (error) {
      // If we can't check system status or user data, allow request to proceed
      console.error(
        'Failed to check system initialization or user status in middleware:',
        error
      );
    }
  }

  // Check if there's a session token
  const sessionToken = request.cookies.get('better-auth.session_token')?.value;

  // If no session, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For authenticated requests, allow them to proceed
  // Individual pages will handle their own authentication checks
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
