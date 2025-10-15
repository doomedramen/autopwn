import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { networks } from '@/lib/db/schema';

/**
 * Get all networks
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all networks without redundant filters
    const networkList = await db.query.networks.findMany({
      orderBy: (networks, { desc }) => [desc(networks.createdAt)],
    });

    console.log(`🌐 Networks API: Found ${networkList.length} networks`);
    console.log('📊 Network data:', JSON.stringify(networkList, null, 2));

    // Add debug info if no networks found
    if (networkList.length === 0) {
      console.log('🔍 Debug: No networks found. Checking uploads table...');
      const { uploads } = await import('@/lib/db/schema');
      const allUploads = await db.query.uploads.findMany();
      console.log(`📦 Found ${allUploads.length} uploads`);

      // Check if any uploads have networks
      for (const upload of allUploads) {
        const uploadNetworks = await db.query.networks.findMany({
          where: (networks, { eq }) => eq(networks.uploadId, upload.id),
        });
        console.log(
          `📶 Upload ${upload.id} (${upload.filename}): ${uploadNetworks.length} networks`
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: networkList,
      debug: {
        totalNetworks: networkList.length,
        hasHandshakeCount: networkList.filter(n => n.hasHandshake).length,
      },
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
