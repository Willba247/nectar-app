"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";

/**
 * Staggers in any descendant marked with `data-anim` inside `scope`.
 * No-op (elements remain visible) when `enabled` is false.
 */
export function useNeonIntro(
  scope: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled || !scope.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-anim]", {
        y: 22,
        opacity: 0,
        duration: 0.7,
        stagger: 0.09,
        ease: "power3.out",
      });
    }, scope);
    return () => ctx.revert();
  }, [enabled, scope]);
}
