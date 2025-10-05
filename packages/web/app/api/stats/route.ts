import { NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
