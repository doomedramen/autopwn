import { NextResponse } from 'next/server';
import { getAllDictionaries } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dictionaries = getAllDictionaries();
    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('Failed to fetch dictionaries:', error);
    return NextResponse.json({ error: 'Failed to fetch dictionaries' }, { status: 500 });
  }
}
