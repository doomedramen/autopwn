import { NextResponse } from 'next/server';

// Feature flag to disable authentication for testing
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

export async function GET() {
  return NextResponse.json({
    disabled: DISABLE_AUTH,
    message: DISABLE_AUTH
      ? 'Authentication is disabled'
      : 'Authentication is enabled',
  });
}
