import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Disable static generation for error pages to prevent HTML import issues
  generateEtags: false,
  poweredByHeader: false,

  // Skip static generation for specific routes
  skipTrailingSlashRedirect: true,

  // Configure experimental features
  experimental: {
    // Limit JSON payload size to prevent DoS attacks
    // Note: File uploads use multipart/form-data, not JSON
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Add runtime configuration for API URLs
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ];
  },

  // Add security headers and CORS configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Cookie',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          {
            // Prevent clickjacking attacks
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Prevent MIME type sniffing
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Enable browser XSS protection
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // Referrer policy for privacy
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Permissions policy
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
