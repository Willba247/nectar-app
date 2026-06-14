# Neon Grid — venue auth + patron visual redesign

**Date:** 2026-06-14
**Branch:** feature/venue-manager-dashboard
**Status:** Approved direction, pending spec review

## Overview

A purely visual redesign of three surfaces, sharing one "Neon Grid" art direction:

1. `/venue/login` — venue manager login
2. `/venue/signup` — venue manager account creation (2-step)
3. `/` — patron "skip the line" venue-card landing (light-touch ambient treatment)

Goal: an "awwwards"-grade, club-at-night experience built with **GSAP** (entrances, transitions, micro-interactions) over a **light WebGL backdrop** (perspective grid + glowing horizon), with a guaranteed CSS fallback.

## Scope

**In scope (visual only):**
- New presentational components and styles for the three pages.
- Adding `gsap`, `three`, `@types/three` dependencies.
- Global style tokens (glass surfaces, gradient borders, grid/horizon, CSS fallback keyframes).

**Explicitly out of scope — must remain byte-for-byte unchanged:**
- All form logic: server actions `venueLoginAction` / `venueSignupAction`, `useActionState`, `useFormStatus`, client validation, step state, error/success state.
- Every form field `name`, `type`, `required`, `maxLength`, and `autoComplete` attribute.
- All tRPC data flow on the patron page (`api.venue.getAllVenues`, `useBatchQueueSkipCounts`) and `VenueCard` props/availability logic.
- Auth/session/redirect behavior, routing, and the global root `Navbar`.

## Constraints (from codebase)

- **Tailwind v4** (CSS `@theme` in `src/styles/globals.css`), **Geist** font, dark theme, `next-themes`.
- Root layout (`src/app/layout.tsx`) renders a global `Navbar` (black bar, logo top-left) on **every** page; a nested layout cannot remove it. The redesign sits *below* this bar and treats the logo as the page anchor.
- **Capacitor static export** → all WebGL/GSAP code is client-only via `dynamic(..., { ssr: false })`.
- Strict TS with `noUncheckedIndexedAccess`; `npm run check` must pass.

## Art direction: Neon Grid

- **Palette:** brand gradient pink `#FF69B4` → royal blue `#4169E1` → teal `#0DD2B6` on near-black (`#05030c`).
- **Backdrop:** a perspective grid floor receding to a glowing gradient **horizon line**, with a soft radial "sky" glow above. Grid scrolls slowly toward the viewer.
- **Centerpiece type:** oversized kinetic headline **"YOUR DOOR, DIALED IN"** with gradient text fill and subtle bloom.
- **Form surface:** compact frosted **dark-glass card** (`backdrop-filter: blur`, gradient 1.5px border) holding the existing form.
- **Tabs:** Sign in / Create account segmented control inside the card.

## Motion system

- **`useNeonIntro` (GSAP):** on mount, stagger eyebrow → headline → form card; field-level stagger on tab/step changes. Button gradient-sweep on hover; input focus glow.
- **WebGL backdrop (`GridBackdrop`):** light Three.js scene — the perspective grid + horizon glow rendered in a single shader/mesh, slow auto-scroll, optional subtle cursor parallax. No Three.js addons; caps `devicePixelRatio`; pauses on tab-hidden.
- **Guards (`useMotionSafe`):** a single hook returns whether rich motion is allowed. Disables WebGL + reduces GSAP to instant when ANY of: `prefers-reduced-motion: reduce`, WebGL unavailable, or low-power heuristic (e.g. low `navigator.hardwareConcurrency`). When disabled, render the **CSS grid/horizon fallback** (the prototype's pure-CSS version) so the page still looks intentional.

## Components

**New** (`src/app/venue/_components/`):
- `GridBackdrop.tsx` — client, `ssr:false` dynamic import; WebGL grid+horizon with CSS fallback.
- `AuthCard.tsx` — frosted glass card shell + segmented Sign in / Create account tabs; wraps page-provided form children.
- `auth-motion.ts` — `useNeonIntro` GSAP helpers.
- `useMotionSafe.ts` — reduced-motion / low-power / WebGL capability detection.

**Edited (visual only):**
- `src/app/venue/login/page.tsx` — wrap existing form in new shell; restyle inputs as floating-label; keep action wiring.
- `src/app/venue/signup/page.tsx` — same shell; GSAP slide between step 1 ↔ step 2; restyle success ("Almost there!") state.
- `src/app/page.tsx` — add ambient `GridBackdrop` (low opacity) + GSAP card stagger; restyle search bar.
- `src/app/_components/venue-card.tsx` — refined hover (lift + gradient-border bloom); structure/data unchanged.
- `src/styles/globals.css` — glass/gradient/grid tokens + CSS fallback keyframes.

## Page behavior

- **Login:** single form, floating-label email/password, gradient "Sign in" button. Tab to Create account routes to `/venue/signup`.
- **Signup:** 2-step preserved. Step 1 (email, password, confirm) → client validation → Step 2 (venueName, streetAddress) with GSAP slide. Hidden `email`/`password` inputs preserved for the server action. Back/submit row preserved. Success state restyled.
- **Patron `/`:** ambient grid backdrop behind existing search + card grid; cards stagger in on first load; hover refined. All availability/pricing logic intact.

## Responsive

- Headline scales down on narrow viewports; grid perspective tightened so it reads on mobile.
- Glass card is fluid width (max ~360–400px), centered.
- Patron grid backdrop opacity reduced further on mobile to protect legibility.

## Accessibility & performance

- Respect `prefers-reduced-motion` (no parallax, instant reveals, static backdrop).
- Maintain text contrast over the backdrop (card sits on an opaque-enough glass; headline has sufficient contrast).
- `three` dynamically imported only on these routes; no addons; single mesh; capped DPR; render loop paused when tab hidden or backdrop off-screen.
- Keyboard focus order and visible focus rings preserved on all inputs/buttons.

## Dependencies

- Add: `gsap`, `three`, `@types/three`.

## Risks / mitigations

- **Bundle size (Three.js):** isolate to these routes via dynamic import; keep scene minimal; CSS fallback means Three can fail silently without breaking the page.
- **Mobile GPU cost:** low-power guard + DPR cap + visibility pause.
- **Regression risk on forms:** treat form internals as frozen; only markup/className/wrappers change. Verify by diffing field attributes and confirming login/signup still submit.

## Acceptance criteria

- All three pages render the Neon Grid aesthetic with GSAP entrances.
- Login and signup submit successfully with unchanged behavior; signup 2-step + success state work.
- With `prefers-reduced-motion: reduce` (or WebGL disabled), pages show the static CSS fallback and remain fully usable.
- Patron page shows ambient backdrop + card stagger; venue data, availability, and navigation unchanged.
- `npm run check` passes (lint + typecheck).
