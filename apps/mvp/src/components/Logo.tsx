"use client";

import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";

interface LogoProps {
  className?: string;
  /** Smaller mark for dense headers (e.g. listing redesign). */
  compact?: boolean;
}

export function Logo({ className, compact }: LogoProps) {
  return (
    <TransitionLink 
      href="/" 
      className={`hover:opacity-80 transition-opacity ${className || ""}`}
      aria-label="cryptoart.social - Go to homepage"
    >
      <Image
        src="/cryptoart-logo-wgmeets.png"
        alt="cryptoart.social"
        width={140}
        height={40}
        className={compact ? "h-8 w-auto sm:h-9" : "h-[64px] w-auto"}
        priority
      />
    </TransitionLink>
  );
}

