"use client";

import { useState, useRef, useEffect } from "react";
import { Maximize, Minimize, ExternalLink } from "lucide-react";

interface HTMLViewerProps {
  src: string;
  title?: string;
  className?: string;
}

/**
 * HTML content viewer using sandboxed iframe
 * For interactive NFTs built with HTML/JavaScript
 * Uses basic sandbox security: allow-scripts, allow-same-origin
 */
export function HTMLViewer({ src, title = "Interactive Content", className = "" }: HTMLViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  };

  // Open in new tab
  const openInNewTab = () => {
    window.open(src, "_blank", "noopener,noreferrer");
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Handle iframe load
  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setError("Failed to load content");
    setIsLoading(false);
  };

  if (error) {
    return (
      <div className={`bg-[#111] border border-[#333] aspect-square flex items-center justify-center ${className}`}>
        <div className="text-[#999] text-center p-4">
          <p className="text-sm">{error}</p>
          <button
            onClick={openInNewTab}
            className="mt-3 text-xs text-[var(--color-accent,#fff)] hover:underline flex items-center gap-1 mx-auto"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-[#111] border border-[#333] ${className}`}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111] z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[var(--color-accent,#fff)] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#999]">Loading interactive content...</p>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="w-full h-full min-h-[300px] aspect-square border-0"
        // Basic sandbox: allow scripts to run and same-origin for interactive features
        // This is the security level you specified
        sandbox="allow-scripts allow-same-origin"
        allow="accelerometer; autoplay; encrypted-media; gyroscope"
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Controls overlay */}
      <div className="absolute top-2 right-2 flex gap-2 z-20">
        {/* Open in new tab */}
        <button
          onClick={openInNewTab}
          className="p-2 bg-black/70 text-white hover:bg-black/90 transition-colors"
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-black/70 text-white hover:bg-black/90 transition-colors"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Interactive indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-[#666] bg-black/50 px-2 py-1 pointer-events-none">
        Interactive
      </div>
    </div>
  );
}



