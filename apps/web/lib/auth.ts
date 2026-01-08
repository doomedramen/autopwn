import { createAuthClient } from 'better-auth/react'

// Use the web server's origin so cookies work correctly
// Next.js rewrites will proxy /api/auth/* to the backend API server
// Build the auth base URL: NEXT_PUBLIC_API_URL + /api/auth
const getAuthBaseURL = () => {
  const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  // Remove trailing slash and append /api/auth
  return apiURL.replace(/\/$/, '') + '/api/auth'
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  // Enable all the features you need
  features: {
    // Enable social providers if needed
  },
})