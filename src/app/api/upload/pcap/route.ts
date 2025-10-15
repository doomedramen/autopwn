/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/upload';
import { getUploadConfig } from '@/lib/upload/configs';
import { progressTracker } from '@/lib/upload/progress';
import { db } from '@/lib/db';
import { uploads, networks, users, userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UploadProgress } from '@/lib/upload';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const config = getUploadConfig('pcap');
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!config.allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `PCAP files must have one of these extensions: ${config.allowedExtensions.join(', ')}`,
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
          message: `PCAP files must be smaller than ${(config.maxSize / 1024 / 1024).toFixed(1)}MB`,
          received: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        },
        { status: 413 }
      );
    }

    // Progress callback for real-time updates
    const onProgress = (progress: UploadProgress) => {
      progressTracker.updateProgress(fileId, progress);
    };

    // Start progress tracking with the same fileId that will be used by upload service
    const fileId = uploadService.generateFileId();
    progressTracker.startTracking(fileId, file.size);

    // Handle upload with PCAP-specific processing
    const result = await uploadService.handleUpload(
      file,
      config,
      onProgress,
      fileId
    );

    if (result.success) {

      const processingResult =
        (result.data?.processingResult as Record<string, unknown>) || {};
      const analysis =
        (processingResult.analysis as Record<string, unknown>) || {};

      // Check for authenticated user first
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      let userRecord;
      if (session?.user?.id) {
        // Use authenticated user
        userRecord = await db.query.users.findFirst({
          where: eq(users.id, session.user.id),
        });

        // Check if user profile exists, create if missing (for test environments)
        if (userRecord) {
          const userProfile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, userRecord.id),
          });

          if (!userProfile) {
            await db.insert(userProfiles).values({
              userId: userRecord.id,
              username:
                userRecord.name || userRecord.email?.split('@')[0] || 'unknown',
              role: 'user',
              isActive: true,
              isEmailVerified: true,
              requirePasswordChange: false,
            });
          }
        }
      }

      if (!userRecord) {
        // Fallback to default user for test environments or unauthenticated requests
        userRecord = await db.query.users.findFirst({
          where: eq(users.name, 'default_user'),
        });

        if (!userRecord) {
          [userRecord] = await db
            .insert(users)
            .values({
              name: 'default_user',
              email: 'default@autopwn.local',
            })
            .returning();

          // Create corresponding user profile for the default user
          await db.insert(userProfiles).values({
            userId: userRecord.id,
            username: 'default_user',
            role: 'user',
            isActive: true,
            isEmailVerified: true,
            requirePasswordChange: false,
          });
        }
      }

      // Save upload record to database
      // Get the user profile ID (uploads table references userProfiles.id, not users.id)
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userRecord.id),
      });

      if (!userProfile) {
        console.error('❌ User profile not found for user:', userRecord.id);
        throw new Error(`User profile not found for user: ${userRecord.id}`);
      }

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
          uploadType: 'pcap',
          metadata: processingResult,
        })
        .returning();

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
            lastSeen: network.lastSeen || new Date(),
          }))
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          upload: {
            ...result.data,
            id: uploadRecord.id,
            fileId: fileId, // Use the consistent fileId
          },
          networks: networksList,
          handshakes: processingResult?.handshakes || null,
          summary: processingResult?.summary || {},
          fileId: fileId, // Use the consistent fileId for progress tracking
          progressUrl: `/api/upload/progress/${fileId}`,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Upload failed',
          message: result.stderr,
          fileId,
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
        message: error instanceof Error ? error.message : 'Unknown error',
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
      data: progress,
    });
  } catch (error) {
    console.error('PCAP progress error:', error);

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
