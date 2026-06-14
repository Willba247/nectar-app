/**
 * Hook to monitor document visibility state
 * Returns true when the browser tab is visible, false when hidden
 *
 * Usage:
 * const isVisible = useDocumentVisibility();
 * useQuery(filters, {
 *   refetchInterval: isVisible ? 5000 : false, // Poll only when tab is visible
 * })
 */

import { useState, useEffect } from "react";

export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Set initial state from document.hidden
    setIsVisible(!document.hidden);

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
