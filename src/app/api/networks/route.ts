import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { networks } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

/**
 * Get all networks
 */
export async function GET() {
  try {
    // Start with a simple query without relations
    const networkList = await db.query.networks.findMany({
      where: isNotNull(networks.bssid),
      orderBy: (networks, { desc }) => [desc(networks.createdAt)],
    });

    return NextResponse.json({
      success: true,
      data: networkList,
    });
  } catch (error) {
    console.error('Networks fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch networks',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
