import { NextRequest, NextResponse } from 'next/server';
import { progressTracker } from '@/lib/upload/progress';
import { logError } from '@/lib/logger';

/**
 * Universal progress tracking endpoint
 * Get progress for any upload type by fileId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

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
    logError('Progress tracking error:', error);

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
 * Cancel upload by fileId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Try to get current progress before cancelling
    const currentProgress = progressTracker.getProgress(fileId);

    if (!currentProgress) {
      return NextResponse.json(
        { error: 'Upload not found or already completed' },
        { status: 404 }
      );
    }

    // Don't allow cancellation of completed uploads
    if (currentProgress.stage === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed upload' },
        { status: 400 }
      );
    }

    // Mark upload as cancelled
    progressTracker.cancelTracking(fileId);

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        cancelled: true,
        message: 'Upload cancelled successfully',
        previousStage: currentProgress.stage,
        bytesUploaded: currentProgress.bytesUploaded,
        totalBytes: currentProgress.totalBytes,
      },
    });
  } catch (error) {
    logError('Upload cancellation error:', error);

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
