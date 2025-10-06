import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const INPUT_PATH = process.env.INPUT_PATH || '/data/input';

interface CaptureFile {
  name: string;
  size: number;
  uploadedAt: number;
}

export async function GET() {
  try {
    const files: CaptureFile[] = [];

    try {
      const entries = await readdir(INPUT_PATH);

      for (const entry of entries) {
        const filePath = join(INPUT_PATH, entry);
        const stats = await stat(filePath);

        if (stats.isFile() && (entry.endsWith('.pcap') || entry.endsWith('.pcapng') || entry.endsWith('.cap'))) {
          files.push({
            name: entry,
            size: stats.size,
            uploadedAt: stats.mtime.getTime(),
          });
        }
      }

      // Sort by upload time (newest first)
      files.sort((a, b) => b.uploadedAt - a.uploadedAt);

    } catch (error) {
      // Directory doesn't exist or can't be read
      console.log('Input directory not accessible:', error);
    }

    return NextResponse.json(files);
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

    const filePath = join(INPUT_PATH, filename);

    try {
      await unlink(filePath);
      return NextResponse.json({ success: true });
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