import { NextResponse } from 'next/server';
import { getAllJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobs = getAllJobs();
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
