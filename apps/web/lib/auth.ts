import { createAuthClient } from 'better-auth/react'

// Use the web server's origin so cookies work correctly
// Next.js rewrites will proxy /api/auth/* to the backend API server
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/auth',
  // Enable all the features you need
  features: {
    // Enable social providers if needed
  },
})