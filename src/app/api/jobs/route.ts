/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { hashcat } from '@/tools/hashcat';
import { HcxPcapNgTool } from '@/tools/hcxpcapngtool';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { jobs, users, uploads, jobPcaps, jobDictionaries, networks } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { AttackMode } from '@/types';
import { jobMonitor } from '@/lib/job-monitor';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for job creation

interface JobRequest {
  name: string;
  networks: string[]; // Network BSSIDs selected by user
  dictionaries: string[];
  options: {
    attackMode: number;
    hashType: number;
    workloadProfile: number;
    gpuTempAbort?: number;
    gpuTempDisable?: boolean;
    optimizedKernelEnable?: boolean;
    potfileDisable?: boolean;
    devices?: number[];
  };
}

/**
 * Create a new password cracking job
 */
export async function POST(request: NextRequest) {
  try {
    const jobRequest: JobRequest = await request.json();

    // Validate request
    if (!jobRequest.name || !jobRequest.networks?.length || !jobRequest.dictionaries?.length) {
      return NextResponse.json(
        { error: 'Job name, networks, and dictionaries are required' },
        { status: 400 }
      );
    }

    // For now, use a default user (in production, get from authentication)
    const defaultUser = await db.query.users.findFirst({
      where: eq(users.username, 'default_user')
    });

    if (!defaultUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Ensure jobs directory exists
    const jobsDir = './jobs';
    try {
      await fs.mkdir(jobsDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Generate job ID and create job directory
    const jobId = randomUUID();
    const jobDir = join(jobsDir, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    // Instantiate hcxpcapngtool
    const hcxTool = new HcxPcapNgTool();

    // Find selected dictionaries from database
    const selectedDictionariesData = await db.query.uploads.findMany({
      where: and(
        inArray(uploads.id, jobRequest.dictionaries),
        eq(uploads.uploadType, 'dictionary')
      )
    });

    if (selectedDictionariesData.length === 0) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        { error: 'No valid dictionaries selected' },
        { status: 400 }
      );
    }

    // Step 1: Look up networks by BSSID to find which PCAP uploads they belong to
    const selectedNetworks = await db.query.networks.findMany({
      where: inArray(networks.bssid, jobRequest.networks)
    });

    if (selectedNetworks.length === 0) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        { error: 'No valid networks found with selected BSSIDs' },
        { status: 400 }
      );
    }

    // Get unique PCAP upload IDs from the networks
    const pcapUploadIds = [...new Set(selectedNetworks.map(n => n.uploadId).filter((id): id is string => id !== null))];

    // Get the PCAP upload records
    const selectedPcapsData = await db.query.uploads.findMany({
      where: and(
        inArray(uploads.id, pcapUploadIds),
        eq(uploads.uploadType, 'pcap')
      )
    });

    if (selectedPcapsData.length === 0) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        { error: 'No valid PCAP files found for selected networks' },
        { status: 400 }
      );
    }

    // Get PCAP file paths and resolve to absolute paths
    const pcapFiles = selectedPcapsData
      .map(pcap => resolve(process.cwd(), pcap.filePath))
      .filter(Boolean);

    // Step 2: Create single consolidated .hc22000 file from all PCAPs at once
    const consolidatedHashFile = join(jobDir, 'hashes.hc22000');
    const pcapFilePaths = Array.from(pcapFiles);

    // Use hcxpcapngtool to process multiple PCAP files and output one consolidated .hc22000 file
    const extractResult = await hcxTool.extractHandshakes(
      pcapFilePaths, // Pass array of PCAP files
      consolidatedHashFile,
      { outputFormat: 'hc22000' }
    );

    // Log error details if extraction failed
    if (!extractResult.success || !extractResult.data?.outputFile) {
      console.error('hcxpcapngtool failed:', {
        success: extractResult.success,
        stderr: extractResult.stderr,
        stdout: extractResult.stdout
      });
    }

    if (!extractResult.success || !extractResult.data?.outputFile) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        {
          error: 'No valid handshakes could be extracted from selected PCAP files',
          message: extractResult.stderr || 'Unknown error',
          details: {
            success: extractResult.success,
            stderr: extractResult.stderr,
            stdout: extractResult.stdout,
            outputFile: extractResult.data?.outputFile
          }
        },
        { status: 400 }
      );
    }

    // Check if the output file actually exists
    const actualOutputFile = extractResult.data.outputFile;
    try {
      await fs.access(actualOutputFile);
    } catch (error) {
      console.error(`Output file does not exist: ${actualOutputFile}`, error);
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });
      return NextResponse.json(
        {
          error: 'hcxpcapngtool reported success but output file was not created',
          message: `Expected file at: ${actualOutputFile}`,
          details: {
            outputFile: actualOutputFile,
            expectedFile: consolidatedHashFile,
            stderr: extractResult.stderr,
            stdout: extractResult.stdout
          }
        },
        { status: 500 }
      );
    }

    // Count the number of hashes in the consolidated file
    const hashContent = await fs.readFile(actualOutputFile, 'utf8');
    const hashCount = hashContent.trim().split('\n').filter(line => line.trim()).length;

    if (hashCount === 0) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        { error: 'No handshakes found in selected PCAP files' },
        { status: 400 }
      );
    }

    
    // Step 3: Create and start hashcat job
    const dictionaryPaths = selectedDictionariesData.map(dict => resolve(process.cwd(), dict.filePath));

    // Create HashcatJob object
    const hashcatJob = {
      id: jobId,
      name: jobRequest.name,
      hashFile: consolidatedHashFile,
      dictionaries: dictionaryPaths,
      options: {
        attackMode: jobRequest.options.attackMode as AttackMode,
        hashType: 22000, // .hc22000 format
        rules: [],
        mask: undefined,
        workloadProfile: jobRequest.options.workloadProfile as 1 | 2 | 3 | 4,
        gpuTempAbort: jobRequest.options.gpuTempAbort,
        gpuTempDisable: jobRequest.options.gpuTempDisable,
        optimizedKernelEnable: jobRequest.options.optimizedKernelEnable,
        potfileDisable: jobRequest.options.potfileDisable,
        devices: jobRequest.options.devices
      },
      status: 'pending' as const,
      progress: 0,
      speed: { current: 0, average: 0, unit: 'H/s' },
      eta: '',
      cracked: 0,
      total: hashCount
    };

    // Start hashcat job
    const hashcatResult = await hashcat.startJob(hashcatJob);

    if (!hashcatResult.success) {
      // Clean up job directory
      await fs.rm(jobDir, { recursive: true, force: true });

      return NextResponse.json(
        {
          error: 'Failed to start hashcat job',
          message: hashcatResult.stderr
        },
        { status: 500 }
      );
    }

    // Step 4: Create job record in database
    const [newJob] = await db.insert(jobs).values({
      userId: defaultUser.id,
      name: jobRequest.name,
      status: 'processing',
      progress: 0,
      cracked: 0,
      totalHashes: hashCount,
      hashcatSession: hashcatResult.data?.sessionId,
      consolidatedFilePath: consolidatedHashFile,
      jobOptions: jobRequest.options,
      startedAt: new Date(),
    }).returning();

    // Step 5: Link job to PCAP files (many-to-many)
    await db.insert(jobPcaps).values(
      selectedPcapsData.map(pcap => ({
        jobId: newJob.id,
        uploadId: pcap.id
      }))
    );

    // Step 6: Link job to dictionaries (many-to-many)
    await db.insert(jobDictionaries).values(
      selectedDictionariesData.map(dictionary => ({
        jobId: newJob.id,
        uploadId: dictionary.id
      }))
    );

    // Step 7: Start tracking the hashcat session for progress monitoring
    if (hashcatResult.data?.sessionId) {
      jobMonitor.trackSession(hashcatResult.data.sessionId);
    }

    // Step 8: Return job data
    return NextResponse.json({
      success: true,
      data: newJob
    });

  } catch (error) {
    console.error('Job creation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get all jobs
 */
export async function GET() {
  try {
    // Start with a simple query without relations
    const jobList = await db.query.jobs.findMany({
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)]
    });

    return NextResponse.json({
      success: true,
      data: jobList
    });

  } catch (error) {
    console.error('Jobs fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to update job status from hashcat session
 */
async function updateJobStatus(job: any) {
  try {
    if (job.hashcatSession) {
      // This would typically query hashcat for session status
      // For now, return current job status
      return {
        status: job.status,
        progress: job.progress || 0,
        cracked: job.cracked || 0,
        speed: {
          current: job.speedCurrent || 0,
          average: job.speedAverage || 0,
          unit: job.speedUnit || 'H/s'
        },
        eta: job.eta || ''
      };
    }
  } catch (error) {
    console.error(`Failed to update status for job ${job.id}:`, error);
  }

  return {};
}