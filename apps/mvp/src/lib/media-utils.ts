/**
 * Media type detection utilities for NFT content
 * Handles both standard URLs and data URIs (onchain art)
 */

export type MediaType = 'image' | 'audio' | 'video' | '3d' | 'html';

/**
 * Check if a URL is a data URI
 */
export function isDataURI(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Extract MIME type from a data URI
 * e.g., "data:image/svg+xml;base64,..." → "image/svg+xml"
 * e.g., "data:audio/mpeg;base64,..." → "audio/mpeg"
 */
export function parseDataURIMimeType(dataURI: string): string | null {
  if (!isDataURI(dataURI)) return null;
  
  // Format: data:[<mediatype>][;base64],<data>
  const match = dataURI.match(/^data:([^;,]+)/);
  return match ? match[1] : null;
}

/**
 * Decode a base64 data URI and return the content
 * Handles both browser and Node.js environments
 */
export function decodeDataURI(dataURI: string): string | null {
  if (!isDataURI(dataURI)) return null;
  
  try {
    // Check if it's base64 encoded
    const isBase64 = dataURI.includes(';base64,');
    const dataStart = dataURI.indexOf(',') + 1;
    const data = dataURI.slice(dataStart);
    
    if (isBase64) {
      // Handle both browser and Node.js
      if (typeof atob !== 'undefined') {
        return atob(data);
      } else {
        return Buffer.from(data, 'base64').toString('utf-8');
      }
    }
    
    // URL-encoded data
    return decodeURIComponent(data);
  } catch (error) {
    console.error('Error decoding data URI:', error);
    return null;
  }
}

/**
 * Get file extension from a URL (handles query strings)
 */
function getFileExtension(url: string): string | null {
  try {
    // Remove query string and hash
    const cleanUrl = url.split('?')[0].split('#')[0];
    const lastDot = cleanUrl.lastIndexOf('.');
    if (lastDot === -1) return null;
    return cleanUrl.slice(lastDot + 1).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Audio file extensions and formats
 */
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a'];
const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a', 'audio'];

/**
 * Video file extensions and formats
 */
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v', 'ogv', 'mov', 'avi'];
const VIDEO_FORMATS = ['mp4', 'webm', 'm4v', 'ogv', 'mov', 'avi', 'video', 'h.264', 'h264', 'hevc', 'vp8', 'vp9'];

/**
 * 3D model file extensions and formats
 */
const MODEL_EXTENSIONS = ['glb', 'gltf'];
const MODEL_FORMATS = ['glb', 'gltf', '3d', 'model'];

/**
 * HTML file extensions and formats
 */
const HTML_EXTENSIONS = ['html', 'htm'];
const HTML_FORMATS = ['html', 'htm'];

/**
 * Determine the media type from a format string (e.g., "MP4", "mp3", "glb")
 * This is useful for Arweave/IPFS URLs that don't have file extensions
 */
export function getMediaTypeFromFormat(format: string): MediaType {
  if (!format) return 'image';
  
  const normalizedFormat = format.toLowerCase().trim();
  
  if (AUDIO_FORMATS.includes(normalizedFormat)) return 'audio';
  if (VIDEO_FORMATS.includes(normalizedFormat)) return 'video';
  if (MODEL_FORMATS.includes(normalizedFormat)) return '3d';
  if (HTML_FORMATS.includes(normalizedFormat)) return 'html';
  
  return 'image';
}

/**
 * Determine the media type from a URL or data URI
 */
export function getMediaType(url: string): MediaType {
  if (!url) return 'image';
  
  // Handle data URIs by checking MIME type
  if (isDataURI(url)) {
    const mimeType = parseDataURIMimeType(url);
    if (!mimeType) return 'image';
    
    const [type, subtype] = mimeType.split('/');
    
    switch (type) {
      case 'audio':
        return 'audio';
      case 'video':
        return 'video';
      case 'image':
        return 'image';
      case 'text':
        if (subtype === 'html') return 'html';
        return 'image';
      case 'model':
        // model/gltf-binary, model/gltf+json
        if (subtype?.includes('gltf') || subtype?.includes('glb')) return '3d';
        return 'image';
      case 'application':
        // application/octet-stream for binary 3D models
        if (subtype === 'octet-stream') {
          // Can't determine from MIME alone, default to image
          return 'image';
        }
        return 'image';
      default:
        return 'image';
    }
  }
  
  // Handle regular URLs by checking file extension
  const ext = getFileExtension(url);
  if (!ext) return 'image';
  
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (MODEL_EXTENSIONS.includes(ext)) return '3d';
  if (HTML_EXTENSIONS.includes(ext)) return 'html';
  
  return 'image';
}

/**
 * Determine if animation_url should be used instead of image
 * Returns true if animation_url exists and is not an image type
 */
export function shouldUseAnimationUrl(
  animationUrl: string | undefined,
  imageUrl: string | undefined
): boolean {
  if (!animationUrl) return false;
  
  const mediaType = getMediaType(animationUrl);
  // Use animation_url for non-image media types
  return mediaType !== 'image';
}

/**
 * Get the display URL for a listing
 * On detail pages, prefer animation_url for non-image media
 * On cards, always use image for thumbnail
 */
export function getDisplayUrl(
  animationUrl: string | undefined,
  imageUrl: string | undefined,
  forCard: boolean = false
): string | undefined {
  // Cards always use image for thumbnail
  if (forCard) return imageUrl;
  
  // Detail pages use animation_url if it's non-image media
  if (shouldUseAnimationUrl(animationUrl, imageUrl)) {
    return animationUrl;
  }
  
  return imageUrl || animationUrl;
}

/**
 * Check if a data URI contains JSON metadata (for onchain art)
 */
export function isJsonDataURI(dataURI: string): boolean {
  if (!isDataURI(dataURI)) return false;
  const mimeType = parseDataURIMimeType(dataURI);
  return mimeType === 'application/json';
}

/**
 * Parse JSON from a data URI
 */
export function parseJsonDataURI<T = unknown>(dataURI: string): T | null {
  if (!isJsonDataURI(dataURI)) return null;
  
  const content = decodeDataURI(dataURI);
  if (!content) return null;
  
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Error parsing JSON from data URI:', error);
    return null;
  }
}

