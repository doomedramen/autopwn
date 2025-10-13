import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crackedPasswords, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Get cracked passwords for a specific network
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: networkId } = await params;

    if (!networkId) {
      return NextResponse.json(
        { error: 'Network ID is required' },
        { status: 400 }
      );
    }

    // Get all cracked passwords for this network with job information
    const passwords = await db.query.crackedPasswords.findMany({
      where: eq(crackedPasswords.networkId, networkId),
      with: {
        job: {
          columns: {
            id: true,
            name: true,
            createdAt: true,
            completedAt: true
          }
        }
      },
      orderBy: (crackedPasswords, { desc }) => [desc(crackedPasswords.crackedAt)]
    });

    return NextResponse.json({
      success: true,
      data: passwords
    });

  } catch (error) {
    console.error('Failed to fetch cracked passwords:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cracked passwords',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
