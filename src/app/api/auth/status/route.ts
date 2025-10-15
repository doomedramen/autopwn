import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    disabled: false,
    message: 'Authentication is enabled',
  });
}
