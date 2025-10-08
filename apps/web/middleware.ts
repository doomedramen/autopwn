import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of protected routes that require authentication
const protectedRoutes = ['/', '/analytics', '/jobs', '/results'];

// List of auth routes that should redirect to home if already authenticated
const authRoutes = ['/auth/login', '/auth/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`[MIDDLEWARE] Processing request: ${pathname}`);

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname === route);
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // For authentication, we'll check the session by making a request to the backend
  // But since this is middleware running on the edge, we need to use cookies
  const sessionCookie = request.cookies.get('better-auth.session_token')?.value;

  console.log(`[MIDDLEWARE] Protected: ${isProtectedRoute}, Auth route: ${isAuthRoute}, Has session: ${!!sessionCookie}`);

  if (isProtectedRoute && !sessionCookie) {
    // No session cookie and trying to access protected route
    // Redirect to login
    console.log(`[MIDDLEWARE] Redirecting to login - no session cookie found`);
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionCookie) {
    // Has session cookie and trying to access auth route
    // Redirect to home
    console.log(`[MIDDLEWARE] Redirecting to home - user already authenticated`);
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  console.log(`[MIDDLEWARE] Allowing request to proceed`);
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