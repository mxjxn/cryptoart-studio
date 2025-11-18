"use client";

import { useState } from "react";
import { APP_NAME } from "~/lib/constants";
import sdk from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";
import { HueSlider, ThemeSelector } from "@repo/ui/components";

type HeaderProps = {
  neynarUser?: {
    fid: number;
    score: number;
  } | null;
};

export function Header({ neynarUser }: HeaderProps) {
  const { context } = useMiniApp();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  return (
    <div className="relative">
      <div 
        className="mt-3 mb-3 mx-4 px-3 py-2 border-2 flex items-center justify-between"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        <div className="text-base font-mono font-light">
          Welcome to {APP_NAME}!
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <HueSlider />
            <ThemeSelector />
          </div>
          {context?.user && (
            <div 
              className="cursor-pointer"
              onClick={() => {
                setIsUserDropdownOpen(!isUserDropdownOpen);
              }}
            >
              {context.user.pfpUrl && (
                <img 
                  src={context.user.pfpUrl} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full border-2"
                  style={{ borderColor: 'var(--color-primary)' }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {context?.user && (
        <>      
          {isUserDropdownOpen && (
            <div 
              className="absolute top-full right-0 z-50 w-fit mt-1 mx-4 border-2 p-3 space-y-2 font-mono"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
              }}
            >
              <div className="text-right">
                <h3 
                  className="font-bold text-sm hover:underline cursor-pointer inline-block"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => sdk.actions.viewProfile({ fid: context.user.fid })}
                >
                  {context.user.displayName || context.user.username}
                </h3>
                <p className="text-xs" style={{ opacity: 0.8 }}>
                  @{context.user.username}
                </p>
                <p className="text-xs" style={{ opacity: 0.7 }}>
                  FID: {context.user.fid}
                </p>
                {neynarUser && (
                  <>
                    <p className="text-xs" style={{ opacity: 0.7 }}>
                      Neynar Score: {neynarUser.score}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
