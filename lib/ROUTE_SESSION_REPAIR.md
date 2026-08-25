# QuickGuard — Prompt 5A: Route, Session & Portal Access Repair

Status: **Inventory + plan complete. No production changes applied (entry gate blocked on build/CLI tooling).**

---

## 1. Project Identity & Versions

| Item | Value |
|---|---|
| Supabase project ref | `vnywjfpkepjgclkbcmsj` (confirmed) |
| Next.js | `15.3.2` |
| React | `^19.0.0` |
| `@supabase/supabase-js` | `^2.39.0` |
| `@supabase/ssr` | **NOT INSTALLED** |
| `@supabase/auth-helpers-nextjs` | NOT INSTALLED |
| Middleware file | **DOES NOT EXIST** |
| Supabase CLI / Deno / Git | NOT available in this environment |

---

## 2. Headline Architectural Findings

1. **There is no server-side auth boundary anywhere.** Every portal gate
   (`ClientAuthGate`, `GuardAuthGate`, `CompanyAuthGate`, `app/admin/layout.tsx`)
   is a `'use client'` component that calls `supabase.auth.getUser()` /
   `getSession()` inside `useEffect`. Protected routes render a loading spinner
   on the server, then enforce access only after hydration on the client.

2. **There is no `middleware.ts`.** `glob **/middleware.{ts,js,tsx}` returned
   zero files. Session refresh, cookie propagation, and route matcher logic are
   entirely absent. This is the single largest gap for this phase.

3. **`@supabase/ssr` is not installed.** The canonical cookie-handling client
   trio (browser / server / middleware) from the official Supabase SSR guidance
   cannot be constructed without it. The current `lib/supabase.ts` is a
   browser-oriented singleton, not an SSR-aware factory.

4. **`lib/supabase.ts` uses a shared browser singleton** with
   `persistSession: true`. `getSupabaseClient()` returns the *same* singleton in
   the browser and a throwaway non-persistent client on the server. This is not
   the per-request cookie-scoped pattern required for server-side identity.

5. **Mixed `getSession()` vs `getUser()`.** `lib/account-state.ts` and
   `lib/auth-helpers.ts` correctly use `getUser()` (server round-trip
   validation). But `CompanyAuthGate` and `app/admin/layout.tsx` still use
   `getSession()` (local cookie decode only) as their identity source.

6. **No service-role key leakage in app code.** Grep confirms
   `SUPABASE_SERVICE_ROLE_KEY` appears **only** inside `supabase/functions/*`
   (Deno), never in the Next.js app or browser. Good — nothing to fix here.

---

## 3. Route Access Matrix (TASK 1)

### 3.1 Public / marketing / legal — no auth
`/`, `/jobs`, `/jobs/[id]`, `/security-guards`, `/security-guards/[city]`,
`/pricing`, `/pricing/pdf`, `/how-it-works`, `/how-it-works/clients`,
`/contact`, `/help`, `/guide/client`, `/guide/guard`, `/find-a-guard`,
`/post-job`, `/mobile-app/*`, `/security-for-building-sites`,
`/security-for-events`, `/security-for-nightclubs`, `/security-for-shops`,
`/founding-guards`, `/founding-guards-offer`, `/terms`, `/privacy`,
`/cookie-policy`, `/accessibility`, `/qg-launch-rewards`,
`/qg-launch-rewards/temporary-profile`, `/qg-launch-rewards/terms`,
`/maintenance`.

Risk: low. Data access is read-only public RLS. No server boundary required.

### 3.2 Auth routes — public only when signed out
`/client/login`, `/client/register`, `/client/forgot-password`,
`/client/reset-password`, `/guard/login`, `/guard/register`,
`/guard/forgot-password`, `/guard/reset-password`, `/admin/login`,
`/admin/register`, `/admin/setup`, `/auth/callback`, `/auth/confirm`,
`/auth/verify-email`.

Flag: `AuthRedirectCatcher` and `app/auth/callback` route sign-in users to a
portal based on `user.user_metadata.role`. This is redirect routing from
mutable metadata (low severity — destination is a portal, not authorization —
but violates the "never authorize from user_metadata" rule and should prefer
the resolved account state / server profile).

