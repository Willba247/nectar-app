# Admin Architecture Plan — Operating Venues Without a Manager Account

**Status:** APPROVED PLAN — Ready for implementation  
**Created:** 2025-03-18  
**Scope:** Backend + Admin UI changes only. No changes to venue manager dashboard, patron pages, or signup flow.

---

## Problem Statement

When a venue has no manager account (no row in `venue_managers`), the master admin dashboard (`/admin`) cannot:

1. Set the **street address**
2. Set the **venue description**
3. Upload/manage a **cover image**
4. Toggle **price display mode** (queue_skip_only vs entry_fee_and_queue_skip)
5. Set the **entry fee**
6. Use the **queue skip enabled** toggle (panic off equivalent)
7. View **gross sales analytics**

These capabilities are currently only accessible through `venueManagerProcedure`, which requires a Supabase auth session linked to a `venue_managers` row.

The admin must be able to fully operate any venue without requiring a manager account to exist.

---

## Feedback Incorporated

This plan was revised based on master approval review. The following corrections were applied:

| Original Proposal                                | Problem Identified                                                                              | Correction                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Widen `publicProcedure` mutations for admin use  | Extends unauthenticated surface area to operational controls                                    | Create server-side `adminProcedure` middleware with password validation per request |
| Audit logging marked "optional, can defer"       | Inconsistent with the manager dashboard's mandatory audit philosophy                            | All admin mutations **must** log to `audit_log`                                     |
| Gross sales bundled into venue-edit plan         | Analytics is a different category from config writes                                            | Separated into its own section (Layer 3)                                            |
| Single widened `venue.updateVenue` mega-mutation | Muddies permission boundaries, makes future auth hardening harder, makes audit diffs less clean | Granular, purpose-specific procedures grouped by domain                             |

---

## Architecture

### Layer 0: `adminProcedure` Middleware

**The most critical change.** Create a new tRPC procedure base in `trpc.ts` that validates the admin password server-side on every request.

**Location:** `src/server/api/trpc.ts`

```ts
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next, rawInput }) => {
    // Extract admin password from a custom header (X-Admin-Password)
    const adminPassword = ctx.headers.get("x-admin-password");

    if (!adminPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Admin password required",
      });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword || adminPassword !== expectedPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid admin password",
      });
    }

    return next({ ctx });
  });
```

**Client-side:** The admin frontend must send the password as a header on every tRPC call. The current PasswordProtection component stores the verified password in localStorage — reuse that value as the header source.

Modify the tRPC client config in the admin pages to attach the header:

```ts
// In the admin layout or provider, configure tRPC links to include:
headers() {
  const adminPw = localStorage.getItem("admin_password"); // or whatever key is used
  return {
    "x-admin-password": adminPw ?? "",
  };
}
```

**Why this approach:**

- Server validates every request — no client-side-only auth
- No Supabase auth session needed — admin is not a venue manager
- Consistent with `venueManagerProcedure` pattern (middleware injects auth context)
- Existing `publicProcedure` calls in `venue.ts` remain untouched
- Future hardening: swap plain-text comparison for hashed comparison without changing the middleware shape

