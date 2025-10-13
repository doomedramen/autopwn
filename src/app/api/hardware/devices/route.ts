import { NextResponse } from 'next/server';
import { hashcat } from '@/tools/hashcat';

/**
 * Get available hashcat devices
 */
export async function GET() {
  try {
    const result = await hashcat.getDevices();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to detect devices',
          message: result.stderr || 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || []
    });

  } catch (error) {
    console.error('Device detection error:', error);

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