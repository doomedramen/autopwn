/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/upload';
import { getUploadConfig } from '@/lib/upload/configs';
import { progressTracker } from '@/lib/upload/progress';
import { db } from '@/lib/db';
import { uploads, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UploadProgress } from '@/lib/upload';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for large dictionary files

/**
 * Dictionary file upload endpoint
 * Accepts multipart form data with a 'file' field containing the dictionary file
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string; // Optional custom name for the dictionary

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const config = getUploadConfig('dictionary');
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!config.allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `Dictionary files must have one of these extensions: ${config.allowedExtensions.join(', ')}`,
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
          message: `Dictionary files must be smaller than ${(config.maxSize / 1024 / 1024 / 1024).toFixed(1)}GB`,
          received: `${(file.size / 1024 / 1024 / 1024).toFixed(3)}GB`
        },
        { status: 413 }
      );
    }

      // Start progress tracking with the same fileId that will be used by upload service
    // We'll get the fileId first, then pass it to both upload service and progress tracker
    const fileId = uploadService.generateFileId();
    progressTracker.startTracking(fileId, file.size);

    // Progress callback for real-time updates
    const onProgress = (progress: UploadProgress) => {
      progressTracker.updateProgress(fileId, progress);
    };

    // Handle upload with dictionary-specific processing
    const result = await uploadService.handleUpload(file, config, onProgress, fileId);

    if (result.success) {
      // Mark progress as completed
      progressTracker.completeTracking(fileId, result.data as unknown as Record<string, unknown>);

      // Extract dictionary metadata
      const metadata = result.data?.processingResult as Record<string, unknown> || {};

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
        uploadType: 'dictionary',
        metadata: metadata.metadata || {}
      }).returning();

      const dictionaryInfo = {
        id: uploadRecord.id,
        name: name || file.name,
        originalName: file.name,
        path: result.data?.savedPath,
        size: result.data?.size,
        checksum: result.data?.checksum,
        metadata: metadata.metadata || {},
        createdAt: uploadRecord.createdAt,
        fileId: fileId // Use the consistent fileId
      };

      return NextResponse.json({
        success: true,
        data: {
          upload: result.data,
          dictionary: dictionaryInfo,
          metadata: metadata.metadata || {},
          fileId: fileId, // Use the consistent fileId for progress tracking
          progressUrl: `/api/upload/progress/${fileId}`,
          isLargeFile: file.size > 100 * 1024 * 1024, // > 100MB
          processingTime: result.data?.uploadTime
        }
      });
    } else {
      // Mark progress as failed
      progressTracker.failTracking(fileId, result.stderr || 'Upload failed');

      return NextResponse.json(
        {
          success: false,
          error: 'Dictionary upload failed',
          message: result.stderr,
          fileId
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Dictionary upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      },
      { status: 500 }
    );
  }
}

/**
 * Get upload progress for a dictionary file
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
    console.error('Dictionary progress error:', error);

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

/**
 * Cancel dictionary upload
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const cancelled = uploadService.cancelUpload(fileId);
    progressTracker.cancelTracking(fileId);

    return NextResponse.json({
      success: true,
      data: {
        cancelled,
        fileId,
        message: cancelled ? 'Upload cancelled successfully' : 'Upload was not found or already completed'
      }
    });

  } catch (error) {
    console.error('Dictionary cancel error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel upload',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}