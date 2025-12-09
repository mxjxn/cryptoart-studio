/**
 * Frame extraction utility for GIFs and videos
 * Extracts the first frame from animated media for use in OG images
 */

export interface FrameExtractionResult {
  buffer: Buffer;
  contentType: string;
  success: boolean;
  error?: string;
}

/**
 * Detect media type from URL or content-type
 */
function detectMediaType(url: string, contentType?: string): 'gif' | 'video' | 'image' | 'unknown' {
  // Check content-type first (most reliable)
  if (contentType) {
    if (contentType.includes('image/gif')) return 'gif';
    if (contentType.includes('video/')) return 'video';
    if (contentType.includes('image/')) return 'image';
  }

  // Fall back to URL extension
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.gif') || urlLower.includes('.gif?')) return 'gif';
  if (urlLower.match(/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/)) return 'video';
  if (urlLower.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/)) return 'image';

  return 'unknown';
}

/**
 * Detect media type from magic bytes
 */
function detectMediaTypeFromBytes(buffer: Buffer): 'gif' | 'video' | 'image' | 'unknown' {
  if (buffer.length < 12) return 'unknown';

  const magicBytes = buffer.subarray(0, 12);

  // GIF: 47 49 46 38 (GIF8)
  if (magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x38) {
    return 'gif';
  }

  // MP4: 00 00 00 ?? 66 74 79 70 (ftyp)
  if (magicBytes[0] === 0x00 && magicBytes[1] === 0x00 && magicBytes[2] === 0x00 && 
      (magicBytes[3] === 0x18 || magicBytes[3] === 0x20 || magicBytes[3] === 0x1C) &&
      magicBytes[4] === 0x66 && magicBytes[5] === 0x74 && magicBytes[6] === 0x79 && magicBytes[7] === 0x70) {
    return 'video';
  }

  // WebM: 1A 45 DF A3
  if (magicBytes[0] === 0x1A && magicBytes[1] === 0x45 && magicBytes[2] === 0xDF && magicBytes[3] === 0xA3) {
    return 'video';
  }

  // QuickTime/MOV: 00 00 00 ?? 66 74 79 70 71 74 (ftypqt)
  if (magicBytes[0] === 0x00 && magicBytes[1] === 0x00 && magicBytes[2] === 0x00 &&
      magicBytes[4] === 0x66 && magicBytes[5] === 0x74 && magicBytes[6] === 0x79 && magicBytes[7] === 0x70) {
    return 'video';
  }

  // JPEG, PNG, WebP are images
  if (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF) return 'image';
  if (magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47) return 'image';
  if (magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 &&
      buffer.length >= 12 && 
      magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50) {
    return 'image';
  }

  return 'unknown';
}

/**
 * Extract first frame from video using fluent-ffmpeg
 * This requires ffmpeg to be installed on the system
 */
