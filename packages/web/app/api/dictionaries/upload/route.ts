import { NextRequest, NextResponse } from 'next/server';
import { writeFile, stat } from 'fs/promises';
import path from 'path';
import { addDictionary } from '@/lib/db';

const DICTIONARIES_PATH = process.env.DICTIONARIES_PATH || '/app/volumes/dictionaries';

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
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedFiles: { name: string; size: number }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const file of files) {
      try {
        // Validate file extension
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          errors.push({
            name: file.name,
            error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
          });
          continue;
        }

        // Check for duplicate filename
        const filePath = path.join(DICTIONARIES_PATH, file.name);

        // Convert file to buffer and write
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Get actual file size
        const stats = await stat(filePath);

        // Add to database
        addDictionary(file.name, filePath, stats.size);

        uploadedFiles.push({
          name: file.name,
          size: stats.size,
        });
      } catch (error: any) {
        errors.push({
          name: file.name,
          error: error.message || 'Failed to upload file',
        });
      }
    }

    return NextResponse.json({
      success: uploadedFiles.length > 0,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
    });
  } catch (error: any) {
    console.error('Dictionary upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload dictionaries' },
      { status: 500 }
    );
  }
}
