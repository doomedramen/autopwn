import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.INPUT_PATH || '/data/input';
console.log('[DEBUG] Upload directory:', UPLOAD_DIR);

export async function POST(request: NextRequest) {
  try {
    console.log('[DEBUG] Upload API called');
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    console.log('[DEBUG] Upload request files count:', files.length);
    if (files.length > 0) {
      console.log('[DEBUG] Upload file details:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    }

    if (!files || files.length === 0) {
      console.log('[DEBUG] No files provided in upload request');
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
        console.log('[DEBUG] Writing file to:', filepath);
        
        // Ensure directory exists
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          console.log('[DEBUG] Creating upload directory:', dir);
          fs.mkdirSync(dir, { recursive: true });
        }
        
        await writeFile(filepath, buffer);
        console.log('[DEBUG] File written successfully:', filename);

        uploadedFiles.push(filename);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const response = {
      success: uploadedFiles.length > 0,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    console.log('[DEBUG] Upload response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[DEBUG] Upload error:', error);
    console.error('[DEBUG] Upload error details:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
