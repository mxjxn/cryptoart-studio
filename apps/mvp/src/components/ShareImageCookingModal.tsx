"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { processImageForShare, type ImageProcessingResult } from "~/lib/share-image-processor";
import { sdk } from "@farcaster/miniapp-sdk";

interface ShareImageCookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  artworkUrl: string | null | undefined;
  shareUrl: string;
  castText: string;
  artworkName?: string;
  artistName?: string;
  price?: string;
  priceSymbol?: string;
  onShare: (thumbnailUrl: string | null) => void;
}

type ModalState = 'cooking' | 'ready' | 'error';

/**
 * Animated shapes for cooking state - terminal-like aesthetic
 */
function CookingShapes() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cooking-float {
          0%, 100% { transform: translateY(0px); opacity: 0.6; }
          50% { transform: translateY(-20px); opacity: 1; }
        }
        @keyframes cooking-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cooking-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes cooking-slide {
          0%, 100% { transform: translate(-50%, -50%) rotate(45deg) translateX(0px); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) rotate(45deg) translateX(10px); opacity: 1; }
        }
      `}} />
      <div className="relative w-full h-64 flex items-center justify-center overflow-hidden">
        {/* Moving shapes - terminal-like aesthetic */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Circle - moving */}
          <div 
            className="absolute w-16 h-16 border border-[#666666] rounded-full"
            style={{
              left: '20%',
              top: '30%',
              animation: 'cooking-float 3s ease-in-out infinite',
            }}
          />
          {/* Square - rotating */}
          <div 
            className="absolute w-12 h-12 border border-[#666666]"
            style={{
              left: '60%',
              top: '40%',
              animation: 'cooking-rotate 4s linear infinite',
            }}
          />
          {/* Triangle - pulsing */}
          <div 
            className="absolute w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-[#666666]"
            style={{
              left: '40%',
              top: '60%',
              animation: 'cooking-pulse 2s ease-in-out infinite',
            }}
          />
          {/* Line - sliding */}
          <div 
            className="absolute w-24 h-0.5 bg-[#666666]"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              animation: 'cooking-slide 2.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </>
  );
}

/**
 * Share Image Cooking Modal
 * Shows processing state, preview, and handles sharing
 */
export function ShareImageCookingModal({
  isOpen,
  onClose,
  artworkUrl,
  shareUrl,
  castText,
  artworkName,
  artistName,
  price,
  priceSymbol,
  onShare,
}: ShareImageCookingModalProps) {
  const { isMiniApp } = useAuthMode();
  const [state, setState] = useState<ModalState>('cooking');
  const [processingStep, setProcessingStep] = useState<string>('Fetching image...');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState<ImageProcessingResult['error'] | null>(null);

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      
      // Reset state when modal opens
      setState('cooking');
      setProcessingStep('Fetching image...');
      setThumbnailUrl(null);
      setError(null);

      // Process image
      if (artworkUrl) {
        processImage();
      } else {
        // No image URL - go straight to error state with text-only layout
        setState('error');
        setError({
          type: 'unknown',
          message: 'No image available',
          originalImageUrl: '',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, artworkUrl, handleKeyDown]);

  const processImage = async () => {
    if (!artworkUrl) return;

    try {
      setProcessingStep('Fetching image...');
      
      // Small delay to show the step
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setProcessingStep('Compressing...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setProcessingStep('Caching...');
      
      // Process the image
      const result = await processImageForShare(artworkUrl, 30000);
      
      if (result.success && result.thumbnailUrl) {
        // If shareUrl is an OG image URL, verify it's ready before allowing share
        if (shareUrl.includes('/opengraph-image') || shareUrl.includes('/opengraph-image')) {
          setProcessingStep('Verifying embed...');
          try {
            // Check if OG image is ready by making a HEAD request
            const ogImageUrl = shareUrl.replace(/\/opengraph-image.*$/, '/opengraph-image');
            const headResponse = await fetch(ogImageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (!headResponse.ok && headResponse.status !== 200) {
              console.warn(`[ShareImageCookingModal] OG image not ready yet (status: ${headResponse.status}), but continuing anyway`);
            }
          } catch (error) {
            // Don't block sharing if OG image check fails - it might be ready by the time the cast is posted
            console.warn(`[ShareImageCookingModal] Could not verify OG image readiness:`, error);
          }
        }
        
        setProcessingStep('Ready!');
        await new Promise(resolve => setTimeout(resolve, 500));
        setThumbnailUrl(result.thumbnailUrl);
        setState('ready');
      } else {
        // Error occurred
        setError(result.error || {
          type: 'unknown',
          message: 'Failed to process image',
          originalImageUrl: artworkUrl,
          timestamp: new Date().toISOString(),
        });
        setState('error');
      }
    } catch (err) {
      const processingError: ImageProcessingResult['error'] = {
        type: 'unknown',
        message: err instanceof Error ? err.message : 'Unknown error',
        originalImageUrl: artworkUrl || '',
        timestamp: new Date().toISOString(),
        details: err,
      };
      setError(processingError);
      setState('error');
    }
  };

  const handleShare = () => {
    onShare(thumbnailUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-200 ${
        isMiniApp ? "inset-0" : "inset-0 md:inset-4 md:rounded-lg"
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share image preview"
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close share modal"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Content container - prevent clicks from closing */}
      <div
        className="w-full max-w-2xl mx-4 bg-black border border-[#333333] rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {state === 'cooking' && (
          <div className="text-center">
            <div className="mb-4">
              <CookingShapes />
            </div>
            <h2 className="text-xl font-light text-white mb-2">Cooking your image</h2>
            <p className="text-sm text-[#999999]">{processingStep}</p>
          </div>
        )}

        {state === 'ready' && thumbnailUrl && (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-white mb-4">Preview</h2>
            
            {/* Thumbnail preview */}
            <div className="border border-[#333333] rounded-lg overflow-hidden bg-[#0a0a0a]">
              <img
                src={thumbnailUrl}
                alt={artworkName || "Artwork"}
                className="w-full h-auto"
              />
            </div>

            {/* Artwork details */}
            <div className="space-y-2 text-sm">
              {artworkName && (
                <div className="flex items-start gap-2">
                  <span className="text-[#999999] min-w-[80px]">title:</span>
                  <span className="text-[#cccccc] font-mono">{artworkName}</span>
                </div>
              )}
              {artistName && (
                <div className="flex items-start gap-2">
                  <span className="text-[#999999] min-w-[80px]">artist:</span>
                  <span className="text-[#cccccc] font-mono">{artistName}</span>
                </div>
              )}
              {price && (
                <div className="flex items-start gap-2">
                  <span className="text-[#999999] min-w-[80px]">price:</span>
                  <span className="text-[#cccccc] font-mono">
                    {price} {priceSymbol || 'ETH'}
                  </span>
                </div>
              )}
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full px-4 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
              aria-label="Share this artwork"
            >
              SHARE
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <h2 className="text-xl font-light text-white mb-4">Share Preview</h2>
            
            {/* Text-only layout with full OG details */}
            <div className="border border-[#333333] rounded-lg p-6 bg-[#0a0a0a] space-y-3">
              {artworkName && (
                <div>
                  <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">Title</div>
                  <div className="text-lg text-white font-light">{artworkName}</div>
                </div>
              )}
              {artistName && (
                <div>
                  <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">Artist</div>
                  <div className="text-sm text-[#cccccc] font-mono">{artistName}</div>
                </div>
              )}
              {price && (
                <div>
                  <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">Price</div>
                  <div className="text-sm text-[#cccccc] font-mono">
                    {price} {priceSymbol || 'ETH'}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">Link</div>
                <div className="text-xs text-[#999999] font-mono break-all">{shareUrl}</div>
              </div>
            </div>

            {/* Share button (link only, no image) */}
            <button
              onClick={() => {
                onShare(null); // No thumbnail URL
                onClose();
              }}
              className="w-full px-4 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
              aria-label="Share link (no image)"
            >
              SHARE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

