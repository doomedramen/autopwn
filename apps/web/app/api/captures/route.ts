import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { getPcapEssidMappings, deletePcapEssidMappings } from '@/lib/db';
import { CaptureFile } from '@autopwn/shared';

export const dynamic = 'force-dynamic';

const PCAPS_PATH = process.env.PCAPS_PATH || (process.env.NODE_ENV === 'development' ? './volumes/pcaps' : '/data/pcaps');

export async function GET() {
  try {
    console.log('[DEBUG] Captures API called');
    const files: CaptureFile[] = [];

    try {
      const entries = await readdir(PCAPS_PATH);

      for (const entry of entries) {
        const filePath = join(PCAPS_PATH, entry);
        const stats = await stat(filePath);

        if (stats.isFile() && (entry.endsWith('.pcap') || entry.endsWith('.pcapng') || entry.endsWith('.cap'))) {
          // Get ESSID mappings for this PCAP file
          const essidMappings = getPcapEssidMappings(entry);

          files.push({
            filename: entry,
            size: stats.size,
            uploaded_at: stats.mtime.toISOString(),
            essids: essidMappings.map(mapping => mapping.essid),
          });
        }
      }

      // Sort by upload time (newest first)
      files.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      console.log(`[DEBUG] Found ${files.length} PCAP files`);

    } catch (error) {
      // Directory doesn't exist or can't be read
      console.log('PCAP directory not accessible:', error);
    }

    return NextResponse.json({
      success: true,
      captures: files,
      count: files.length,
    });
  } catch (error) {
    console.error('Error fetching captures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch captures' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    const filePath = join(PCAPS_PATH, filename);

    try {
      // Delete the file
      await unlink(filePath);

      // Delete associated ESSID mappings
      await deletePcapEssidMappings(filename);

      console.log(`[DEBUG] Deleted PCAP file and mappings: ${filename}`);

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${filename} and its ESSID mappings`
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found or could not be deleted' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting capture:', error);
    return NextResponse.json(
      { error: 'Failed to delete capture' },
      { status: 500 }
    );
  }
}