"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, type MouseEvent } from "react";

interface TransitionLinkProps extends Omit<LinkProps, "onClick"> {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
}

/**
 * Link component that uses View Transitions API for smooth page transitions
 * Falls back to regular Link behavior if View Transitions API is not supported
 */
export function TransitionLink({
  href,
  children,
  className,
  onClick,
  prefetch,
  ...props
}: TransitionLinkProps) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    onClick?.(e);

    // If default behavior is prevented, don't handle navigation
    if (e.defaultPrevented) {
      return;
    }

    // Only handle same-origin navigation
    const url = typeof href === "string" ? href : href.pathname || "";
    if (!url.startsWith("/")) {
      return; // External link, let browser handle it
    }

    // Prevent default navigation
    e.preventDefault();

    // Convert href to string format for router.push
    const hrefString = typeof href === "string" 
      ? href 
      : href.pathname + (href.query ? `?${new URLSearchParams(href.query as Record<string, string>).toString()}` : "") + (href.hash || "");

    // Use view transition if supported
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        router.push(hrefString);
      });
    } else {
      // Fallback to regular navigation
      router.push(hrefString);
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick} prefetch={prefetch} {...props}>
      {children}
    </Link>
  );
}

