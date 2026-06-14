# Neon Grid Auth + Patron Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a shared "Neon Grid" visual system (GSAP entrances + a light, auto-disabling WebGL backdrop) to `/venue/login`, `/venue/signup`, and the patron `/` page — strictly visual, with all form logic and tRPC data flow frozen.

**Architecture:** A small set of reusable client components in `src/app/venue/_components/` provides the look: a `GridBackdrop` (CSS perspective grid + horizon, plus an optional Three.js nebula shader behind it), a `useMotionSafe` hook that disables WebGL/motion on reduced-motion or low-power devices, a `useNeonIntro` GSAP helper, an `AuthShell` that wraps each auth form in the stage + glass card, and a `FloatingField` input wrapper. The login and signup pages keep their existing server actions, field names, validation, and step logic untouched — only their markup/classes change. The patron page gains an ambient backdrop and a GSAP card stagger over its existing `getAllVenues` logic.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, GSAP, Three.js (dynamic, client-only), shadcn/ui.

---

## Design Constraints (do not violate)

- **Form logic is frozen.** Preserve every field `name`, `type`, `required`, `maxLength`, `autoComplete`, the `useActionState`/`useFormStatus` wiring, the signup 2-step state machine, client validation, and the `state.message` success branch. Only markup, `className`, and motion change.
  - Login server action reads FormData `email`, `password`.
  - Signup server action reads FormData `email`, `password`, `venueName`, `streetAddress`.
- **WebGL is client-only.** Three.js must only load via `dynamic(..., { ssr: false })` so the Capacitor static export never runs it on the server.
- **Everything degrades.** With `prefers-reduced-motion: reduce`, no WebGL, or a low-power device, pages must still render the static CSS grid and be fully usable.
- Run from `nectar-app/`. `npm run check` (lint + typecheck) must pass at the end of every task.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| **Add deps** | `nectar-app/package.json` | `gsap`, `three`, `@types/three` |
| **Modify** | `nectar-app/src/styles/globals.css` | Neon grid / horizon / glass CSS tokens + reduced-motion fallback |
| **Create** | `nectar-app/src/app/venue/_components/useMotionSafe.ts` | Reduced-motion / low-power / WebGL capability detection |
| **Create** | `nectar-app/src/app/venue/_components/auth-motion.ts` | `useNeonIntro` GSAP entrance helper |
| **Create** | `nectar-app/src/app/venue/_components/NebulaCanvas.tsx` | Three.js full-screen shader (drifting brand nebula) |
| **Create** | `nectar-app/src/app/venue/_components/GridBackdrop.tsx` | Composes CSS grid layers + optional NebulaCanvas |
| **Create** | `nectar-app/src/app/venue/_components/FloatingField.tsx` | Floating-label wrapper around shadcn `Input` |
| **Create** | `nectar-app/src/app/venue/_components/AuthShell.tsx` | Stage + headline + glass card + tabs wrapper |
| **Modify** | `nectar-app/src/app/venue/login/page.tsx` | Re-skin login form (logic unchanged) |
| **Modify** | `nectar-app/src/app/venue/signup/page.tsx` | Re-skin signup form + GSAP step slide (logic unchanged) |
| **Modify** | `nectar-app/src/app/page.tsx` | Ambient backdrop, glass search, card stagger |
| **Modify** | `nectar-app/src/app/_components/venue-card.tsx` | Hover lift/bloom (data/logic unchanged) |

---

## Task 1: Install dependencies

**Files:**
- Modify: `nectar-app/package.json` (via npm)

- [ ] **Step 1: Install GSAP and Three.js**

```bash
cd nectar-app && npm install gsap three && npm install -D @types/three
```

- [ ] **Step 2: Verify they resolve**

```bash
cd nectar-app && node -e "require.resolve('gsap'); require.resolve('three'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add package.json package-lock.json && git commit -m "build: add gsap and three for neon grid auth redesign"
```

---

## Task 2: Add Neon Grid style tokens to globals.css

**Files:**
- Modify: `nectar-app/src/styles/globals.css`

- [ ] **Step 1: Append the Neon Grid tokens**

Add to the very end of `src/styles/globals.css`:

