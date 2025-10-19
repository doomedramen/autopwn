import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/upload';
import { getUploadConfig } from '@/lib/upload/configs';
import { progressTracker } from '@/lib/upload/progress';
import { db } from '@/lib/db';
import { uploads, users, userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import type { UploadProgress } from '@/lib/upload';
import { logError, logDebug } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for large dictionary files
export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const config = getUploadConfig('dictionary');
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!config.allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `Dictionary files must have one of these extensions: ${config.allowedExtensions.join(', ')}`,
          received: fileExtension,
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
          received: `${(file.size / 1024 / 1024 / 1024).toFixed(3)}GB`,
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
    const result = await uploadService.handleUpload(
      file,
      config,
      onProgress,
      fileId
    );

    if (result.success) {
      // Extract dictionary metadata
      const metadata =
        (result.data?.processingResult as Record<string, unknown>) || {};

      // Require authenticated user
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Get authenticated user
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      if (!userRecord) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Ensure user profile exists
      let userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userRecord.id),
      });

      // Create profile if missing (defensive programming for legacy data)
      if (!userProfile) {
        logDebug('Creating missing user profile for:', userRecord.id);
        [userProfile] = await db
          .insert(userProfiles)
          .values({
            userId: userRecord.id,
            username:
              userRecord.name || userRecord.email?.split('@')[0] || 'unknown',
            role: 'user',
            isActive: true,
            isEmailVerified: true,
            requirePasswordChange: false,
          })
          .returning();
        logDebug('User profile created successfully');
      }

      // Check if user is active
      if (!userProfile.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 }
        );
      }

      logDebug('Creating upload record with userProfileId:', userProfile.id);
      const [uploadRecord] = await db
        .insert(uploads)
        .values({
          userId: userProfile.id,
          filename: result.data?.originalName || file.name,
          originalName: file.name,
          filePath: result.data?.savedPath || '',
          fileSize: file.size,
          fileChecksum: result.data?.checksum || '',
          mimeType: file.type,
          uploadType: 'dictionary',
          metadata: metadata.metadata || {},
        })
        .returning();

      const dictionaryInfo = {
        id: uploadRecord.id,
        name: name || file.name,
        originalName: file.name,
        path: result.data?.savedPath,
        size: result.data?.size,
        checksum: result.data?.checksum,
        metadata: metadata.metadata || {},
        createdAt: uploadRecord.createdAt,
        fileId: fileId, // Use the consistent fileId
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
          processingTime: result.data?.uploadTime,
        },
      });
    } else {
      // SECURITY: Log detailed errors server-side only, return generic message to user
      logError('Dictionary processing failed:', {
        fileId,
        stderr: result.stderr,
        fileName: file.name,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'PROCESSING_FAILED',
          message:
            'Unable to process dictionary file. Please ensure it contains valid password list data',
          fileId,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    // SECURITY: Log detailed errors server-side only, never expose internal details to users
    logError('Dictionary upload error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'UPLOAD_FAILED',
        message:
          'Unable to upload file. Please try again or contact support if the problem persists',
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
      data: progress,
    });
  } catch (error) {
    logError('Dictionary progress error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get progress',
        message: error instanceof Error ? error.message : 'Unknown error',
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
        message: cancelled
          ? 'Upload cancelled successfully'
          : 'Upload was not found or already completed',
      },
    });
  } catch (error) {
    logError('Dictionary cancel error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel upload',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
