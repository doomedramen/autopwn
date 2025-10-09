import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of protected routes that require authentication
const protectedRoutes = ['/', '/analytics', '/jobs', '/results', '/dictionaries'];

// List of auth routes that should redirect to home if already authenticated
const authRoutes = ['/auth/login', '/auth/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;


  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname === route);
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // For authentication, we'll check the session by making a request to the backend
  // But since this is middleware running on the edge, we need to use cookies
  // Better Auth uses 'better-auth.session_token' by default
  const sessionCookie = request.cookies.get('better-auth.session_token')?.value ||
                        request.cookies.get('session_token')?.value ||
                        request.cookies.get('better-auth-session')?.value;

  // Validate that the session cookie looks like a valid Better Auth session token
  // Better Auth session tokens are typically base64 encoded JSON
  const isValidSessionCookie = sessionCookie &&
    sessionCookie.length > 20 && // Basic length check
    !sessionCookie.includes('invalid') && // Check for common invalid tokens
    !sessionCookie.includes('undefined') &&
    !sessionCookie.includes('null');


  if (isProtectedRoute && !isValidSessionCookie) {
    // No valid session cookie and trying to access protected route
    // Clear any invalid cookies and redirect to login
    const response = NextResponse.redirect(new URL('/auth/login', request.url));

    // Clear potentially invalid cookies
    response.cookies.delete('better-auth.session_token');
    response.cookies.delete('session_token');
    response.cookies.delete('better-auth-session');

    return response;
  }

  if (isAuthRoute && isValidSessionCookie) {
    // Has valid session cookie and trying to access auth route
    // Redirect to home
        const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

    return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};