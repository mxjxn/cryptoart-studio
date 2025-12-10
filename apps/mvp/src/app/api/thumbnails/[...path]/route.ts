import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/thumbnails/[...path]
 * 
 * Serves locally stored thumbnail files (development only).
 * This route handles requests for files stored by LocalStorageBackend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Local thumbnail serving is only available in development' },
      { status: 403 }
    );
  }

  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');
    
    // Security: prevent directory traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Construct full path to thumbnail file
    const basePath = process.env.THUMBNAIL_STORAGE_PATH || '/tmp/thumbnails';
    const fullPath = path.join(basePath, filePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json(
        { error: 'Thumbnail not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(fullPath);
    
    // Determine content type from file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = 
      ext === '.webp' ? 'image/webp' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.png' ? 'image/png' :
      'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400', // Cache for 1 hour, CDN for 1 day
      },
    });
  } catch (error) {
    console.error('[Thumbnail Serve] Error:', error);
    return NextResponse.json(
      { error: 'Failed to serve thumbnail', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



