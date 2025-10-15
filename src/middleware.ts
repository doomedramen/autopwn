import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Add CORS headers for all responses
  const response = NextResponse.next();

  // Get the origin from the request or use a fallback
  const origin = request.headers.get('origin') || request.nextUrl.origin;

  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie'
  );
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }

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

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Skip authentication for public routes
  if (isPublicRoute) {
    return response;
  }

  // For the root path, check if system is initialized and if user needs password change
  if (pathname === '/') {
    try {
      // Check if system is initialized by calling the API
      const baseUrl = request.nextUrl.origin;
      const initResponse = await fetch(`${baseUrl}/api/init`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });

      if (initResponse.ok) {
        const data = await initResponse.json();
        if (!data.initialized) {
          // System not initialized, redirect to setup
          const setupUrl = new URL('/setup', request.url);
          const redirectResponse = NextResponse.redirect(setupUrl);
          // Copy CORS headers
          redirectResponse.headers.set('Access-Control-Allow-Origin', origin);
          redirectResponse.headers.set(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, OPTIONS'
          );
          redirectResponse.headers.set(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, Cookie'
          );
          redirectResponse.headers.set(
            'Access-Control-Allow-Credentials',
            'true'
          );
          return redirectResponse;
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
          const redirectResponse = NextResponse.redirect(changePasswordUrl);
          // Copy CORS headers
          redirectResponse.headers.set('Access-Control-Allow-Origin', origin);
          redirectResponse.headers.set(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, OPTIONS'
          );
          redirectResponse.headers.set(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, Cookie'
          );
          redirectResponse.headers.set(
            'Access-Control-Allow-Credentials',
            'true'
          );
          return redirectResponse;
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
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Copy CORS headers
    redirectResponse.headers.set('Access-Control-Allow-Origin', origin);
    redirectResponse.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    redirectResponse.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookie'
    );
    redirectResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    return redirectResponse;
  }

  // For authenticated requests, allow them to proceed
  // Individual pages will handle their own authentication checks
  return response;
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
