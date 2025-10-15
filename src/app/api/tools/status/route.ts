import { NextResponse } from 'next/server';
import { toolValidator } from '@/lib/tool-validation';

export const dynamic = 'force-dynamic';

/**
 * Get tool status for UI display
 */
export async function GET() {
  try {
    // Check all required tools
    const results = await toolValidator.checkRequiredTools();

    // Get summary information
    const availableTools = results.filter(r => r.available).length;
    const totalTools = results.length;
    const missingCritical = results.filter(r => r.critical && !r.available);

    return NextResponse.json({
      success: true,
      data: {
        tools: results,
        summary: {
          total: totalTools,
          available: availableTools,
          missing: totalTools - availableTools,
          criticalMissing: missingCritical.length,
          allAvailable: missingCritical.length === 0
        }
      }
    });
  } catch (error) {
    console.error('Tool status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check tool status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}