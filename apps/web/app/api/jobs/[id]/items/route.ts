import { NextResponse } from 'next/server';
import { getJobItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id);
    const items = getJobItems(jobId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch job items:', error);
    return NextResponse.json({ error: 'Failed to fetch job items' }, { status: 500 });
  }
}