```css
/* ---- Neon Grid auth/patron visual system ---- */
@keyframes neon-grid-scroll {
  to {
    background-position: 0 48px;
  }
}

.neon-sky {
  background: radial-gradient(
    ellipse at 50% 100%,
    rgba(65, 105, 225, 0.3),
    transparent 62%
  );
}

.neon-floor {
  background-image: linear-gradient(rgba(13, 210, 182, 0.6) 1px, transparent 1px),
    linear-gradient(90deg, rgba(65, 105, 225, 0.5) 1px, transparent 1px);
  background-size: 48px 48px;
  transform: perspective(320px) rotateX(64deg);
  transform-origin: bottom center;
  animation: neon-grid-scroll 3s linear infinite;
}

.neon-horizon {
  height: 2px;
  background: linear-gradient(90deg, transparent, #4169e1, #0dd2b6, transparent);
  box-shadow: 0 0 24px 5px rgba(65, 105, 225, 0.4);
}

.glass-card {
  background: rgba(8, 8, 16, 0.72);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

@media (prefers-reduced-motion: reduce) {
  .neon-floor {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify the dev server still compiles CSS**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors (CSS isn't typechecked, but this confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/styles/globals.css && git commit -m "style: add neon grid / glass tokens to globals"
```

---

## Task 3: Create the useMotionSafe hook

**Files:**
- Create: `nectar-app/src/app/venue/_components/useMotionSafe.ts`

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/useMotionSafe.ts && git commit -m "feat: add useMotionSafe capability hook"
```

---

## Task 4: Create the useNeonIntro GSAP helper

**Files:**
- Create: `nectar-app/src/app/venue/_components/auth-motion.ts`

- [ ] **Step 1: Create the file**

When `enabled` is false, no animation runs and elements stay at their natural (visible) state — the reduced-motion fallback.

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/auth-motion.ts && git commit -m "feat: add useNeonIntro gsap entrance helper"
```

---

## Task 5: Create the NebulaCanvas (Three.js)

**Files:**
- Create: `nectar-app/src/app/venue/_components/NebulaCanvas.tsx`

This is a single full-screen shader plane (no geometry math, no addons) that drifts the brand palette. It is only ever mounted via a dynamic `ssr: false` import (Task 6), so `three` never executes on the server.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;

void main() {
  vec2 uv = vUv;
  vec2 p1 = vec2(0.30 + 0.15 * sin(uTime * 0.18), 0.32 + 0.12 * cos(uTime * 0.15));
  vec2 p2 = vec2(0.72 + 0.12 * cos(uTime * 0.12), 0.55 + 0.14 * sin(uTime * 0.16));
  vec2 p3 = vec2(0.50 + 0.18 * sin(uTime * 0.10), 0.80 + 0.10 * cos(uTime * 0.13));

  float a1 = smoothstep(0.55, 0.0, distance(uv, p1));
  float a2 = smoothstep(0.55, 0.0, distance(uv, p2));
  float a3 = smoothstep(0.50, 0.0, distance(uv, p3));

  vec3 pink = vec3(1.000, 0.412, 0.706);
  vec3 blue = vec3(0.255, 0.412, 0.882);
  vec3 teal = vec3(0.051, 0.824, 0.714);

  vec3 col = pink * a1 + blue * a2 + teal * a3;
  float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0) * 0.5;
  gl_FragColor = vec4(col, alpha);
}
`;

export default function NebulaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { uTime: { value: 0 } };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let running = true;
    const start = performance.now();

    const loop = () => {
      if (!running) return;
      uniforms.uTime.value = (performance.now() - start) / 1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        loop();
      } else if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors (confirms `@types/three` resolves).

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/NebulaCanvas.tsx && git commit -m "feat: add Three.js nebula shader canvas"
```

---

## Task 6: Create the GridBackdrop

**Files:**
- Create: `nectar-app/src/app/venue/_components/GridBackdrop.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/GridBackdrop.tsx && git commit -m "feat: add GridBackdrop with CSS grid + optional webgl nebula"
```

---

## Task 7: Create the FloatingField input wrapper

**Files:**
- Create: `nectar-app/src/app/venue/_components/FloatingField.tsx`

- [ ] **Step 1: Confirm the shadcn Input forwards props**

```bash
cd nectar-app && sed -n '1,40p' src/components/ui/input.tsx
```

Expected: an `Input` that spreads `...props` onto an `<input>` and merges `className` via `cn`. (If it does not forward `placeholder`/`className`, fall back to a bare `<input>` in Step 2 with the same Tailwind classes.)

