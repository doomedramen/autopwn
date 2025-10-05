import { NextResponse } from 'next/server';
import { getAllResults } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = getAllResults();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed to fetch results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
