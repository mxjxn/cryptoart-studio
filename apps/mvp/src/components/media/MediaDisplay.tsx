"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from "react";
import { getMediaType, getMediaTypeFromFormat, type MediaType } from "~/lib/media-utils";
import { rewritePublicIpfsUrlForClient } from "~/lib/ipfs-gateway-public-url";
import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { ModelViewer } from "./ModelViewer";
import { HTMLViewer } from "./HTMLViewer";

/** Milliseconds to wait for an image to load before trying the next fallback URL. */
const IMAGE_LOAD_TIMEOUT_MS = 8000;

interface MediaDisplayProps {
  /** The image URL (thumbnail/cover) */
  imageUrl?: string;
  /** Fallback image URLs tried in order if the primary imageUrl fails or times out */
  fallbackSrcs?: string[];
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
  /** Max height for inline image (default ~⅔ viewport for listing heroes) */
  maxHeightClass?: string;
  /** When no image (or error), use this CSS background instead of the default purple gradient */
  placeholderGradientCss?: string;
}

/**
 * Unified media display component that routes to the appropriate player
 * based on the media type of the animation_url
 * 
 * Priority:
 * 1. If animationUrl exists and is non-image media → use appropriate player
 * 2. Otherwise → display image (with fallback URL chain + load timeout)
 * 3. Fallback → gradient placeholder
 */
export function MediaDisplay({
  imageUrl,
  fallbackSrcs,
  animationUrl,
  animationFormat,
  alt = "NFT Artwork",
  onImageClick,
  viewTransitionName,
  className = "",
  maxHeightClass = "max-h-[min(66vh,85dvh)]",
  placeholderGradientCss,
}: MediaDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [animationError, setAnimationError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(0);
  // Ref to track successful image load — avoids stale-closure issues in the timeout callback
  const imageLoadedRef = useRef(false);

  // Deduplicated list of image candidate URLs: primary + fallbacks
  const imageCandidates = useMemo(() => {
    const srcs = [imageUrl, ...(fallbackSrcs ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
    const seen = new Set<string>();
    return srcs.filter(u => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [imageUrl, fallbackSrcs]);

  // Reset all state when the source URLs change
  useEffect(() => {
    imageLoadedRef.current = false;
    setImageLoaded(false);
    setImageError(false);
    setAttemptIndex(0);
  }, [imageUrl, animationUrl, fallbackSrcs]);

  // Advance to the next fallback URL if the current one times out
  useEffect(() => {
    if (imageLoaded || imageError) return;
    // Only apply timeout when we're in the imageCandidates range
    if (attemptIndex >= imageCandidates.length) return;

    const timer = setTimeout(() => {
      // Guard: if the image already loaded successfully, do nothing
      if (imageLoadedRef.current) return;
      if (attemptIndex < imageCandidates.length - 1) {
        setAttemptIndex(i => i + 1);
      } else {
        // All candidates timed out; show the error/placeholder state
        setImageError(true);
      }
    }, IMAGE_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [attemptIndex, imageLoaded, imageError, imageCandidates.length]);

  // Advance to the next fallback URL on load error, or mark as failed if exhausted
  const handleImageError = useCallback(() => {
    if (attemptIndex < imageCandidates.length - 1) {
      setAttemptIndex(i => i + 1);
    } else {
      setImageError(true);
    }
  }, [attemptIndex, imageCandidates.length]);

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
  // Use the current candidate from the fallback chain, then animationUrl as a last resort
  const displayUrl = imageCandidates[attemptIndex] ?? animationUrl;

  const imgSrc = displayUrl ? rewritePublicIpfsUrlForClient(displayUrl) : "";

  if (!displayUrl || imageError) {
    const placeholderStyle: CSSProperties = {
      viewTransitionName,
      ...(placeholderGradientCss ? { background: placeholderGradientCss } : {}),
    };
    return (
      <div
        className={`w-full aspect-square ${
          placeholderGradientCss ? "" : "bg-gradient-to-br from-[#667eea] to-[#764ba2]"
        } ${className}`}
        style={placeholderStyle}
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
            key={imgSrc}
            src={imgSrc}
            alt={alt}
            className={`${maxHeightClass} w-full object-contain transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => { imageLoadedRef.current = true; setImageLoaded(true); }}
            onError={handleImageError}
          />
        </button>
      ) : (
        <div className="relative z-10 block w-full">
          <img
            key={imgSrc}
            src={imgSrc}
            alt={alt}
            className={`${maxHeightClass} w-full object-contain transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => { imageLoadedRef.current = true; setImageLoaded(true); }}
            onError={handleImageError}
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

