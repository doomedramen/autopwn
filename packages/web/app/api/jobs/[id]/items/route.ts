import { NextResponse } from 'next/server';
import { getJobItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = parseInt(params.id);
    const items = getJobItems(jobId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch job items:', error);
    return NextResponse.json({ error: 'Failed to fetch job items' }, { status: 500 });
  }
}
