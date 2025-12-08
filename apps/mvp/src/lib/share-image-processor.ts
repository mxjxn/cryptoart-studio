/**
 * Share Image Processor
 * 
 * Ensures images are ready for sharing by:
 * 1. Checking if embed thumbnail exists
 * 2. Generating thumbnail if needed
 * 3. Waiting for processing to complete
 * 4. Returning thumbnail URL or detailed error
 */

export interface ImageProcessingError {
  type: 'fetch_timeout' | 'compression_failure' | 'cache_failure' | 'invalid_format' | 'network_error' | 'unknown';
  message: string;
  originalImageUrl: string;
  timestamp: string;
  details?: any;
}

export interface ImageProcessingResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: ImageProcessingError;
}

/**
 * Process image for sharing - ensures embed thumbnail is ready
 */
export async function processImageForShare(
  imageUrl: string | null | undefined,
  timeout: number = 30000
): Promise<ImageProcessingResult> {
  if (!imageUrl) {
    return {
      success: false,
      error: {
        type: 'unknown',
        message: 'No image URL provided',
        originalImageUrl: '',
        timestamp: new Date().toISOString(),
      },
    };
  }

  const startTime = Date.now();

  try {
    // Check if thumbnail already exists
    const checkResponse = await fetch(
      `/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=embed`
    );

    if (!checkResponse.ok) {
      const errorData = await checkResponse.json().catch(() => ({}));
      
      // If it's a 500 error, it might be generating - wait a bit and retry
      if (checkResponse.status === 500 && errorData.error) {
        // Wait up to timeout for generation
        const maxWait = timeout;
        const pollInterval = 1000; // Check every second
        let waited = 0;

        while (waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waited += pollInterval;

          const retryResponse = await fetch(
            `/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=embed`
          );

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.thumbnailUrl) {
              return {
                success: true,
                thumbnailUrl: retryData.thumbnailUrl,
              };
            }
          }

          // Check if we've exceeded timeout
          if (Date.now() - startTime > timeout) {
            throw new Error(`Image processing timeout after ${timeout}ms`);
          }
        }
      }

      // If we get here, generation failed
      const errorMessage = errorData.message || errorData.error || 'Failed to generate thumbnail';
      throw new Error(errorMessage);
    }

    const data = await checkResponse.json();

    if (data.error) {
      // API returned an error
      const errorType = data.message?.includes('timeout') ? 'fetch_timeout' :
                       data.message?.includes('sharp') ? 'compression_failure' :
                       data.message?.includes('storage') ? 'cache_failure' :
                       data.message?.includes('format') ? 'invalid_format' :
                       'unknown';

      const error: ImageProcessingError = {
        type: errorType,
        message: data.message || data.error || 'Failed to process image',
        originalImageUrl: imageUrl,
        timestamp: new Date().toISOString(),
        details: data,
      };

      console.error('[Share Image Processor] Error processing image:', {
        errorType: error.type,
        message: error.message,
        imageUrl: error.originalImageUrl,
        timestamp: error.timestamp,
        details: error.details,
      });

      return {
        success: false,
        error,
      };
    }

    // Success - return thumbnail URL
    return {
      success: true,
      thumbnailUrl: data.thumbnailUrl || imageUrl, // Fallback to original if no thumbnail
    };
  } catch (error) {
    // Determine error type
    let errorType: ImageProcessingError['type'] = 'unknown';
    let errorMessage = 'Unknown error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorType = 'fetch_timeout';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = 'network_error';
      } else if (error.message.includes('sharp') || error.message.includes('resize')) {
        errorType = 'compression_failure';
      } else if (error.message.includes('format') || error.message.includes('invalid')) {
        errorType = 'invalid_format';
      }
    }

    const processingError: ImageProcessingError = {
      type: errorType,
      message: errorMessage,
      originalImageUrl: imageUrl,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? { name: error.name, stack: error.stack } : error,
    };

    console.error('[Share Image Processor] Error processing image:', {
      errorType: processingError.type,
      message: processingError.message,
      imageUrl: processingError.originalImageUrl,
      timestamp: processingError.timestamp,
      details: processingError.details,
      processingTime: Date.now() - startTime,
    });

    return {
      success: false,
      error: processingError,
    };
  }
}

