"use client"

import { AuthUIProvider } from "@daveyplate/better-auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

// Mock auth client for now - will be replaced with real better-auth client
const mockAuthClient = {
  // This will be replaced with actual better-auth client
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  getSession: async () => ({ data: null }),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <AuthUIProvider
      authClient={mockAuthClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Clear router cache (protected routes)
        router.refresh()
      }}
      Link={Link}
    >
      {children}
    </AuthUIProvider>
  )
}