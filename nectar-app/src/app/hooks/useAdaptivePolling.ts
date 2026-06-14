/**
 * Hook to provide adaptive polling intervals that backs off when data is idle.
 *
 * - Starts at baseInterval (e.g., 5000ms)
 * - Increases interval when no data changes after idleThreshold
 * - Caps at maxInterval
 * - Resets to baseInterval when data changes or reset() is called
 *
 * Usage:
 * const { interval, trackDataChange, reset } = useAdaptivePolling({
 *   baseInterval: 5000,
 *   maxInterval: 20000,
 *   idleThreshold: 120000, // 2 minutes of no changes
 *   backoffMultiplier: 2,
 * });
 *
 * useQuery(filters, {
 *   refetchInterval: isVisible ? interval : false,
 *   onSuccess: (data) => trackDataChange(data.total),
 * })
 */

import { useState, useCallback, useRef } from "react";

export interface AdaptivePollingOptions {
  /** Starting poll interval in ms (default: 5000) */
  baseInterval?: number;
  /** Maximum poll interval in ms (default: 20000) */
  maxInterval?: number;
  /** Time without data changes before backing off in ms (default: 120000) */
  idleThreshold?: number;
  /** Multiplier for interval increase (default: 2) */
  backoffMultiplier?: number;
}

export interface AdaptivePollingResult {
  /** Current polling interval in ms */
  interval: number;
  /** Call this with a data fingerprint (e.g., total count) to track changes */
  trackDataChange: (dataFingerprint: string | number) => void;
  /** Force reset to base interval */
  reset: () => void;
}

export function useAdaptivePolling(
  options: AdaptivePollingOptions = {},
): AdaptivePollingResult {
  const {
    baseInterval = 5000,
    maxInterval = 20000,
    idleThreshold = 120000, // 2 minutes
    backoffMultiplier = 2,
  } = options;

  const [interval, setInterval] = useState(baseInterval);
  const lastChangeRef = useRef<number>(Date.now());
  const lastDataRef = useRef<string | number | null>(null);

  const trackDataChange = useCallback(
    (dataFingerprint: string | number) => {
      const now = Date.now();

      // If data has changed, reset to base interval
      if (
        lastDataRef.current !== null &&
        lastDataRef.current !== dataFingerprint
      ) {
        lastChangeRef.current = now;
        setInterval(baseInterval);
      } else {
        // Data hasn't changed - check if we should back off
        const timeSinceChange = now - lastChangeRef.current;

        if (timeSinceChange >= idleThreshold) {
          setInterval((prev) =>
            Math.min(prev * backoffMultiplier, maxInterval),
          );
        }
      }

      lastDataRef.current = dataFingerprint;
    },
    [baseInterval, maxInterval, idleThreshold, backoffMultiplier],
  );

  const reset = useCallback(() => {
    lastChangeRef.current = Date.now();
    setInterval(baseInterval);
  }, [baseInterval]);

  return {
    interval,
    trackDataChange,
    reset,
  };
}
