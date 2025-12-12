import { useState, useEffect } from 'react';

/**
 * Custom hook for countdown timer
 * Returns formatted countdown string in compact format: "Xd Xh Xm Xs"
 * Updates every second
 */
export function useCountdown(endTime: number): string {
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, endTime - now);
  });

  useEffect(() => {
    // Update immediately
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, endTime - now);
    setTimeRemaining(remaining);

    // If already ended, don't set up interval
    if (remaining <= 0) {
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, endTime - now);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // Format as "Xd Xh Xm Xs" for compact display
  if (timeRemaining <= 0) {
    return 'Ended';
  }

  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  const parts: string[] = [];
  
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return parts.join(' ');
}
