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
 * Returns a PNG buffer (scaled down for OG images)
 */
export async function extractVideoFrame(
  buffer: Buffer,
  contentType: string,
  ffmpegPath?: string
): Promise<Buffer | null> {
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
      
      // Extract first frame using ffmpeg with scaling
      // -ss 0: seek to start
      // -vframes 1: extract 1 frame
      // -vf scale=1200:1200:force_original_aspect_ratio=decrease: - scale down to max 1200px
      // -f image2: output as image
      await execFileAsync(ffmpeg, [
        '-i', inputFile,
        '-ss', '0',
        '-vframes', '1',
        '-vf', 'scale=1200:1200:force_original_aspect_ratio=decrease',
        '-f', 'image2',
        '-y', // Overwrite output file
        outputFile,
      ], {
        timeout: 10000, // 10 second timeout
      });
      
      // Read output frame
      const frameBuffer = await fs.readFile(outputFile);
      
      // Clean up temp files
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
      
      return frameBuffer;
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
 * Returns a PNG buffer (scaled down for OG images)
 */
export async function extractGifFrame(buffer: Buffer): Promise<Buffer | null> {
  try {
    // Use sharp to extract first frame, scale down, and convert to PNG
    const pngBuffer = await sharp(buffer, { animated: false })
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 6 })
      .toBuffer();
    
    return pngBuffer;
  } catch (error) {
    console.error(`[Media Processor] Error extracting GIF frame:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Scale and compress an image buffer to appropriate size for OG images
 * Target: max 1200px width/height, compressed to keep data URL under 2MB
 */
async function scaleImageForOG(
  buffer: Buffer,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  maxDataUrlSize: number = 2 * 1024 * 1024 // 2MB
): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Calculate target dimensions
    let targetWidth = metadata.width || maxWidth;
    let targetHeight = metadata.height || maxHeight;
    
    // Scale down if needed, maintaining aspect ratio
    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
        targetWidth = maxWidth;
      } else {
        targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
        targetHeight = maxHeight;
      }
    }
    
    // Resize and convert to PNG (for consistent format and better compression)
    // PNG compression level: 0-9, where 9 is maximum compression
    let compressionLevel = 6; // Start with moderate compression
    let processedBuffer = await sharp(buffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel })
      .toBuffer();
    
    // If still too large, increase compression progressively
    while (processedBuffer.length > maxDataUrlSize && compressionLevel < 9) {
      compressionLevel += 1;
      processedBuffer = await sharp(buffer)
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel })
        .toBuffer();
    }
    
    // If still too large, reduce dimensions and use max compression
    if (processedBuffer.length > maxDataUrlSize) {
      targetWidth = Math.floor(targetWidth * 0.8);
      targetHeight = Math.floor(targetHeight * 0.8);
      processedBuffer = await sharp(buffer)
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
    
    return processedBuffer;
  } catch (error) {
    console.error(`[Media Processor] Error scaling image:`, error instanceof Error ? error.message : String(error));
    // Return original buffer if scaling fails
    return buffer;
  }
}

/**
 * Process media file and extract a static image frame if needed
 * Returns a data URL for the image (original or extracted frame)
 * Images are scaled down to appropriate size for OG images (max 1200px)
 */
export async function processMediaForImage(
  buffer: Buffer,
  contentType: string | null,
  originalUrl?: string
): Promise<{ dataUrl: string; processedType: MediaType; originalType: MediaType } | null> {
  try {
    const mediaType = await detectMediaType(contentType, buffer);
    
    // If it's already a static image, scale it down
    if (mediaType === 'image') {
      const scaledBuffer = await scaleImageForOG(buffer);
      const base64 = scaledBuffer.toString('base64');
      return {
        dataUrl: `data:image/png;base64,${base64}`,
        processedType: 'image',
        originalType: 'image',
      };
    }
    
    // If it's a video, extract first frame (already scaled by ffmpeg, but scale again to ensure size)
    if (mediaType === 'video') {
      const frameBuffer = await extractVideoFrame(buffer, contentType || 'video/mp4');
      if (frameBuffer) {
        // Scale further if needed to ensure data URL size is under limit
        const scaledBuffer = await scaleImageForOG(frameBuffer);
        const scaledBase64 = scaledBuffer.toString('base64');
        return {
          dataUrl: `data:image/png;base64,${scaledBase64}`,
          processedType: 'image',
          originalType: 'video',
        };
      }
      return null;
    }
    
    // If it's an animated GIF, extract first frame (already scaled, but scale again to ensure size)
    if (mediaType === 'gif') {
      const frameBuffer = await extractGifFrame(buffer);
      if (frameBuffer) {
        // Scale further if needed to ensure data URL size is under limit
        const scaledBuffer = await scaleImageForOG(frameBuffer);
        const scaledBase64 = scaledBuffer.toString('base64');
        return {
          dataUrl: `data:image/png;base64,${scaledBase64}`,
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
