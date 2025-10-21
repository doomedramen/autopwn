import { AuthView } from "@daveyplate/better-auth-ui"
import { authViewPaths } from "@daveyplate/better-auth-ui/server"
import { redirect } from "next/navigation"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({
  params
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  // Redirect sign-up attempts to sign-in since public sign-up is disabled
  if (path === "sign-up") {
    redirect("/auth/sign-in")
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* AutoPWN Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
              <svg className="h-8 w-8 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-3.5l6-4.5-6-4.5v9z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono uppercase tracking-wider text-foreground">
                AutoPWN
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                Network Security Platform
              </p>
            </div>
          </div>
        </div>

        {/* Auth View */}
        <AuthView path={path} />
      </div>
    </main>
  )
}