"use client";

import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { SignInButton } from "@farcaster/auth-kit";

interface SafeSignInButtonProps {
  onSuccess?: (data: { fid: number; username: string }) => void;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * Internal error boundary for SignInButton component
 */
class SignInButtonErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SignInButton render error:", error, errorInfo);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle the error display
    }
    return this.props.children;
  }
}

/**
 * Wrapper around SignInButton that gracefully handles errors.
 * If Farcaster sign-in is unavailable, it shows a fallback message
 * instead of a full-screen error.
 */
export function SafeSignInButton({
  onSuccess,
  onError,
  className,
}: SafeSignInButtonProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset error state when component remounts
  useEffect(() => {
    setHasError(false);
    setErrorMessage(null);
  }, []);

  const handleError = (error: Error | unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message?.toLowerCase() || "";
    
    // Check if this is an "unavailable" error
    if (
      message.includes("unavailable") ||
      message.includes("sign-in with farcaster") ||
      message.includes("failed to initialize") ||
      message.includes("auth-kit")
    ) {
      console.warn("Farcaster sign-in unavailable:", err);
      setHasError(true);
      setErrorMessage("Farcaster sign-in is currently unavailable");
    } else {
      console.error("Farcaster sign-in error:", err);
      setHasError(true);
      setErrorMessage("Sign-in failed. Please try connecting with a wallet instead.");
    }

    // Call the parent error handler if provided
    if (onError) {
      onError(err);
    }
  };

  // If there's an error, show a graceful fallback
  if (hasError) {
    return (
      <div className={className}>
        <div className="px-4 py-2 text-sm text-[#999999] text-center">
          {errorMessage || "Farcaster sign-in is unavailable"}
        </div>
        <div className="px-4 py-1 text-xs text-[#666666] text-center">
          Please use wallet connection below
        </div>
      </div>
    );
  }

  // Wrap SignInButton in an error boundary to catch render errors
  return (
    <SignInButtonErrorBoundary onError={handleError}>
      <div className={className}>
        <SignInButton
          onSuccess={(data) => {
            setHasError(false);
            setErrorMessage(null);
            if (onSuccess && data.fid !== undefined) {
              onSuccess({ fid: data.fid, username: data.username || "" });
            }
          }}
          onError={handleError}
        />
      </div>
    </SignInButtonErrorBoundary>
  );
}

