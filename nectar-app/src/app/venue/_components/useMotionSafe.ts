"use client";

import { useEffect, useState } from "react";

export interface MotionSafeState {
  /** GSAP entrance animations allowed (false when user prefers reduced motion). */
  allowMotion: boolean;
  /** WebGL backdrop allowed (false on reduced motion, low-power, or no WebGL). */
  allowWebGL: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useMotionSafe(): MotionSafeState {
  // Resolve reduced-motion synchronously on the client to avoid an entrance flash.
  const [state, setState] = useState<MotionSafeState>(() => ({
    allowMotion: !prefersReducedMotion(),
    allowWebGL: false,
  }));

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const cores = navigator.hardwareConcurrency ?? 4;
    const lowPower = cores <= 4;

    let hasWebGL = false;
    try {
      const canvas = document.createElement("canvas");
      hasWebGL = !!(
        canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")
      );
    } catch {
      hasWebGL = false;
    }

    setState({
      allowMotion: !reduced,
      allowWebGL: !reduced && !lowPower && hasWebGL,
    });
  }, []);

  return state;
}
