import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get all dictionaries
 */
export async function GET() {
  try {
    const dictionaryList = await db.query.uploads.findMany({
      where: eq(uploads.uploadType, 'dictionary'),
      columns: {
        id: true,
        filename: true,
        originalName: true,
        fileSize: true,
        fileChecksum: true,
        mimeType: true,
        metadata: true,
        createdAt: true
      },
      orderBy: (uploads, { desc }) => [desc(uploads.createdAt)]
    });

    // Transform metadata to include lineCount and other info if available
    const enrichedDictionaries = dictionaryList.map(dict => {
      const metadata = dict.metadata as Record<string, unknown> || {};
      return {
        ...dict,
        lineCount: (metadata.lineCount as number) || 0,
        uniqueWordCount: (metadata.uniqueWordCount as number) || 0,
        encoding: (metadata.encoding as string) || 'utf8',
        isCompressed: (metadata.isCompressed as boolean) || false,
        compressionType: (metadata.compressionType as string) || undefined,
        // Add additional metadata fields
        avgWordLength: (metadata.avgWordLength as number) || 0,
        minWordLength: (metadata.minWordLength as number) || 0,
        maxWordLength: (metadata.maxWordLength as number) || 0,
        quality: metadata.quality || {},
        sample: metadata.sample || { words: [], count: 0 }
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedDictionaries
    });

  } catch (error) {
    console.error('Dictionaries fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dictionaries',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}