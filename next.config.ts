import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Configure experimental features if needed
  experimental: {
    // This can be helpful for standalone builds
  },

  
  // Add any other config options here
};

export default nextConfig;
