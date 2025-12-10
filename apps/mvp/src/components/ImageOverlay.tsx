"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useAuthMode } from "~/hooks/useAuthMode";

interface ImageOverlayProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen image overlay for viewing artwork at maximum size.
 * Adapts layout for mini-app (true fullscreen) vs web (slight padding).
 */
export function ImageOverlay({ src, alt, isOpen, onClose }: ImageOverlayProps) {
  const { isMiniApp } = useAuthMode();

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
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}