- [ ] **Step 2: Create the file**

The `placeholder=" "` (single space) is required for the `:placeholder-shown` float trick.

```tsx
"use client";

import { type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FloatingFieldProps = { label: string } & ComponentProps<typeof Input>;

export function FloatingField({
  label,
  className,
  ...props
}: FloatingFieldProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        placeholder=" "
        className={cn(
          "peer h-14 rounded-lg border-white/15 bg-white/5 px-3.5 pb-2 pt-6 text-[15px] text-white placeholder-transparent",
          "focus-visible:border-[#0DD2B6] focus-visible:ring-2 focus-visible:ring-[#0DD2B6]/20",
          className,
        )}
      />
      <label
        className={cn(
          "pointer-events-none absolute left-3.5 top-4 text-[15px] text-white/50 transition-all",
          "peer-focus:top-2 peer-focus:text-[10px] peer-focus:tracking-wide peer-focus:text-[#0DD2B6]",
          "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:tracking-wide",
        )}
      >
        {label}
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/FloatingField.tsx && git commit -m "feat: add FloatingField floating-label input"
```

---

## Task 8: Create the AuthShell

**Files:**
- Create: `nectar-app/src/app/venue/_components/AuthShell.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
          className="mb-8 bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-clip-text text-center text-4xl font-bold leading-none tracking-tight text-transparent sm:text-5xl"
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
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd nectar-app && git add src/app/venue/_components/AuthShell.tsx && git commit -m "feat: add AuthShell neon grid stage wrapper"
```

---

## Task 9: Re-skin the login page

**Files:**
- Modify: `nectar-app/src/app/venue/login/page.tsx`

