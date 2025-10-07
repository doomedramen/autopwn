import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { addPcapEssidMapping, deletePcapEssidMappings } from '@/lib/db';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

async function extractEssidsFromPcap(pcapPath: string, filename: string): Promise<{ essids: string[], bssids: string[] }> {
  try {
    console.log('[DEBUG] Extracting ESSIDs from PCAP:', pcapPath);

    // Use hcxpcapngtool to extract information
    const { stdout, stderr } = await execAsync(`hcxpcapngtool -o /tmp/${filename}.hc22000 -E /tmp/${filename}.essids "${pcapPath}"`, {
      timeout: 30000 // 30 second timeout
    });

    console.log('[DEBUG] hcxpcapngtool stdout:', stdout);
    if (stderr) {
      console.log('[DEBUG] hcxpcapngtool stderr:', stderr);
    }

    // Parse ESSIDs from the output file
    const fs = require('fs');
    let essidOutput = '';
    try {
      essidOutput = fs.readFileSync(`/tmp/${filename}.essids`, 'utf8');
    } catch (error) {
      console.log('[DEBUG] No ESSID file created, trying direct parsing...');
    }

    const essids: string[] = [];
    const bssids: string[] = [];

    if (essidOutput) {
      // Parse ESSIDs from the file
      const lines = essidOutput.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          // Extract ESSID from hcxtools output format
          const match = line.match(/^([a-f0-9:]+)\s+(.+)$/);
          if (match) {
            const bssid = match[1];
            const essid = match[2].trim();
            if (essid && !essids.includes(essid)) {
              essids.push(essid);
            }
            if (bssid && !bssids.includes(bssid)) {
              bssids.push(bssid);
            }
          }
        }
      }
    }

    // Clean up temporary files
    try {
      fs.unlinkSync(`/tmp/${filename}.hc22000`);
      fs.unlinkSync(`/tmp/${filename}.essids`);
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('[DEBUG] Extracted ESSIDs:', essids);
    console.log('[DEBUG] Extracted BSSIDs:', bssids);

    return { essids, bssids };
  } catch (error) {
    console.error('[DEBUG] Failed to extract ESSIDs:', error);
    return { essids: [], bssids: [] };
  }
}

const UPLOAD_DIR = process.env.PCAPS_PATH || (process.env.NODE_ENV === 'development' ? './volumes/pcaps' : '/data/pcaps');
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

        // Extract and store ESSID mappings
        try {
          const { essids, bssids } = await extractEssidsFromPcap(filepath, filename);

          // Clear existing mappings for this file
          await deletePcapEssidMappings(filename);

          // Store new mappings
          for (let i = 0; i < essids.length; i++) {
            const essid = essids[i];
            const bssid = bssids[i] || undefined;
            await addPcapEssidMapping(filename, essid, bssid);
          }

          console.log(`[DEBUG] Stored ${essids.length} ESSID mappings for ${filename}`);
        } catch (error) {
          console.error(`[DEBUG] Failed to extract ESSIDs for ${filename}:`, error);
          // Don't fail the upload if ESSID extraction fails
        }

        uploadedFiles.push(filename);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const response = {
      success: uploadedFiles.length > 0,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      message: uploadedFiles.length > 0 ?
        `Successfully uploaded ${uploadedFiles.length} file(s). ESSID information has been extracted and stored.` :
        undefined,
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