### 3.3 Client portal — `/client/*`
Gate: `components/ClientAuthGate.tsx` (client-side). Requires authenticated
user + matching `clients` row + permitted account state + onboarding.
- OPEN_PATHS include `complete-profile-wizard`, `onboarding`, `account-status`,
  `payment/success`, plus login/register/forgot/reset.
- Good: distinguishes admin / guard / client and routes them away; enforces
  suspended/disabled and onboarding gates.
- Gap: **client-side only.** A direct request to `/client/dashboard` returns the
  shell (spinner) before any rejection. No server 401/redirect.

### 3.4 Guard portal — `/guard/*`
Gate: `components/GuardAuthGate.tsx` (client-side). Requires authenticated user
+ matching `guards` row + verification state.
- Good: enforces `verified`/`approved` before dashboard access, blocks
  `dashboard_access === false`, handles rejected/expired/suspended states.
- Gap: **client-side only** (same as client portal).

### 3.5 Admin portal — `/admin/*`
Gate: `app/admin/layout.tsx` (client-side `useEffect`). Requires authenticated
user + `admin_users` row with `is_active` + role in
`['super_admin','admin','finance_admin']`, then a second
`admin-security` edge-function `verify` call.
- Good: double-checks role, forces signOut + clears local/session storage on
  failure, has session timeout + heartbeat.
- Gap: **client-side only.** No server boundary. `verifyAdmin` also performs a
  redundant second `admin_users` lookup after the edge call.

### 3.6 Company portal — `/company/*`
Gate: `components/CompanyAuthGate.tsx` (client-side).
- Uses `getSession()` (should be `getUser()`).
- Queries the **`companies`** table via `.eq('user_id', ...)`.
  **⚠️ `companies` is NOT present in the live `public`/`app` schema table
  inventory.** This gate will error (table not found) unless the table exists in
  a schema not yet captured. Flag for Prompt 5B / schema reconciliation — do not
  invent the table here.
- Calls `provision-user-account` with `accountType: 'company'`.

### 3.7 Launch Rewards
`/qg-launch-rewards` and `temporary-profile` are public. The temporary profile
flow (`qg-create-launch-profile` edge function) is intentionally pre-account and
should **not** be granted access to client/guard portals — currently enforced by
the fact that a temporary profile has no `clients`/`guards` row, so the gates
route them to `complete-profile-wizard`. Preserve this.

### 3.8 Flagged items (TASK 1)
- **Protected pages without a server boundary** — all three portals + admin.
- **`window.location.href` navigation** — `hooks/useMobileRedirect.ts`
  `redirectIfMobile()` uses `window.location.href` (pre-existing, non-auth).
- **`as any` in auth-critical paths** — `ClientAuthGate` sets
  `user: {...} as any` and `{ id, email } as any`; callback uses
  `(existing as any).verification_status`. Violates "no `any`" rule.

---

## 4. Canonical Clients (TASK 2) — Plan Only

Required target (needs `@supabase/ssr` installed):

- `lib/supabase/server.ts` — `createServerClient` with `getAll`/`setAll`
  cookie methods for Server Components / actions.
- `lib/supabase/browser.ts` — singleton `createBrowserClient` for client
  components.
- `lib/supabase/middleware.ts` — `createServerClient` for the middleware
  session-refresh, propagating refreshed cookies to the response.

Current state: only `lib/supabase.ts` (browser singleton). No server factory,
no middleware factory. **Blocked** until `@supabase/ssr` is added and a build
can be verified.

---

## 5. Session Validation (TASK 3)

- `lib/account-state.ts` `resolveAccountState()` is the most complete
  state model and correctly uses `getUser()`. It already models: loading /
  signed-out / role / account status / onboarding / verification / required
  next step. This is the right foundation to reuse server-side.
- Defects to fix when server boundary is added:
  - `CompanyAuthGate` + `app/admin/layout.tsx` use `getSession()` — switch to
    `getUser()`.
  - `lib/supabase.ts` `getSupabaseClient()` returns a non-persistent throwaway
    on the server instead of a cookie-scoped client.

---

