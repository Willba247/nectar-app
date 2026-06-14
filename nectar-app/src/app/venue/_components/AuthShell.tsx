"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import GridBackdrop from "./GridBackdrop";
import { useMotionSafe } from "./useMotionSafe";
import { useNeonIntro } from "./auth-motion";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  mode: "login" | "signup";
  title: string;
  subtitle?: string;
  showTabs?: boolean;
  children: ReactNode;
}

export function AuthShell({
  mode,
  title,
  subtitle,
  showTabs = true,
  children,
}: AuthShellProps) {
  const scope = useRef<HTMLDivElement>(null);
  const { allowMotion } = useMotionSafe();
  useNeonIntro(scope, allowMotion);

  const tab = (active: boolean) =>
    cn(
      "flex-1 rounded-lg py-2 text-center text-[13px] font-medium transition",
      active
        ? "bg-white/10 text-white shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]"
        : "text-white/60 hover:text-white",
    );

  return (
    <section
      ref={scope}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#05030c] px-4 py-16"
    >
      <GridBackdrop intensity="full" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <p
          data-anim
          className="mb-3 text-[11px] font-medium tracking-[0.25em] text-[#0DD2B6]"
        >
          FOR VENUES
        </p>
        <h1
          data-anim
          className="mb-8 bg-gradient-to-b from-white to-[#c3ccf7] bg-clip-text text-center text-4xl font-bold leading-none tracking-tight text-transparent [text-shadow:0_2px_24px_rgba(5,3,12,0.55)] sm:text-5xl"
        >
          YOUR DOOR,
          <br />
          DIALED IN
        </h1>

        <div
          data-anim
          className="w-full rounded-2xl bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[1.5px]"
        >
          <div className="glass-card rounded-2xl p-7">
            {showTabs && (
              <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
                <Link href="/venue/login" className={tab(mode === "login")}>
                  Sign in
                </Link>
                <Link href="/venue/signup" className={tab(mode === "signup")}>
                  Create account
                </Link>
              </div>
            )}
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mb-6 mt-1 min-h-4 text-xs text-white/50">
              {subtitle ?? ""}
            </p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
