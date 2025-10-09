import type { Metadata } from 'next'
import './globals.css'
import '@/lib/crypto-polyfill'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'AutoPWN (⌐■_■) - WiFi Handshake Cracker',
  description: 'Automated WPA/WPA2 handshake cracking dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <main className="min-h-screen flex flex-col">
              {children}
            </main>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
