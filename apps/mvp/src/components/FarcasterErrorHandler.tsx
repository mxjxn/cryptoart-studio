"use client";

import { useEffect } from "react";

/**
 * Client-side component that monitors for and hides full-screen Farcaster error messages.
 * This prevents the "sign-in with Farcaster is unavailable" error from blocking the app.
 */
export function FarcasterErrorHandler() {
  useEffect(() => {
    // Function to hide error overlays
    const hideErrorOverlays = () => {
      // Find all elements that might contain the error message
      const allElements = document.querySelectorAll("*");
      
      allElements.forEach((element) => {
        const text = element.textContent?.toLowerCase() || "";
        
        // Check if this element contains the error message
        if (
          text.includes("sign-in with farcaster is unavailable") ||
          text.includes("farcaster is unavailable") ||
          (text.includes("unavailable") && 
           text.includes("farcaster") && 
           text.includes("sign-in"))
        ) {
          // Check if it's a full-screen overlay (covers most of the viewport)
          const rect = element.getBoundingClientRect();
          const isFullScreen =
            (rect.width > window.innerWidth * 0.8 &&
             rect.height > window.innerHeight * 0.8) ||
            element.classList.toString().toLowerCase().includes("modal") ||
            element.classList.toString().toLowerCase().includes("overlay") ||
            element.classList.toString().toLowerCase().includes("dialog");

          if (isFullScreen) {
            console.warn("Hiding full-screen Farcaster error overlay");
            (element as HTMLElement).style.display = "none";
            // Also try to remove it from the DOM
            element.remove();
          }
        }
      });
    };

    // Run immediately
    hideErrorOverlays();

    // Set up a MutationObserver to catch dynamically added error overlays
    const observer = new MutationObserver(() => {
      hideErrorOverlays();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // Also check periodically as a fallback
    const interval = setInterval(hideErrorOverlays, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null; // This component doesn't render anything
}

