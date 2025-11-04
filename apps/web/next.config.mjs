/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  env: process.env.NODE_ENV === 'test' ? {
    NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  } : {},
}

export default nextConfig
