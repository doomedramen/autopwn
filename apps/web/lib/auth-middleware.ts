import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // If user is not authenticated and trying to access protected routes
  if (!session && request.nextUrl.pathname.startsWith("/auth")) {
    // Allow access to auth pages
    return NextResponse.next();
  }

  if (!session && request.nextUrl.pathname !== "/auth/login" && request.nextUrl.pathname !== "/auth/signup") {
    // Redirect to login page
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // If user is authenticated and trying to access auth pages
  if (session && request.nextUrl.pathname.startsWith("/auth")) {
    // Redirect to dashboard
    return NextResponse.redirect(new URL("/", request.url));
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
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};