async function extractVideoFrameWithFFmpeg(
  buffer: Buffer,
  mediaUrl: string
): Promise<FrameExtractionResult> {
  try {
    // Try to import fluent-ffmpeg
    let ffmpeg: any;
    let ffmpegStatic: any;
    try {
      ffmpeg = (await import('fluent-ffmpeg')).default;
      // Try to use ffmpeg-static for bundled ffmpeg binary
      try {
        ffmpegStatic = await import('ffmpeg-static');
      } catch {
        // ffmpeg-static not available, will use system ffmpeg
      }
    } catch (error) {
      return {
        buffer: Buffer.alloc(0),
        contentType: 'image/png',
        success: false,
        error: 'fluent-ffmpeg is required for video frame extraction. Install it with: npm install fluent-ffmpeg. Also ensure ffmpeg is installed on your system.',
      };
    }

    // Import Node.js modules dynamically
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const { writeFileSync, unlinkSync, readFileSync, existsSync } = fs;
    const { join } = path;
    const { tmpdir } = os;
    
    // Create temporary files
    const tempInput = join(tmpdir(), `video-${Date.now()}-${Math.random().toString(36).substring(7)}.tmp`);
    const tempOutput = join(tmpdir(), `frame-${Date.now()}-${Math.random().toString(36).substring(7)}.png`);
    
    // Return a properly constructed Promise (not using async in Promise constructor)
    return new Promise<FrameExtractionResult>((resolve) => {
      try {
        // Write buffer to temp file
        writeFileSync(tempInput, buffer);
        
        // Configure ffmpeg
        const command = ffmpeg(tempInput);
        
        // Use ffmpeg-static binary if available
        if (ffmpegStatic?.default) {
          command.setFfmpegPath(ffmpegStatic.default);
        }
        
        // Extract first frame
        command
          .screenshots({
            timestamps: ['00:00:00.000'],
            filename: tempOutput,
            folder: tmpdir(),
            size: '1920x1080', // Max size, will maintain aspect ratio
          })
          .on('end', () => {
            try {
              // Read the extracted frame
              const frameBuffer = readFileSync(tempOutput);
              
              // Clean up temp files
              try {
                unlinkSync(tempInput);
                unlinkSync(tempOutput);
              } catch (cleanupError) {
                console.warn(`[Frame Extractor] Error cleaning up temp files:`, cleanupError);
              }
              
              resolve({
                buffer: frameBuffer,
                contentType: 'image/png',
                success: true,
              });
            } catch (readError) {
              // Clean up on error
              try {
                unlinkSync(tempInput);
                if (existsSync(tempOutput)) {
                  unlinkSync(tempOutput);
                }
              } catch {}
              
              resolve({
                buffer: Buffer.alloc(0),
                contentType: 'image/png',
                success: false,
                error: `Failed to read extracted frame: ${readError instanceof Error ? readError.message : String(readError)}`,
              });
            }
          })
          .on('error', (err: Error) => {
            // Clean up on error
            try {
              unlinkSync(tempInput);
              if (existsSync(tempOutput)) {
                unlinkSync(tempOutput);
              }
            } catch {}
            
            resolve({
              buffer: Buffer.alloc(0),
              contentType: 'image/png',
              success: false,
              error: `FFmpeg error: ${err.message}. Make sure ffmpeg is installed on your system.`,
            });
          });
      } catch (error) {
        // Clean up on error
        try {
          if (existsSync(tempInput)) {
            unlinkSync(tempInput);
          }
          if (existsSync(tempOutput)) {
            unlinkSync(tempOutput);
          }
        } catch {}
        
        resolve({
          buffer: Buffer.alloc(0),
          contentType: 'image/png',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  } catch (error) {
    return {
      buffer: Buffer.alloc(0),
      contentType: 'image/png',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract first frame from GIF or video
 * - GIFs: Uses Sharp (works reliably)
 * - Videos: Uses fluent-ffmpeg (requires ffmpeg to be installed)
 */
export async function extractFirstFrame(
  mediaUrl: string,
  buffer: Buffer,
  contentType?: string
): Promise<FrameExtractionResult> {
  try {
    // Import sharp
    let sharp: any;
    try {
      sharp = (await import('sharp')).default;
    } catch (error) {
      return {
        buffer: Buffer.alloc(0),
        contentType: 'image/png',
        success: false,
        error: 'sharp library is required for frame extraction. Install it with: npm install sharp',
      };
    }

    // Detect media type
    const mediaType = detectMediaType(mediaUrl, contentType) || detectMediaTypeFromBytes(buffer);
    
    if (mediaType === 'image') {
      // Already a static image, return as-is
      return {
        buffer,
        contentType: contentType || 'image/png',
        success: true,
      };
    }

    if (mediaType === 'gif') {
      // Extract first frame from GIF using Sharp
      // Sharp automatically extracts first frame when converting GIF to another format
      try {
        // Try to extract first frame - Sharp handles both animated and static GIFs
        const firstFrame = await sharp(buffer, { 
          animated: false, // Only process first frame (for animated GIFs)
          limitInputPixels: false, // Allow large GIFs
        })
          .png() // Convert to PNG (extracts first frame)
          .toBuffer();

        if (firstFrame.length === 0) {
          throw new Error('Extracted frame is empty');
        }

        return {
          buffer: firstFrame,
          contentType: 'image/png',
          success: true,
        };
      } catch (error) {
        console.error(`[Frame Extractor] Error extracting frame from GIF:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If extraction fails, try a simpler approach: just convert without animation flag
        try {
          console.log(`[Frame Extractor] Retrying GIF extraction with simpler method`);
          const firstFrame = await sharp(buffer)
            .png()
            .toBuffer();
          
          if (firstFrame.length > 0) {
            return {
              buffer: firstFrame,
              contentType: 'image/png',
              success: true,
            };
          }
        } catch (retryError) {
          console.error(`[Frame Extractor] Retry also failed:`, retryError);
        }
        
        return {
          buffer: Buffer.alloc(0),
          contentType: 'image/png',
          success: false,
          error: `Failed to extract frame from GIF: ${errorMessage}`,
        };
      }
    }

    if (mediaType === 'video') {
      // Extract first frame from video using fluent-ffmpeg
      // Sharp does NOT support video frame extraction
      console.log(`[Frame Extractor] Attempting to extract frame from video using ffmpeg`);
      return await extractVideoFrameWithFFmpeg(buffer, mediaUrl);
    }

    // Unknown media type
    return {
      buffer: Buffer.alloc(0),
      contentType: 'image/png',
      success: false,
      error: `Unknown media type: ${mediaType}`,
    };
  } catch (error) {
    console.error(`[Frame Extractor] Unexpected error extracting frame:`, error);
    return {
      buffer: Buffer.alloc(0),
      contentType: 'image/png',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a URL or buffer is likely a GIF or video that needs frame extraction
 */
export function needsFrameExtraction(url: string, contentType?: string, buffer?: Buffer): boolean {
  const mediaType = contentType 
    ? detectMediaType(url, contentType)
    : buffer 
      ? detectMediaTypeFromBytes(buffer)
      : detectMediaType(url);

  return mediaType === 'gif' || mediaType === 'video';
}


