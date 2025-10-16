import { NextResponse } from 'next/server';
import { hashcat } from '@/tools/hashcat';
import { logError } from '@/lib/logger';

/**
 * Get available hashcat devices
 */
export async function GET() {
  try {
    const result = await hashcat.getDevices();

    if (!result.success) {
      // Check if this is a CPU-only system without GPU support
      const errorLower = result.stderr?.toLowerCase() || '';
      const isCPUOnlyIssue =
        errorLower.includes('opencl') ||
        errorLower.includes('cuda') ||
        errorLower.includes('hip') ||
        errorLower.includes('no compatible platform');

      if (isCPUOnlyIssue) {
        return NextResponse.json({
          success: true,
          data: [
            {
              deviceId: 1,
              type: 'cpu',
              name: 'CPU (Device #1)',
              version: 'CPU-only mode',
              memory: 0,
              cores: 1,
              clockSpeed: 0,
            },
          ],
          warning:
            'GPU acceleration not available. Using CPU-only mode. Performance will be slower but functional.',
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to detect devices',
          message: result.stderr || 'Unknown error',
        },
        { status: 500 }
      );
    }

    // If no devices found but hashcat executed successfully, it might be CPU-only
    if (!result.data || result.data.length === 0) {
      return NextResponse.json({
        success: true,
        data: [
          {
            deviceId: 1,
            type: 'cpu',
            name: 'CPU (Device #1)',
            version: 'CPU-only mode',
            memory: 0,
            cores: 1,
            clockSpeed: 0,
          },
        ],
        warning: 'No GPU devices detected. Using CPU-only mode.',
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
    });
  } catch (error) {
    logError('Device detection error:', error);

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
