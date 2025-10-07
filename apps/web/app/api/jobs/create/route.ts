import { NextRequest, NextResponse } from 'next/server';
import { readdir, rename, access, unlink } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { addJob, addJobDictionaries, getPcapEssidMappings } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PCAPS_PATH = process.env.PCAPS_PATH || (process.env.NODE_ENV === 'development' ? './volumes/pcaps' : '/data/pcaps');
const DICTIONARIES_PATH = process.env.DICTIONARIES_PATH || (process.env.NODE_ENV === 'development' ? './volumes/dictionaries' : '/data/dictionaries');
const JOBS_PATH = process.env.JOBS_PATH || (process.env.NODE_ENV === 'development' ? './volumes/jobs' : '/data/jobs');

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
    console.log(`[DEBUG] Looking for files in PCAPS_PATH: ${PCAPS_PATH}`);

    // List what's actually in the pcaps directory
    try {
      const fs = require('fs');
      const files = fs.readdirSync(PCAPS_PATH);
      console.log(`[DEBUG] Files in pcaps directory: ${files.join(', ')}`);
    } catch (error) {
      console.log(`[DEBUG] Cannot read pcaps directory: ${error}`);
    }

    for (const filename of captures) {
      const fullPath = join(PCAPS_PATH, filename);
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

    // Create a single job that merges all selected PCAPs into one hc22000 file
    const timestamp = Date.now();
    const jobId = `job-${timestamp}`;
    const jobName = name || jobId;
    const mergedHashFile = join(JOBS_PATH, `${jobId}.hc22000`);

    // Ensure directories exist
    const fs = require('fs');
    if (!fs.existsSync(JOBS_PATH)) {
      fs.mkdirSync(JOBS_PATH, { recursive: true });
    }

    // Build the hcxpcapngtool command to merge all PCAPs at once
    const pcapFilePaths = existingFiles.map(filename => join(PCAPS_PATH, filename));

    console.log(`Converting ${existingFiles.length} PCAPs to merged hash file: ${mergedHashFile}`);

    try {
      const hashCount = await convertMultiplePcapsToHash(pcapFilePaths, mergedHashFile);

      if (hashCount === 0) {
        return NextResponse.json(
          { error: 'No valid hashes found in any of the selected capture files' },
          { status: 400 }
        );
      }

      console.log(`Successfully created merged hash file with ${hashCount} hashes`);

      // Store job in database
      const capturesString = existingFiles.join(',');
      const job = await addJob({
        job_id: jobId,
        filename: `${jobId}.hc22000`,
        status: 'pending',
        priority: 0,
        items_total: hashCount,
        captures: capturesString,
        total_hashes: hashCount,
      });

      // Add dictionary associations
      await addJobDictionaries(job.id, dictionaryIds);

      // Get ESSID information for the response
      const essidInfo: { [key: string]: string[] } = {};
      for (const filename of existingFiles) {
        const mappings = getPcapEssidMappings(filename);
        if (mappings.length > 0) {
          essidInfo[filename] = mappings.map(m => m.essid);
        }
      }

      console.log(`[DEBUG] Job stored in database with ID: ${job.id}`);

      return NextResponse.json({
        success: true,
        jobId,
        jobName,
        captures: existingFiles,
        dictionaries: dictionaryIds,
        totalCreated: 1,
        totalFiles: existingFiles.length,
        totalHashes: hashCount,
        essidMappings: essidInfo,
        message: `Successfully created job "${jobName}" merging ${existingFiles.length} capture files with ${hashCount} total hashes.`,
        note: 'The job will process all merged hashes against the selected dictionaries.'
      });

    } catch (error) {
      console.error('Failed to convert PCAPs to hash file:', error);
      return NextResponse.json(
        { error: `Failed to convert PCAPs: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error creating jobs:', error);
    return NextResponse.json(
      { error: 'Failed to create jobs' },
      { status: 500 }
    );
  }
}

async function convertMultiplePcapsToHash(pcapFiles: string[], outputFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Build command: hcxpcapngtool -o outputFile pcap1.pcap pcap2.pcap pcap3.pcap
    const args = ['-o', outputFile, ...pcapFiles];
    const process = spawn('hcxpcapngtool', args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        // Parse hash count from output
        // hcxpcapngtool typically outputs something like "written hashes: X"
        const match = stdout.match(/written hashes:\s*(\d+)/i) ||
                      stdout.match(/(\d+)\s+EAPOL/i) ||
                      stdout.match(/total:\s*(\d+)\s*hashes/i);
        const hashCount = match ? parseInt(match[1]) : 1;
        resolve(hashCount);
      } else {
        reject(new Error(`hcxpcapngtool failed: ${stderr || stdout}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}