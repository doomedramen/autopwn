import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadType = searchParams.get('type') as 'pcap' | 'dictionary';

    if (!uploadType || !['pcap', 'dictionary'].includes(uploadType)) {
      return NextResponse.json(
        { error: 'Invalid upload type. Must be "pcap" or "dictionary"' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type based on upload type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowedTypes = uploadType === 'pcap' ? ['.pcap'] : ['.txt'];

    if (!allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Invalid file type for ${uploadType} upload. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    // Log upload information
    console.log(`${uploadType.toUpperCase()} file uploaded:`, {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: fileExtension,
      uploadType
    });

    // Simulate processing time based on file size
    const processingTime = Math.min(file.size / (1024 * 1024) * 100, 5000); // 100ms per MB, max 5s
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // For now, just return success with file info
    // In a real implementation, you would:
    // 1. Save the file to storage (local, S3, etc.)
    // 2. Process the file (extract networks from PCAP, word count for dictionaries)
    // 3. Update the database with the processed data

    // Define base processed data
    const baseData = {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: fileExtension,
      uploadType
    };

    // Add type-specific processing results
    if (uploadType === 'pcap') {
      // Simulate network extraction results
      const processedData = {
        ...baseData,
        networksFound: Math.floor(Math.random() * 10) + 1,
        encryptionTypes: ['WPA2', 'WPA3', 'Open'] as string[],
        processingTime: `${(processingTime / 1000).toFixed(1)}s`
      };

      return NextResponse.json({
        success: true,
        message: 'PCAP file uploaded and processed successfully',
        data: processedData
      });
    } else {
      // Simulate dictionary processing results
      const wordCount = Math.floor(file.size / 10); // Rough estimate
      const processedData = {
        ...baseData,
        wordCount,
        estimatedCrackTime: `${(wordCount / 1000000).toFixed(1)}M passwords`,
        processingTime: `${(processingTime / 1000).toFixed(1)}s`
      };

      return NextResponse.json({
        success: true,
        message: 'Dictionary file uploaded and processed successfully',
        data: processedData
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    );
  }
}