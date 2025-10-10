import { NextResponse } from 'next/server';

/**
 * Runtime configuration endpoint
 * This allows the frontend to fetch API URLs at runtime instead of build time
 * Critical for Docker deployments where the API URL changes per environment
 */
export async function GET() {
  const config = {
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    wsUrl: process.env.WS_URL || process.env.NEXT_PUBLIC_WS_URL,
  };

  return NextResponse.json(config);
}
