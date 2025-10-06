import { NextRequest, NextResponse } from 'next/server';
import { readdir, rename, access } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const INPUT_PATH = process.env.INPUT_PATH || '/data/input';
const INTERMEDIATE_PATH = process.env.INTERMEDIATE_PATH || '/data/intermediate';
const HASHES_PATH = process.env.HASHES_PATH || '/data/hashes';

interface CreateJobRequest {
  captures: string[];
  dictionaryIds: number[];
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateJobRequest = await request.json();
    const { captures, dictionaryIds, name } = body;

    if (!captures || captures.length === 0) {
      return NextResponse.json(
        { error: 'At least one capture file is required' },
        { status: 400 }
      );
    }

    if (!dictionaryIds || dictionaryIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one dictionary is required' },
        { status: 400 }
      );
    }

    // Verify all capture files exist
    const existingFiles: string[] = [];
    console.log(`[DEBUG] Looking for files in INPUT_PATH: ${INPUT_PATH}`);

    // List what's actually in the input directory
    try {
      const fs = require('fs');
      const files = fs.readdirSync(INPUT_PATH);
      console.log(`[DEBUG] Files in input directory: ${files.join(', ')}`);
    } catch (error) {
      console.log(`[DEBUG] Cannot read input directory: ${error}`);
    }

    for (const filename of captures) {
      const fullPath = join(INPUT_PATH, filename);
      console.log(`[DEBUG] Checking for file: ${fullPath}`);
      try {
        await access(fullPath); // Check if file exists and is accessible
        existingFiles.push(filename);
        console.log(`[DEBUG] Found file: ${filename}`);
      } catch (error) {
        console.log(`[DEBUG] File not found: ${fullPath} - ${error}`);
      }
    }

    if (existingFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid capture files found' },
        { status: 404 }
      );
    }

    // For now, just move files to a "processing" folder and let the worker handle job creation
    // This is a simplified implementation - in a full system, you'd:
    // 1. Convert pcaps to hash format
    // 2. Create database records
    // 3. Queue the jobs for processing

    const PROCESSING_PATH = process.env.PROCESSING_PATH || '/data/processing';
    const timestamp = Date.now();
    const jobName = name || `job-${timestamp}`;

    // Ensure processing directory exists
    const fs = require('fs');
    if (!fs.existsSync(PROCESSING_PATH)) {
      fs.mkdirSync(PROCESSING_PATH, { recursive: true });
    }

    const movedFiles = [];
    for (const filename of existingFiles) {
      try {
        // Move file to processing directory
        const inputFile = join(INPUT_PATH, filename);
        const processingFile = join(PROCESSING_PATH, filename);
        await rename(inputFile, processingFile);

        movedFiles.push(filename);
        console.log(`Moved ${filename} to processing directory`);
      } catch (error) {
        console.error(`Failed to move ${filename}:`, error);
      }
    }

    if (movedFiles.length === 0) {
      return NextResponse.json(
        { error: 'Failed to move any files for processing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobName,
      captures: movedFiles,
      dictionaries: dictionaryIds,
      totalCreated: movedFiles.length,
      message: `Successfully queued ${movedFiles.length} capture file(s) for processing. Job will be created automatically.`,
      note: 'This is a simplified implementation. The actual job creation will be handled by the worker service.'
    });

  } catch (error) {
    console.error('Error creating jobs:', error);
    return NextResponse.json(
      { error: 'Failed to create jobs' },
      { status: 500 }
    );
  }
}