The server action import, `useActionState`, field `name`/`autoComplete` values, and `useFormStatus` submit button all stay identical. Only the wrapper markup and styling change. The old "Create one" footer link is replaced by the AuthShell tabs.

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { venueLoginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { AuthShell } from "../_components/AuthShell";
import { FloatingField } from "../_components/FloatingField";

export default function VenueLoginPage() {
  const [state, formAction] = useActionState(venueLoginAction, { error: "" });

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to your venue dashboard."
    >
      <form action={formAction} className="space-y-4" autoComplete="off">
        <FloatingField
          type="email"
          name="email"
          label="Email"
          required
          autoComplete="username"
        />
        <FloatingField
          type="password"
          name="password"
          label="Password"
          required
          autoComplete="new-password"
        />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <SubmitButton />
      </form>
    </AuthShell>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 w-full rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0] disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd nectar-app && npm run check
```

Expected: no errors.

- [ ] **Step 3: Verify in the browser**

```bash
cd nectar-app && npm run dev
```

Open `http://localhost:3000/venue/login`. Confirm: the neon grid backdrop animates, the headline/card stagger in, floating labels lift on focus/type, the "Create account" tab navigates to `/venue/signup`, and submitting with bad credentials still shows the Supabase error string.

- [ ] **Step 4: Commit**

```bash
cd nectar-app && git add src/app/venue/login/page.tsx && git commit -m "feat: re-skin venue login with neon grid shell"
```

---

## Task 10: Re-skin the signup page

**Files:**
- Modify: `nectar-app/src/app/venue/signup/page.tsx`

Every piece of state (`step`, `email`, `password`, `confirmPassword`, `venueName`, `streetAddress`, `clientError`), the `handleNext`/`handleBack`/`handleSubmitValidation` validators, the hidden `email`/`password` inputs, the named `venueName`/`streetAddress` inputs, and the `state.message` success branch are preserved verbatim. New: AuthShell wrapper, FloatingField inputs, and a GSAP slide between steps.

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import { useFormStatus } from "react-dom";
import gsap from "gsap";
import { venueSignupAction, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { AuthShell } from "../_components/AuthShell";
import { FloatingField } from "../_components/FloatingField";
import { useMotionSafe } from "../_components/useMotionSafe";

export default function VenueSignupPage() {
  const [state, formAction] = useActionState<SignupState | undefined, FormData>(
    venueSignupAction,
    undefined,
  );
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [venueName, setVenueName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [clientError, setClientError] = useState("");

  const stepScope = useRef<HTMLDivElement>(null);
  const { allowMotion } = useMotionSafe();

  useEffect(() => {
    if (!allowMotion || !stepScope.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-step-anim]", {
        x: step === 2 ? 24 : -24,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: "power3.out",
      });
    }, stepScope);
    return () => ctx.revert();
  }, [step, allowMotion]);

  function handleNext() {
    setClientError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setClientError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setClientError("Passwords do not match");
      return;
    }
    setStep(2);
  }

  function handleBack() {
    setClientError("");
    setStep(1);
  }

  function handleSubmitValidation() {
    setClientError("");
    if (!venueName.trim()) {
      setClientError("Venue name is required");
      return false;
    }
    if (!streetAddress.trim()) {
      setClientError("Street address is required");
      return false;
    }
    return true;
  }

  // Success: email confirmation required.
  if (state?.message) {
    return (
      <AuthShell mode="signup" title="Almost there!" showTabs={false}>
        <p className="text-[15px] leading-relaxed text-[#0DD2B6]">
          {state.message}
        </p>
        <a
          href="/venue/login"
          className="mt-6 inline-block text-sm text-[#4169E1] underline hover:text-[#FF69B4]"
        >
          Back to login
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="signup"
      title="Create venue account"
      subtitle={`Step ${step} of 2`}
    >
      {(state?.error ?? clientError) && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state?.error ?? clientError}
        </div>
      )}

      <div ref={stepScope}>
        {step === 1 ? (
          <div className="space-y-4">
            <div data-step-anim>
              <FloatingField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div data-step-anim>
              <FloatingField
                type="password"
                label="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div data-step-anim>
              <FloatingField
                type="password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              onClick={handleNext}
              data-step-anim
              className="h-12 w-full rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0]"
            >
              Next
            </Button>
          </div>
        ) : (
          <form
            action={(formData) => {
              if (!handleSubmitValidation()) return;
              formAction(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />
            <div data-step-anim>
              <FloatingField
                name="venueName"
                label="Venue name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div data-step-anim>
              <FloatingField
                name="streetAddress"
                label="Street address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="flex gap-3" data-step-anim>
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="h-12 flex-1 rounded-lg border-white/20 bg-transparent text-base text-white hover:bg-white/10"
              >
                Back
              </Button>
              <SubmitButton />
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 flex-[1.4] rounded-lg bg-gradient-to-r from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] bg-[length:200%_100%] text-base font-semibold text-white transition-[background-position] duration-500 hover:bg-[position:100%_0] disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create Account"}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd nectar-app && npm run check
```

Expected: no errors.

- [ ] **Step 3: Verify in the browser**

With the dev server running, open `http://localhost:3000/venue/signup`. Confirm: step 1 validates (bad email, short password, mismatched passwords show the right messages), "Next" slides to step 2, "Back" slides to step 1, and the "Sign in" tab navigates to login. (Full submission can be confirmed against Supabase if env is configured; the field contract is unchanged from the previous version.)

- [ ] **Step 4: Commit**

```bash
cd nectar-app && git add src/app/venue/signup/page.tsx && git commit -m "feat: re-skin venue signup with neon grid shell + step slide"
```

---

## Task 11: Apply ambient treatment to the patron page

**Files:**
- Modify: `nectar-app/src/app/page.tsx`
- Modify: `nectar-app/src/app/_components/venue-card.tsx`

All tRPC/data logic (`getAllVenues`, `useBatchQueueSkipCounts`, search filter, skeletons, empty states) is preserved. New: ambient backdrop, glass search bar, a responsive grid, and a GSAP stagger over the cards.

- [ ] **Step 1: Replace `src/app/page.tsx` contents**

```tsx
'use client'
import VenueCard from "./_components/venue-card";
import { useState, useMemo, useRef, useEffect } from 'react';
import gsap from "gsap";
import { api } from "@/trpc/react";
import { useBatchQueueSkipCounts } from "./hooks/useAvailableQSkips";
import GridBackdrop from "./venue/_components/GridBackdrop";
import { useMotionSafe } from "./venue/_components/useMotionSafe";

function VenueCardSkeleton() {
  return (
    <div className="block w-full max-w-sm p-[4px] rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6]">
      <div className="relative w-full rounded-lg overflow-hidden bg-black/90">
        <div className="relative h-48 w-full bg-gray-700 animate-pulse" />
        <div className="p-4">
          <div className="h-6 w-3/4 bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="space-y-1 mb-4">
            <div className="h-4 w-1/2 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="w-full">
            <div className="h-10 w-full bg-gray-700 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: venues, isLoading } = api.venue.getAllVenues.useQuery();

  const venueIds = useMemo(() => (venues ?? []).map((v) => v.id), [venues]);
  const { counts, isLoading: countsLoading, isError: countsError } =
    useBatchQueueSkipCounts(venueIds);

  // Filter venues based on search query
  const filteredVenues = useMemo(() => {
    if (!venues) return [];

    const query = searchQuery.toLowerCase().trim();
    if (!query) return venues;

    return venues.filter((venue) =>
      venue.name.toLowerCase().includes(query)
    );
  }, [venues, searchQuery]);

  // Show "No venues found" when search yields no results, or when there are no venues at all
  const hasNoResults = !isLoading && venues && venues.length > 0 && filteredVenues.length === 0;
  const hasNoVenues = !isLoading && venues && venues.length === 0;

  const gridRef = useRef<HTMLDivElement>(null);
  const { allowMotion } = useMotionSafe();

  useEffect(() => {
    if (!allowMotion || isLoading || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".venue-card-anim", {
        y: 26,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
      });
    }, gridRef);
    return () => ctx.revert();
  }, [allowMotion, isLoading, filteredVenues.length]);

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#05030c]">
      <GridBackdrop intensity="ambient" />
      <div className="relative z-10 flex flex-col gap-4 w-full px-4 items-center pt-2">
        <div className="w-full max-w-md mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search venues..."
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-white/40 focus:border-[#0DD2B6] focus:outline-none focus:ring-2 focus:ring-[#0DD2B6]/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <VenueCardSkeleton key={index} />
            ))}
          </div>
        ) : filteredVenues.length > 0 ? (
          <div
            ref={gridRef}
            className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredVenues.map((venue) => {
              return (
                <div key={venue.id} className="venue-card-anim flex justify-center">
                  <VenueCard
                    venue={venue}
                    countState={{
                      count: counts?.[venue.id],
                      isLoading: countsLoading,
                      isError: countsError,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : hasNoResults ? (
          <div className="text-white text-2xl">No venues match your search</div>
        ) : hasNoVenues ? (
          <div className="text-white text-2xl">No venues found</div>
        ) : null}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add hover lift/bloom to the venue card**

In `src/app/_components/venue-card.tsx`, find the outer wrapper:

```tsx
<div className="block w-full max-w-sm rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
```

Replace with:

```tsx
<div className="block w-full max-w-sm rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px] transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(65,105,225,0.3)]">
```

- [ ] **Step 3: Typecheck + lint**

```bash
cd nectar-app && npm run check
```

Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:3000`. Confirm: the ambient grid drifts faintly behind the cards (cards stay fully legible), the search bar is glassy with a teal focus ring, cards stagger in on load, hovering a card lifts it, and search still filters correctly.

- [ ] **Step 5: Commit**

```bash
cd nectar-app && git add src/app/page.tsx src/app/_components/venue-card.tsx && git commit -m "feat: apply ambient neon grid + card stagger to patron page"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full lint + typecheck**

```bash
cd nectar-app && npm run check
```

Expected: no errors or new warnings.

- [ ] **Step 2: Production build (catches static-export / client-only issues)**

```bash
cd nectar-app && npm run build
```

Expected: build succeeds. Confirm there are no "window is not defined" / SSR errors from `three` (it must only load via the `ssr: false` dynamic import in `GridBackdrop`).

- [ ] **Step 3: Reduced-motion fallback check**

In the browser devtools, enable "Emulate CSS prefers-reduced-motion: reduce" (Rendering tab), then reload `/venue/login`, `/venue/signup`, and `/`. Confirm: no WebGL canvas mounts, the grid is static, entrances are instant, and every page is fully usable and on-brand.

- [ ] **Step 4: Cross-page smoke test**

With normal motion settings, verify all three pages:
1. `/venue/login` — backdrop animates, login submits, tab → signup works.
2. `/venue/signup` — step 1 validation, step slide, step 2 submit contract intact, tab → login works.
3. `/` — ambient backdrop, search filter, card stagger, hover lift.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
cd nectar-app && git add -A && git commit -m "chore: neon grid redesign verification cleanup" || echo "nothing to commit"
```
