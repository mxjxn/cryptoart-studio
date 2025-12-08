"use client";

import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
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
        className="h-[64px] w-auto"
        priority
      />
    </TransitionLink>
  );
}

