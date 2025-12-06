"use client";

import { useState, useEffect, createElement } from "react";
import Script from "next/script";

interface ModelViewerProps {
  src: string;
  poster?: string;
  alt?: string;
  className?: string;
}

/**
 * 3D model viewer using @google/model-viewer web component
 * Supports GLB and GLTF formats
 * Styled to match the minimal/colorful theme
 */
export function ModelViewer({ src, poster, alt = "3D Model", className = "" }: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Check if model-viewer is already defined (for hydration)
  useEffect(() => {
    if (typeof customElements !== "undefined" && customElements.get("model-viewer")) {
      setScriptLoaded(true);
    }
  }, []);

  // Handle model load events via MutationObserver since model-viewer uses custom events
  useEffect(() => {
    if (!scriptLoaded) return;

    // Give the element time to render
    const timer = setTimeout(() => {
      const modelViewer = document.querySelector(`model-viewer[src="${src}"]`);
      if (modelViewer) {
        const handleLoad = () => setIsLoading(false);
        const handleError = () => {
          setError("Failed to load 3D model");
          setIsLoading(false);
        };

        modelViewer.addEventListener("load", handleLoad);
        modelViewer.addEventListener("error", handleError);

        // Check if already loaded
        if ((modelViewer as any).loaded) {
          setIsLoading(false);
        }

        return () => {
          modelViewer.removeEventListener("load", handleLoad);
          modelViewer.removeEventListener("error", handleError);
        };
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [scriptLoaded, src]);

  if (error) {
    return (
      <div className={`bg-[#111] border border-[#333] aspect-square flex items-center justify-center ${className}`}>
        <div className="text-[#999] text-center p-4">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Load model-viewer script */}
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError("Failed to load 3D viewer")}
      />

      <div className={`relative bg-[#111] border border-[#333] ${className}`}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111] z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--color-accent,#fff)] border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#999]">Loading 3D model...</p>
            </div>
          </div>
        )}

        {/* Model viewer - using createElement to avoid JSX type issues with custom elements */}
        {scriptLoaded && createElement("model-viewer", {
          src,
          poster,
          alt,
          "camera-controls": true,
          "auto-rotate": true,
          "touch-action": "pan-y",
          "shadow-intensity": "1",
          exposure: "1",
          loading: "eager",
          style: {
            width: "100%",
            height: "100%",
            minHeight: "300px",
            aspectRatio: "1/1",
            background: "transparent",
            // CSS custom properties for model-viewer
            "--poster-color": "transparent",
            "--progress-bar-color": "var(--color-accent, #fff)",
            "--progress-bar-height": "4px",
          } as React.CSSProperties,
        })}

        {/* Instructions overlay */}
        <div className="absolute bottom-4 left-4 text-xs text-[#666] pointer-events-none">
          Drag to rotate • Scroll to zoom
        </div>
      </div>
    </>
  );
}