## 6. Middleware (TASK 4) — Plan Only

No middleware exists. Recommended split (documented, not implemented):

- **Middleware (session refresh only):** refresh the session cookie via
  `@supabase/ssr`, propagate refreshed cookies, run on a matcher excluding
  static assets/images. Do **not** put full authorization here.
- **Server layouts (authoritative gate):** per-portal `layout.tsx` performs the
  real `getUser()` + profile/role/state check and returns a redirect/401 before
  rendering children. This is the fail-closed boundary.

**Blocked:** requires `@supabase/ssr` + build verification.

---

## 7. Portal Authorization Gates (TASK 5)

Existing client-side gates are logically sound (role separation, account-state,
verification enforcement) but are not server-authoritative. When the server
boundary is introduced, mirror the exact predicates already present in
`resolveAccountState()` / each gate:

- **Admin:** `admin_users` + `is_active` + role ∈
  `['super_admin','admin','finance_admin']`.
- **Client:** `clients.user_id === auth.uid()` + active + onboarding.
- **Guard:** `guards.user_id === auth.uid()` + active + verification.
- **Company:** preserve existing model; resolve the missing `companies` table
  question first.

---

## 8. Role & Account-State Model (TASK 6)

Already present and reasonably typed in `lib/account-state.ts`:
`QuickGuardRole`, `QuickGuardAccountStatus`, `QuickGuardVerificationStatus`,
`QuickGuardAccountState`. Admin roles typed in `hooks/useAdminAuth.ts`
(`super_admin` | `admin` | `finance_admin`).

One inconsistency: `resolveAccountState()` reads `admin_users.role` but does not
validate it against the three known roles — it treats any `is_active` admin row
as admin. Recommend reusing the `isAdminRole` guard.

---

## 9. Security Regression Check (TASK 11 / Prompt 1C carry-over)

- ✅ No service-role key in browser/app code.
- ✅ `sanitizeRedirectPath` allow-lists redirects and blocks open redirects
  (`http://`, `//`, `/admin/*` for non-admins). Solid.
- ⚠️ `register-magic-link` auto-confirms email (`email_confirm: true`) and
  returns a live session before ownership is verified — **carried over from
  Prompt 4C, still a blocker.** Belongs to a dedicated auth-flow review.
- ⚠️ `AuthRedirectCatcher` + `app/auth/callback` choose redirect target from
  `user_metadata.role` — should prefer resolved account state.
- ⚠️ `as any` casts present in `ClientAuthGate` and `app/auth/callback`.

---

## 10. Blockers & Manual Actions

1. **Install `@supabase/ssr`** (pinned, e.g. `^0.6.x` compatible with
   `@supabase/supabase-js` 2.39+) and verify `next build` / `tsc` passes.
2. **Create `middleware.ts`** using the `@supabase/ssr` middleware client for
   session refresh only.
3. **Create canonical `lib/supabase/{server,browser,middleware}.ts`** factories
   and migrate consumers off the shared `lib/supabase.ts` singleton.
4. **Add server-authoritative gates** in `app/admin/layout.tsx`,
   `app/client/layout.tsx`, `app/guard/layout.tsx` (and `company`) mirroring the
   existing client predicates; keep client gates as UX fallback only.
5. **Resolve `companies` table** existence before touching company routes.
6. **Switch `getSession()` → `getUser()`** in `CompanyAuthGate` and
   `app/admin/layout.tsx`.
7. **Remove `as any`** casts in auth-critical files.
8. **Re-review `register-magic-link`** email-confirmation policy (blocker from
   4C).

---

## 11. Completion Report Summary

| # | Item | Result |
|---|---|---|
| 1 | Project ref + versions | Confirmed |
| 2 | Route inventory | Complete (section 3) |
| 3 | Middleware present | **Absent** |
| 4 | Server auth boundary | **Absent** |
| 5 | `@supabase/ssr` | **Not installed** |
| 6 | Service-role exposure in app | None (correct) |
| 7 | Open redirect | Protected (allow-list) |
| 8 | Migrations applied to production | **No** |
| 9 | Code changed | **None** (plan only) |

**Label: Created only — not applied.**