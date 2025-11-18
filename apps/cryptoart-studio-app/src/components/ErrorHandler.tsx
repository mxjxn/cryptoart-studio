"use client";

import { useEffect } from "react";
import { installGlobalErrorHandler } from "~/lib/errorHandler";

export function ErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  return <>{children}</>;
}

