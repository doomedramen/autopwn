/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  output: 'standalone', // Enable standalone output for Docker builds
  // Don't set NEXT_PUBLIC_API_URL - use the Next.js rewrite proxy instead
  // This ensures cookies work correctly for authentication
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3001'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
