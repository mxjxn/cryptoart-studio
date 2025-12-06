"use client";

import { useState } from "react";
import { getMediaType, type MediaType } from "~/lib/media-utils";
import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { ModelViewer } from "./ModelViewer";
import { HTMLViewer } from "./HTMLViewer";

interface MediaDisplayProps {
  /** The image URL (thumbnail/cover) */
  imageUrl?: string;
  /** The animation URL (audio, video, 3D, HTML) */
  animationUrl?: string;
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
  alt = "NFT Artwork",
  onImageClick,
  viewTransitionName,
  className = "",
}: MediaDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [animationError, setAnimationError] = useState(false);

  // Determine media type from animation URL
  const animationMediaType: MediaType | null = animationUrl ? getMediaType(animationUrl) : null;
  
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
    <button
      type="button"
      onClick={onImageClick}
      className={`w-full cursor-zoom-in block ${className}`}
      disabled={!onImageClick}
      style={{ cursor: onImageClick ? "zoom-in" : "default" }}
      aria-label={onImageClick ? "View artwork fullscreen" : undefined}
    >
      <img
        src={displayUrl}
        alt={alt}
        className="w-full max-h-[80vh] object-contain"
        style={{ viewTransitionName }}
        onError={() => setImageError(true)}
      />
    </button>
  );
}

/**
 * Export media type for external use
 */
export { type MediaType };

