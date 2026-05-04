"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { rewritePublicIpfsUrlForClient } from "~/lib/ipfs-gateway-public-url";

interface ImageOverlayProps {
  src: string;
  /** Tried in order if `src` fails to load (e.g. flaky ipfs.io full file → cached WebP thumb). */
  fallbackSrcs?: string[];
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

function dedupeUrls(urls: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Full-screen image overlay for viewing artwork at maximum size.
 * Adapts layout for mini-app (true fullscreen) vs web (slight padding).
 */
export function ImageOverlay({ src, fallbackSrcs, alt, isOpen, onClose }: ImageOverlayProps) {
  const { isMiniApp } = useAuthMode();

  const candidateUrls = useMemo(
    () => dedupeUrls([src, ...(fallbackSrcs ?? [])]).map((u) => rewritePublicIpfsUrlForClient(u)),
    [src, fallbackSrcs]
  );

  const [attemptIndex, setAttemptIndex] = useState(0);
  const displaySrc = candidateUrls[attemptIndex] ?? candidateUrls[0] ?? "";

  useEffect(() => {
    if (isOpen) {
      setAttemptIndex(0);
    }
  }, [isOpen, src, fallbackSrcs]);

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
      // Prevent body scroll when overlay is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-200 ${
        isMiniApp ? "inset-0" : "inset-0 md:inset-4 md:rounded-lg"
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fullscreen view of ${alt}`}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close fullscreen view"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image container - prevent clicks from closing */}
      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={`${attemptIndex}-${displaySrc}`}
          src={displaySrc}
          alt={alt}
          className="max-w-full max-h-full object-contain"
          onError={() => {
            setAttemptIndex((i) => (i < candidateUrls.length - 1 ? i + 1 : i));
          }}
        />
      </div>
    </div>
  );
}









