import { NextResponse } from 'next/server';
import { getAnalytics } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const analytics = getAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
