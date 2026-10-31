import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeOnlineStatus, emitOnlineStatus } from '@/services/api';

const PING_INTERVAL_MS = 30_000; // Periodic ping every 30 seconds
const PING_TIMEOUT_MS = 5_000; // Ping timeout (detect offline within 5s per Req 16.4)
const ONLINE_DISMISS_DELAY_MS = 3_000; // Dismiss online banner after 3s per Req 16.6

export interface OnlineStatus {
  /** Whether the user is currently online */
  isOnline: boolean;
  /** Whether the "back online" confirmation banner should show */
  showOnlineRestored: boolean;
}

/**
 * Hook for offline detection and online status tracking.
 *
 * Combines browser's navigator.onLine with periodic pings to reliably
 * detect connectivity changes. Emits events via the api event bus and
 * provides local state for UI rendering.
 *
 * Requirement 16.4: Detect offline within 5 seconds
 * Requirement 16.6: Dismiss offline banner within 3 seconds of restoration
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showOnlineRestored, setShowOnlineRestored] = useState(false);
  const previousOnlineRef = useRef(isOnline);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateOnlineStatus = useCallback((online: boolean) => {
    setIsOnline((prev) => {
      if (prev !== online) {
        emitOnlineStatus(online);

        // If transitioning from offline → online, show restoration banner
        if (!previousOnlineRef.current && online) {
          setShowOnlineRestored(true);
          // Auto-dismiss after 3 seconds (Req 16.6)
          restoredTimeoutRef.current = setTimeout(() => {
            setShowOnlineRestored(false);
          }, ONLINE_DISMISS_DELAY_MS);
        }

        previousOnlineRef.current = online;
      }
      return online;
    });
  }, []);

  /**
   * Periodic ping to detect connectivity reliably.
   * Uses a lightweight HEAD request to the API health endpoint.
   */
  const performPing = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      updateOnlineStatus(true);
    } catch {
      // If navigator says we're online but ping failed, consider offline
      if (!navigator.onLine) {
        updateOnlineStatus(false);
      }
      // If navigator says online but ping failed, it might be a server issue,
      // not necessarily offline. Only mark offline if navigator also says offline.
    }
  }, [updateOnlineStatus]);

  useEffect(() => {
    // Browser online/offline events
    const handleOnline = () => updateOnlineStatus(true);
    const handleOffline = () => updateOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to API-level network error events
    const unsubscribe = subscribeOnlineStatus((online) => {
      updateOnlineStatus(online);
    });

    // Start periodic ping for more reliable detection
    pingIntervalRef.current = setInterval(performPing, PING_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (restoredTimeoutRef.current) {
        clearTimeout(restoredTimeoutRef.current);
      }
    };
  }, [updateOnlineStatus, performPing]);

  return { isOnline, showOnlineRestored };
}
