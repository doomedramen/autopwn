import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoPWN - WiFi Handshake Cracker',
  description: 'Automated WPA/WPA2 handshake cracking dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <header className="bg-gray-900 border-b border-gray-800">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-green-400">AutoPWN</h1>
            <p className="text-sm text-gray-400">WiFi Handshake Cracker</p>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
