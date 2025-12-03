import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Check if the View Transitions API is supported in the current browser
 */
function isViewTransitionSupported(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

/**
 * Navigate with view transition animation if supported, otherwise use regular navigation
 * 
 * @param router - Next.js App Router instance
 * @param href - The URL to navigate to
 * @param options - Optional navigation options
 */
export function transitionNavigate(
  router: AppRouterInstance,
  href: string,
  options?: { scroll?: boolean }
): void {
  if (isViewTransitionSupported()) {
    // Use View Transitions API for smooth animation
    (document as any).startViewTransition(() => {
      router.push(href, options);
    });
  } else {
    // Fallback to regular navigation
    router.push(href, options);
  }
}

