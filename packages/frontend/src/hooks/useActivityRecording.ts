import { useEffect, useRef } from 'react';
import { recordActivity } from '@/services/dashboard.service';

/**
 * Fire-and-forget hook that records user activity once per mount.
 * Errors are silently ignored. Cancels on unmount.
 */
export function useActivityRecording(): void {
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const controller = new AbortController();
    recordActivity(controller.signal).catch(() => {
      // Silently ignore - per Requirement 3.4
    });

    return () => {
      controller.abort();
    };
  }, []);
}