**Impact on existing admin flows:** The existing `auth.verifyAdminPassword` mutation stays as-is (it's what the login screen calls). The new `adminProcedure` enforces auth on all subsequent mutations/queries.

---

### Layer 1: Backend — Admin-Scoped Procedures

Create a new router: `src/server/api/routers/admin.ts`

All procedures use `adminProcedure` (not `publicProcedure`).

#### Group A: Venue Profile Fields

Each mutation is granular and purpose-specific. Each logs to `audit_log`.

| Procedure                  | Type     | Input                                                 | Purpose                            |
| -------------------------- | -------- | ----------------------------------------------------- | ---------------------------------- |
| `updateVenueDescription`   | mutation | `{ venueId: string, description: string \| null }`    | Set/clear description              |
| `updateVenueStreetAddress` | mutation | `{ venueId: string, streetAddress: string \| null }`  | Set/clear street address           |
| `updateVenueCoverImage`    | mutation | `{ venueId: string, coverImagePath: string \| null }` | Set/clear cover image storage path |

#### Group B: Pricing & Display Controls

| Procedure                     | Type     | Input                                                                        | Purpose             |
| ----------------------------- | -------- | ---------------------------------------------------------------------------- | ------------------- |
| `updateVenuePriceDisplayMode` | mutation | `{ venueId: string, mode: "queue_skip_only" \| "entry_fee_and_queue_skip" }` | Toggle display mode |
| `updateVenueEntryFee`         | mutation | `{ venueId: string, entryFee: number \| null }`                              | Set/clear entry fee |

#### Group C: Operational Controls

| Procedure              | Type     | Input                                   | Purpose                                          |
| ---------------------- | -------- | --------------------------------------- | ------------------------------------------------ |
| `toggleVenueQueueSkip` | mutation | `{ venueId: string, enabled: boolean }` | Enable/disable queue skip (panic off equivalent) |

#### Audit Logging (mandatory for all mutations above)

Every mutation in the admin router inserts an `audit_log` row:

```ts
await db.insert(auditLog).values({
  venueId: input.venueId,
  userId: "00000000-0000-0000-0000-000000000000", // sentinel UUID for admin
  action: "admin.updateVenueDescription",
  changes: { description: { old: previousValue, new: input.description } },
});
```

Since admin is not a Supabase auth user, use a **sentinel UUID** for `userId`:

- Value: `00000000-0000-0000-0000-000000000000`
- This must be inserted into `auth.users` as a system placeholder, OR the `audit_log.userId` FK constraint must be relaxed to allow nullable/admin entries
- **Recommended:** Make `audit_log.userId` nullable for admin-originated entries. This is cleaner than inserting a fake auth user.

**Schema migration required:** `ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;`

---

### Layer 2: Frontend — Admin VenuesTab Enhancements

**Location:** `src/app/admin/tabs/VenuesTab.tsx`

#### 2a. VenueDialog Enhancement (Create/Edit modes)

Add to the existing VenueDialog component:

- **Street Address** — text input (max 255 chars)
- **Description** — textarea (max 2000 chars)
- **Price Display Mode** — select dropdown: "Queue Skip Only" / "Entry Fee + Queue Skip"
- **Entry Fee** — number input (visible only when mode = `entry_fee_and_queue_skip`)

On create: call existing `venue.createVenue` (unchanged), then call the new admin procedures to set additional fields.

On edit: call new admin procedures for changed fields.

#### 2b. Venue Card Enhancements

Add to each venue card in the grid:

- **Queue Skip Enabled** toggle (switch) — calls `admin.toggleVenueQueueSkip`
- **Street Address** display — shown below timezone, editable inline or via dialog
- **Description** preview — truncated, editable via dialog
- **Cover Image** thumbnail — small preview if set, upload button if not

#### 2c. Cover Image Upload

Reuse the existing `venue.uploadVenueImage` procedure for the raw upload, then call `admin.updateVenueCoverImage` to persist the path. This is the same two-step pattern used by the VenueDialog for venue images.

#### 2d. tRPC Client Header Injection

The admin pages need to send `x-admin-password` on every request to admin router procedures.

Options:

1. **Custom tRPC link** that injects the header for `admin.*` calls
2. **Separate tRPC client** for admin with the header baked in
3. **Global header** on the existing client (simplest — admin pages already run behind PasswordProtection)

Recommended: Option 3 — in the admin layout, wrap `TRPCReactProvider` (or configure its headers) to always include the admin password from localStorage. Since only admin pages import from the `admin` router, there's no leakage risk.

---

### Layer 3: Admin Analytics — Gross Sales (Separate Workstream)

This is **architecturally distinct** from venue config mutations and should be implemented as a separate read procedure.

#### Backend

Add to `admin.ts` router:

| Procedure                | Type  | Input                                                     | Purpose                                     |
| ------------------------ | ----- | --------------------------------------------------------- | ------------------------------------------- |
| `getVenueGrossSales`     | query | `{ venueId: string, startDate: string, endDate: string }` | SUM(amount_total) for a venue in date range |
| `getAllVenuesGrossSales` | query | `{ startDate: string, endDate: string }`                  | Aggregated gross sales across all venues    |

These use `adminProcedure` for auth. They query `transactions` / `transactions_log` tables.

#### Frontend

Add a "Gross Sales" summary card to each venue card, or add a dedicated "Analytics" tab to the admin dashboard alongside Venues and Transactions.

**This layer can be deferred** to a follow-up ticket without blocking the core admin-operates-venues feature.

---

### Layer 4: Router Registration

**Location:** `src/server/api/root.ts`

```ts
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  // ... existing routers
  admin: adminRouter,
});
```

---

## What Does NOT Change

| Component                          | Reason                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `venueManagerProcedure` middleware | Correctly scoped to authenticated venue managers                                                                                 |
| `venueManager.ts` router           | All its procedures serve the venue manager dashboard only                                                                        |
| Venue manager signup flow          | For venues that want self-service management                                                                                     |
| `venue.ts` router procedures       | Existing public procedures remain as-is; admin uses new `admin.*` procedures                                                     |
| Patron-facing pages                | No changes needed                                                                                                                |
| PasswordProtection component       | Still handles the login screen; `adminProcedure` handles per-request server validation                                           |
| `auth.verifyAdminPassword`         | Still used by the login screen to verify before storing in localStorage                                                          |
| LOCKED_ASSUMPTIONS                 | This plan does not violate any locked assumptions — admin is explicitly out-of-scope for the venue manager dashboard constraints |

---

## Migration Requirements

| Migration                   | SQL                                                         | Reason                                                    |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| `audit_log.userId` nullable | `ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;` | Admin-originated audit entries have no Supabase auth user |

No new tables. No new columns on `venues` (all target columns already exist in the schema).

---

## Implementation Order

| Step | Description                                                                                 | Dependency    |
| ---- | ------------------------------------------------------------------------------------------- | ------------- |
| 1    | Create `adminProcedure` middleware in `trpc.ts`                                             | None          |
| 2    | Create `admin.ts` router with Group A procedures (description, street address, cover image) | Step 1        |
| 3    | Add Group B procedures (price display mode, entry fee)                                      | Step 1        |
| 4    | Add Group C procedure (toggle queue skip)                                                   | Step 1        |
| 5    | Register `adminRouter` in `root.ts`                                                         | Step 2        |
| 6    | Run migration: `audit_log.userId` nullable                                                  | Before step 2 |
| 7    | Wire admin tRPC header injection (localStorage → `x-admin-password` header)                 | Step 1        |
| 8    | Enhance VenueDialog with new fields                                                         | Steps 2-4     |
| 9    | Enhance VenuesTab venue cards with inline controls                                          | Steps 2-4     |
| 10   | Cover image upload in admin UI                                                              | Step 2        |
| 11   | Smoke test: create and fully configure a venue with no manager account                      | All above     |
| 12   | (Deferred) Admin gross sales analytics — Layer 3                                            | Steps 1, 5    |

---

## Risk Assessment

| Risk                                                            | Severity     | Mitigation                                                                                                                                             |
| --------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin password sent as header on every request                  | Medium       | HTTPS in production encrypts headers. Password is already in localStorage. Future: swap for session token or hashed HMAC.                              |
| `audit_log.userId` nullable could allow orphaned entries        | Low          | Admin entries use `NULL` userId — clearly identifiable. Add a `source` column later if needed (`admin` vs `manager`).                                  |
| Venue manager and admin both editing the same venue             | Low          | Admin operates as a fallback for venues without managers. In practice, one or the other manages a given venue. No locking needed.                      |
| Existing `venue.*` public procedures still unauthenticated      | Pre-existing | Out of scope for this plan. A future hardening pass should migrate `venue.createVenue`, `deleteVenue`, etc. to `adminProcedure`. Tracked as tech debt. |
| Cover image upload via `venue.uploadVenueImage` is still public | Pre-existing | Same hardening pass. Upload returns a URL; the admin `updateVenueCoverImage` mutation (behind `adminProcedure`) is what persists it.                   |

---

## Compliance with Locked Assumptions

This plan introduces admin-scoped procedures with server-side auth validation. It does NOT:

- ❌ Route admin through `venueManagerProcedure` (admin is not a venue manager)
- ❌ Accept `venueId` from unauthenticated clients (admin password is validated server-side first)
- ❌ Bypass RLS (admin procedures use Drizzle with the service connection, same as existing `venue.*` procedures)
- ❌ Break venue manager isolation (manager dashboard is untouched)

It DOES:

- ✅ Validate admin identity server-side on every mutation
- ✅ Log all admin changes to `audit_log`
- ✅ Use granular, purpose-specific mutations (not a mega-mutation)
- ✅ Separate analytics reads from config writes
- ✅ Keep `publicProcedure` surface area unchanged
