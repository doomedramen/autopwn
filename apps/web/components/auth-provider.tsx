'use client'

import { AuthProvider as BetterAuthReactProvider } from 'better-auth/react'
import { authClient } from '@/lib/auth'
import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <BetterAuthReactProvider
      authClient={authClient}
      onSessionChange={() => {
        router.refresh()
      }}
      navigate={router.push}
      Link={Link}
    >
      {children}
    </BetterAuthReactProvider>
  )
}