import { NextRequest, NextResponse } from 'next/server';
import { writeFile, appendFile, mkdir, stat, unlink, rename, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { addDictionary } from '@/lib/db';

const DICTIONARIES_PATH = process.env.DICTIONARIES_PATH || '/data/dictionaries';
const TEMP_UPLOAD_PATH = process.env.TEMP_UPLOAD_PATH || '/tmp/dict-uploads';

// Hashcat-compatible dictionary file extensions
const ALLOWED_EXTENSIONS = [
  '.txt',
  '.dic',
  '.lst',
  '.gz',
  '.bz2',
  '.lzma',
  '.xz',
  '.7z',
  '.zip',
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const filename = formData.get('filename') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);

    if (!chunk || !filename || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Ensure temp directory exists
    if (!existsSync(TEMP_UPLOAD_PATH)) {
      await mkdir(TEMP_UPLOAD_PATH, { recursive: true });
    }

    // Create a unique temp file for this upload
    const uploadId = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFilePath = path.join(TEMP_UPLOAD_PATH, `${uploadId}.part`);

    // Convert chunk to buffer
    const bytes = await chunk.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Append chunk to temp file
    if (chunkIndex === 0) {
      // First chunk - create new file
      await writeFile(tempFilePath, buffer);
    } else {
      // Subsequent chunks - append
      await appendFile(tempFilePath, buffer);
    }

    console.log(`[Upload] Received chunk ${chunkIndex + 1}/${totalChunks} for ${filename}`);

    // If this is the last chunk, finalize the upload
    if (chunkIndex === totalChunks - 1) {
      const finalPath = path.join(DICTIONARIES_PATH, filename);

      // Ensure dictionaries directory exists
      if (!existsSync(DICTIONARIES_PATH)) {
        await mkdir(DICTIONARIES_PATH, { recursive: true });
      }

      // Move temp file to final location
      // Use copy+delete instead of rename to handle cross-device moves
      try {
        await copyFile(tempFilePath, finalPath);
        await unlink(tempFilePath); // Clean up temp file after successful copy
      } catch (copyError: any) {
        // If copy fails, we still want to clean up the temp file
        if (existsSync(tempFilePath)) {
          await unlink(tempFilePath);
        }
        throw copyError; // Re-throw the original error
      }

      // Get file stats and add to database
      const stats = await stat(finalPath);
      addDictionary(filename, finalPath, stats.size);

      console.log(`[Upload] Completed: ${filename} (${stats.size} bytes)`);

      return NextResponse.json({
        success: true,
        message: 'Upload completed',
        filename,
        size: stats.size,
      });
    }

    // Return success for intermediate chunks
    return NextResponse.json({
      success: true,
      chunkIndex,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}

// Cleanup endpoint to remove incomplete uploads
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    const uploadId = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFilePath = path.join(TEMP_UPLOAD_PATH, `${uploadId}.part`);

    if (existsSync(tempFilePath)) {
      await unlink(tempFilePath);
      console.log(`[Upload] Cleaned up incomplete upload: ${filename}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Upload] Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 }
    );
  }
}
