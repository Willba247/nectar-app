"use client";

import dynamic from "next/dynamic";
import { useMotionSafe } from "./useMotionSafe";

const NebulaCanvas = dynamic(() => import("./NebulaCanvas"), { ssr: false });

interface GridBackdropProps {
  /** "full" for auth pages, "ambient" (dimmer) for the patron page. */
  intensity?: "full" | "ambient";
}

export default function GridBackdrop({ intensity = "full" }: GridBackdropProps) {
  const { allowWebGL } = useMotionSafe();
  const floorOpacity = intensity === "ambient" ? "opacity-[0.16]" : "opacity-40";
  const skyOpacity = intensity === "ambient" ? "opacity-60" : "opacity-100";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className={`neon-sky absolute inset-x-0 top-0 h-[55%] ${skyOpacity}`} />
      {allowWebGL && <NebulaCanvas />}
      <div
        className={`neon-floor absolute inset-x-[-50%] bottom-0 h-[45%] ${floorOpacity}`}
      />
      <div className="neon-horizon absolute inset-x-0 top-[54%] opacity-70" />
    </div>
  );
}
