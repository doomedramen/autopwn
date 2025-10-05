import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.INPUT_PATH || '/data/input';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedFiles: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Validate file extension
        const filename = file.name;
        const validExtensions = ['.pcap', '.pcapng', '.cap'];
        const hasValidExtension = validExtensions.some(ext =>
          filename.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          errors.push(`${filename}: Invalid file type. Only .pcap, .pcapng, .cap files are allowed`);
          continue;
        }

        // Read file as buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Write to input directory
        const filepath = join(UPLOAD_DIR, filename);
        await writeFile(filepath, buffer);

        uploadedFiles.push(filename);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: uploadedFiles.length > 0,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
