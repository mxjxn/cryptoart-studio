import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { isDataURI } from '../media-utils';

const execFileAsync = promisify(execFile);

export type MediaType = 'image' | 'video' | 'gif' | 'unknown';

/**
 * Detect media type from content-type header and/or magic bytes
 */
export async function detectMediaType(
  contentType: string | null,
  buffer: Buffer
): Promise<MediaType> {
  // Check content-type first
  if (contentType) {
    if (contentType.startsWith('video/')) {
      return 'video';
    }
    if (contentType === 'image/gif') {
      // Check if it's animated by examining the buffer
      return isAnimatedGif(buffer) ? 'gif' : 'image';
    }
    if (contentType.startsWith('image/')) {
      return 'image';
    }
  }

  // Check magic bytes as fallback
  const magicBytes = buffer.subarray(0, 12);
  
  // Video formats
  // MP4: 00 00 00 ?? 66 74 79 70 (ftyp)
  if (
    magicBytes[4] === 0x66 &&
    magicBytes[5] === 0x74 &&
    magicBytes[6] === 0x79 &&
    magicBytes[7] === 0x70
  ) {
    return 'video';
  }
  
  // WebM: 1A 45 DF A3
  if (
    magicBytes[0] === 0x1a &&
    magicBytes[1] === 0x45 &&
    magicBytes[2] === 0xdf &&
    magicBytes[3] === 0xa3
  ) {
    return 'video';
  }

  // GIF: 47 49 46 38 (GIF8)
  if (
    magicBytes[0] === 0x47 &&
    magicBytes[1] === 0x49 &&
    magicBytes[2] === 0x46 &&
    magicBytes[3] === 0x38
  ) {
    return isAnimatedGif(buffer) ? 'gif' : 'image';
  }

  // Image formats
  // JPEG: FF D8 FF
  if (
    magicBytes[0] === 0xff &&
    magicBytes[1] === 0xd8 &&
    magicBytes[2] === 0xff
  ) {
    return 'image';
  }

  // PNG: 89 50 4E 47
  if (
    magicBytes[0] === 0x89 &&
    magicBytes[1] === 0x50 &&
    magicBytes[2] === 0x4e &&
    magicBytes[3] === 0x47
  ) {
    return 'image';
  }

  // WebP: RIFF....WEBP
  if (
    magicBytes[0] === 0x52 &&
    magicBytes[1] === 0x49 &&
    magicBytes[2] === 0x46 &&
    magicBytes[3] === 0x46 &&
    buffer.length >= 12 &&
    magicBytes[8] === 0x57 &&
    magicBytes[9] === 0x45 &&
    magicBytes[10] === 0x42 &&
    magicBytes[11] === 0x50
  ) {
    return 'image';
  }

  return 'unknown';
}

/**
 * Check if a GIF is animated by looking for multiple image descriptors
 */
function isAnimatedGif(buffer: Buffer): boolean {
  try {
    // Look for multiple image descriptors (0x21 0xF9 indicates image separator)
    // An animated GIF will have multiple instances
    let imageCount = 0;
    for (let i = 0; i < Math.min(buffer.length - 1, 10000); i++) {
      if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9) {
        imageCount++;
        if (imageCount > 1) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract first frame from a video file using ffmpeg
 * Returns a PNG data URL
 */
export async function extractVideoFrame(
  buffer: Buffer,
  contentType: string,
  ffmpegPath?: string
): Promise<string | null> {
  const ffmpeg = ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  
  try {
    // Write buffer to temporary file
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `video-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    const outputFile = path.join(tempDir, `frame-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    
    try {
      // Write input file
      await fs.writeFile(inputFile, buffer);
      
      // Extract first frame using ffmpeg
      // -ss 0: seek to start
      // -vframes 1: extract 1 frame
      // -f image2: output as image
      await execFileAsync(ffmpeg, [
        '-i', inputFile,
        '-ss', '0',
        '-vframes', '1',
        '-f', 'image2',
        '-y', // Overwrite output file
        outputFile,
      ], {
        timeout: 10000, // 10 second timeout
      });
      
      // Read output frame
      const frameBuffer = await fs.readFile(outputFile);
      
      // Convert to data URL
      const base64 = frameBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      
      // Clean up temp files
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
      
      return dataUrl;
    } catch (error) {
      // Clean up temp files on error
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error(`[Media Processor] Error extracting video frame:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Extract first frame from an animated GIF
 * Returns a PNG data URL
 */
export async function extractGifFrame(buffer: Buffer): Promise<string | null> {
  try {
    // Use sharp to extract first frame and convert to PNG
    const pngBuffer = await sharp(buffer, { animated: false })
      .png()
      .toBuffer();
    
    const base64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`[Media Processor] Error extracting GIF frame:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Process media file and extract a static image frame if needed
 * Returns a data URL for the image (original or extracted frame)
 */
export async function processMediaForImage(
  buffer: Buffer,
  contentType: string | null,
  originalUrl?: string
): Promise<{ dataUrl: string; processedType: MediaType; originalType: MediaType } | null> {
  try {
    const mediaType = await detectMediaType(contentType, buffer);
    
    // If it's already a static image, return as-is
    if (mediaType === 'image') {
      const base64 = buffer.toString('base64');
      const mimeType = contentType || 'image/png';
      return {
        dataUrl: `data:${mimeType};base64,${base64}`,
        processedType: 'image',
        originalType: 'image',
      };
    }
    
    // If it's a video, extract first frame
    if (mediaType === 'video') {
      const frameDataUrl = await extractVideoFrame(buffer, contentType || 'video/mp4');
      if (frameDataUrl) {
        return {
          dataUrl: frameDataUrl,
          processedType: 'image',
          originalType: 'video',
        };
      }
      return null;
    }
    
    // If it's an animated GIF, extract first frame
    if (mediaType === 'gif') {
      const frameDataUrl = await extractGifFrame(buffer);
      if (frameDataUrl) {
        return {
          dataUrl: frameDataUrl,
          processedType: 'image',
          originalType: 'gif',
        };
      }
      return null;
    }
    
    // Unknown type - return null
    console.warn(`[Media Processor] Unknown media type for URL: ${originalUrl?.substring(0, 100)}`);
    return null;
  } catch (error) {
    console.error(`[Media Processor] Error processing media:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Check if ffmpeg is available on the system
 */
export async function checkFfmpegAvailable(ffmpegPath?: string): Promise<boolean> {
  const ffmpeg = ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  
  try {
    await execFileAsync(ffmpeg, ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
