"use client";

import { useState, useEffect } from "react";
import { getMediaType, getMediaTypeFromFormat, type MediaType } from "~/lib/media-utils";
import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { ModelViewer } from "./ModelViewer";
import { HTMLViewer } from "./HTMLViewer";

interface MediaDisplayProps {
  /** The image URL (thumbnail/cover) */
  imageUrl?: string;
  /** The animation URL (audio, video, 3D, HTML) */
  animationUrl?: string;
  /** Optional format hint from metadata (e.g., "MP4", "mp3", "glb") for URLs without extensions */
  animationFormat?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Optional click handler for fullscreen/overlay */
  onImageClick?: () => void;
  /** View transition name for smooth page transitions */
  viewTransitionName?: string;
  className?: string;
}

/**
 * Unified media display component that routes to the appropriate player
 * based on the media type of the animation_url
 * 
 * Priority:
 * 1. If animationUrl exists and is non-image media → use appropriate player
 * 2. Otherwise → display image
 * 3. Fallback → gradient placeholder
 */
export function MediaDisplay({
  imageUrl,
  animationUrl,
  animationFormat,
  alt = "NFT Artwork",
  onImageClick,
  viewTransitionName,
  className = "",
}: MediaDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [animationError, setAnimationError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [imageUrl, animationUrl]);

  // Determine media type from animation URL, falling back to format hint if URL detection fails
  let animationMediaType: MediaType | null = null;
  if (animationUrl) {
    animationMediaType = getMediaType(animationUrl);
    // If URL-based detection returned 'image' but we have a format hint, use that instead
    // This handles Arweave/IPFS URLs that don't have file extensions
    if (animationMediaType === 'image' && animationFormat) {
      const formatType = getMediaTypeFromFormat(animationFormat);
      if (formatType !== 'image') {
        animationMediaType = formatType;
      }
    }
  }
  
  // Determine what to display
  // Use animation_url if it's non-image media and hasn't errored
  const useAnimation = animationUrl && animationMediaType && animationMediaType !== 'image' && !animationError;

  // Fallback to image if animation fails
  const handleAnimationError = () => {
    setAnimationError(true);
  };

  // Render based on media type
  if (useAnimation && animationMediaType) {
    switch (animationMediaType) {
      case 'audio':
        return (
          <AudioPlayer
            src={animationUrl!}
            title={alt}
            coverImage={imageUrl}
            className={className}
          />
        );

      case 'video':
        return (
          <VideoPlayer
            src={animationUrl!}
            poster={imageUrl}
            className={className}
          />
        );

      case '3d':
        return (
          <ModelViewer
            src={animationUrl!}
            poster={imageUrl}
            alt={alt}
            className={className}
          />
        );

      case 'html':
        return (
          <HTMLViewer
            src={animationUrl!}
            title={alt}
            className={className}
          />
        );
    }
  }

  // Default: Display image
  const displayUrl = imageUrl || animationUrl;

  if (!displayUrl || imageError) {
    // Fallback gradient placeholder
    return (
      <div
        className={`w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2] ${className}`}
        style={{ viewTransitionName }}
      />
    );
  }

  return (
    <div className={`relative w-full ${className}`} style={{ viewTransitionName }}>
      {!imageLoaded && !imageError && (
        <div
          className="absolute inset-0 z-0 min-h-[200px] bg-[#1a1a1a] animate-pulse"
          aria-hidden
        />
      )}
      <p className="sr-only" aria-live="polite">
        {!imageLoaded && !imageError ? "Loading artwork…" : ""}
      </p>
      {onImageClick ? (
        <button
          type="button"
          onClick={onImageClick}
          className="relative z-10 block w-full cursor-zoom-in"
          aria-label="View artwork fullscreen"
        >
          <img
            src={displayUrl}
            alt={alt}
            className={`max-h-[80vh] w-full object-contain transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </button>
      ) : (
        <div className="relative z-10 block w-full">
          <img
            src={displayUrl}
            alt={alt}
            className={`max-h-[80vh] w-full object-contain transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Export media type for external use
 */
export { type MediaType };

