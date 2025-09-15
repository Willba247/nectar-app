# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Development:**
- `npm run dev` - Start development server with Turbo
- `npm run preview` - Build and preview production build locally

**Code Quality:**
- `npm run check` - Run linting and type checking together
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run typecheck` - Run TypeScript compiler without emitting files
- `npm run format:check` - Check Prettier formatting
- `npm run format:write` - Auto-format code with Prettier

**Build:**
- `npm run build` - Build for production
- `npm start` - Start production server

## Architecture Overview

**Tech Stack:** Next.js 15, TypeScript, tRPC, Supabase, Stripe, Tailwind CSS, Capacitor

This is a queue management system for venues where users can purchase "queue skips" to skip lines at participating venues.

**Key Architecture Components:**

1. **Frontend Structure:**
   - Next.js App Router with TypeScript
   - Dynamic routing for venues: `/[venueName]/page.tsx`
   - Admin panel at `/admin`
   - Payment success/error pages

2. **Backend API (tRPC):**
   - Server located in `src/server/api/`
   - Router structure:
     - `auth.ts` - Admin authentication
     - `venue.ts` - Venue management
     - `transaction.ts` - Payment transaction handling
     - `stripe.ts` - Stripe payment integration
     - `email.ts` - Email notifications
     - `price.ts` - Pricing logic

3. **Database & External Services:**
   - Supabase for database and authentication
   - Stripe for payment processing
   - Resend for email notifications

4. **Mobile Support:**
   - Capacitor configuration for iOS/Android builds
   - Static export configuration for mobile app deployment

## Key Data Models

**Venues:**
- Defined in `src/data/venues.ts`
- Contains venue metadata: ID, name, queue skips available, pricing, images
- URL routing uses venue slugs (kebab-case names)

**Environment Variables:**
- Managed with `@t3-oss/env-nextjs` in `src/env.js`
- Server-side: `ADMIN_PASSWORD`, `NODE_ENV`
- Client-side variables prefixed with `NEXT_PUBLIC_`

## Important Considerations

**Payment Flow:**
- All payments flow through Nectar platform account
- Apple/Google Pay only shown on supported browsers
- Stripe webhook handling for payment completion
- Transaction records stored in Supabase

**Time Zone Limitations:**
- No time zone handling implemented - single timezone assumption
- Opening times are not timezone-aware

**Admin Access:**
- Password-protected admin panel
- Admin authentication persisted in session

## Development Patterns

- Uses path aliases: `@/*` maps to `./src/*`
- Strict TypeScript configuration with `noUncheckedIndexedAccess`
- Tailwind CSS for styling with custom components in `src/components/ui/`
- Client-side state management with tRPC and React Query
- Server-only imports protected with `server-only` package