"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for catching Farcaster auth-kit errors.
 * Prevents full-screen errors from blocking the app.
 */
export class FarcasterErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a Farcaster-related error
    const errorMessage = error?.message?.toLowerCase() || "";
    const isFarcasterError =
      errorMessage.includes("farcaster") ||
      errorMessage.includes("sign-in") ||
      errorMessage.includes("unavailable") ||
      errorMessage.includes("auth-kit");

    if (isFarcasterError) {
      console.warn("Farcaster authentication error caught:", error);
      return { hasError: true, error };
    }

    // Re-throw non-Farcaster errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("FarcasterErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // If we have a custom fallback, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, just render children (graceful degradation)
      // The app should work without Farcaster auth
      return this.props.children;
    }

    return this.props.children;
  }
}





