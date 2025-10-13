/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/upload';
import { getUploadConfig } from '@/lib/upload/configs';
import { progressTracker } from '@/lib/upload/progress';
import { db } from '@/lib/db';
import { uploads, networks, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UploadProgress } from '@/lib/upload';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * PCAP file upload endpoint
 * Accepts multipart form data with a 'file' field containing the PCAP file
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const config = getUploadConfig('pcap');
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!config.allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `PCAP files must have one of these extensions: ${config.allowedExtensions.join(', ')}`,
          received: fileExtension
        },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > config.maxSize) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `PCAP files must be smaller than ${(config.maxSize / 1024 / 1024).toFixed(1)}MB`,
          received: `${(file.size / 1024 / 1024).toFixed(1)}MB`
        },
        { status: 413 }
      );
    }

    // Start progress tracking with the same fileId that will be used by upload service
    const fileId = uploadService.generateFileId();
    progressTracker.startTracking(fileId, file.size);

    // Progress callback for real-time updates
    const onProgress = (progress: UploadProgress) => {
      progressTracker.updateProgress(fileId, progress);
    };

    // Handle upload with PCAP-specific processing
    const result = await uploadService.handleUpload(file, config, onProgress, fileId);

    if (result.success) {
      // Mark progress as completed
      progressTracker.completeTracking(fileId, result.data as unknown as Record<string, unknown>);

      const processingResult = result.data?.processingResult as Record<string, unknown> || {};
      const analysis = processingResult.analysis as Record<string, unknown> || {};

      // Get or create default user
      let defaultUser = await db.query.users.findFirst({
        where: eq(users.username, 'default_user')
      });

      if (!defaultUser) {
        [defaultUser] = await db.insert(users).values({
          username: 'default_user',
          email: 'default@autopwn.local',
          passwordHash: 'default_password_hash'
        }).returning();
      }

      // Save upload record to database
      const [uploadRecord] = await db.insert(uploads).values({
        userId: defaultUser.id,
        filename: result.data?.originalName || file.name,
        originalName: file.name,
        filePath: result.data?.savedPath || '',
        fileSize: file.size,
        fileChecksum: result.data?.checksum || '',
        mimeType: file.type,
        uploadType: 'pcap',
        metadata: processingResult
      }).returning();

      // Save discovered networks to database
      const networksList = (analysis.networks as any[]) || [];
      if (networksList.length > 0) {
        await db.insert(networks).values(
          networksList.map((network: any) => ({
            uploadId: uploadRecord.id,
            essid: network.essid || 'Unknown Network',
            bssid: network.bssid || '',
            channel: network.channel,
            encryption: network.encryption,
            hasHandshake: network.hasHandshake || false,
            firstSeen: network.firstSeen || new Date(),
            lastSeen: network.lastSeen || new Date()
          }))
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          upload: {
            ...result.data,
            id: uploadRecord.id,
            fileId: fileId // Use the consistent fileId
          },
          networks: networksList,
          handshakes: processingResult?.handshakes || null,
          summary: processingResult?.summary || {},
          fileId: fileId, // Use the consistent fileId for progress tracking
          progressUrl: `/api/upload/progress/${fileId}`
        }
      });
    } else {
      // Mark progress as failed
      progressTracker.failTracking(fileId, result.stderr || 'Upload failed');

      return NextResponse.json(
        {
          success: false,
          error: 'Upload failed',
          message: result.stderr,
          fileId
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('PCAP upload error:', error);

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
 * Get upload progress for a PCAP file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const progress = progressTracker.getProgressForAPI(fileId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Upload not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('PCAP progress error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}