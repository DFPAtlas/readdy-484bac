# QuickGuard — Prompt 4C Completion Report
## Edge Function & Deno Configuration Repair

Status: **INVESTIGATION COMPLETE — NOTHING DEPLOYED**

---

## 1. Entry Gate Results

| Gate | Result |
|------|--------|
| Project reference | `vnywjfpkepjgclkbcmsj` — confirmed via `.env` `NEXT_PUBLIC_SUPABASE_URL` |
| Git commit inspected | **BLOCKED** — no Git access in this environment |
| Supabase CLI version | **BLOCKED** — CLI not installed/available |
| Deno version | **BLOCKED** — Deno runtime not available |
| Prompt 4A report | Not present in repo or message (same gap as 4B) |
| Prompt 4B report | `lib/SCHEMA_RECONCILIATION_PLAN.md` — present |

**Hard stop consequence:** `deno check`, `deno fmt`, `deno lint`, `supabase functions serve`, and `supabase functions deploy` **cannot be executed**. All configuration below is **created only — not verified, not deployed**.

---

## 2. Starting Inventory

- **Repository function entry points:** 130 (`supabase/functions/*/index.ts`)
- **Live function names reported:** ~140 (includes retired + live-only drift)
- **`deno.json` files:** 0 (none at root or function level)
- **Import maps:** 0
- **`_shared` folder:** 0 (every function is self-contained, heavy duplication)
- **CI workflows (`.yml`/`.yaml`):** 0
- **`tsconfig.json`:** 1 (Next.js app only; does **not** separate Deno code)

---

## 3. Dependency Drift (the bulk of the historical ~753 "errors")

The 130 functions use **direct URL imports** with no lockfile and no import map. This is the primary source of "noise" — not genuine code bugs.

### `@supabase/supabase-js` — 6+ divergent specifiers (CRITICAL)

| Specifier | Count | Status |
|-----------|-------|--------|
| `esm.sh/@supabase/supabase-js@2` (floating, no patch) | ~12 | **UNPINNED** |
| `jsr:@supabase/supabase-js@2` (floating) | 1 (qg-public-launch-settings) | **UNPINNED** |
| `esm.sh/...@2.39.0` | ~5 | pinned but stale |
| `esm.sh/...@2.39.3` | ~60 | pinned (majority) |
| `esm.sh/...@2.45.0` | ~18 | pinned but divergent |
| `esm.sh/...@2.47.0` | ~10 | pinned but divergent |
| `esm.sh/...@2.49.1` | 1 (monthly-finance-snapshot) | pinned, newest |

### `stripe` — 2 versions

| Specifier | Count |
|-----------|-------|
| `esm.sh/stripe@14.10.0?target=deno` | 26 |
| `esm.sh/stripe@12.0.0?target=deno` | 1 (cancel-stale-subscriptions) |

### Consistent (no drift)

- `deno.land/std@0.168.0/http/server.ts` — consistent across all `serve` functions
- `esm.sh/web-push@3.6.7` — 2 functions (send-push-notification, setup-push-vapid)

### Other drift flags

- Inconsistent `?target=deno` suffix on `esm.sh` supabase-js imports (present on ~6, absent on the rest).
- No `deno.lock` file anywhere.

**Proposed canonical specifiers (for manual migration):**
- `@supabase/supabase-js` → `jsr:@supabase/supabase-js@2.47.0` (or latest verified 2.x)
- `stripe` → `esm.sh/stripe@14.10.0?target=deno`
- `std` → `deno.land/std@0.168.0`
- `web-push` → `esm.sh/web-push@3.6.7`

---

## 4. TypeScript Suppression Noise (`any` / `as any` / `@ts-ignore`)

Present in **~80 of 130** functions. Heaviest offenders (raw match counts):

| Function | Matches |
|----------|---------|
| security-dashboard | 36 |
| get-guard-job-history | 22 |
| enhanced-stripe-webhook | 23 |
| admin-system-status | 20 |
| get-user-provisioning | 17 |
| create-subscription-checkout | 14 |
| admin-delete-user | 10 |
| admin-subscriptions | 9 |
| register-magic-link | 8 |
| qg-launch-analytics | 27 |

These are **code-quality defects** to fix as part of the genuine-error pass, but they are not the same as "missing Deno config." Do not fix with `skipLibCheck` or broader compiler suppression.

---

## 5. `verify_jwt` Reconciliation

`supabase/config.toml` declares only **6** functions. Everything else falls back to Supabase default (`verify_jwt = true`).

| Function | config.toml | Assessment |
|----------|-------------|------------|
| enhanced-stripe-webhook | `false` | ✅ correct (webhook, signature-verified) |
| create-subscription-checkout | `true` | ✅ correct (authenticated user) |
| create-job-payment | `true` | ✅ correct |
| create-guard-payout | `true` | ✅ correct |
| release-guard-payment | `true` | ✅ correct |
| approve-job-completion | `true` | ✅ correct |

### Undocumented default-true functions that are public-by-design

These rely on the **anon key being a valid JWT** + an in-function `jwt === SUPABASE_ANON_KEY` comparison to distinguish anonymous callers. They work, but their `verify_jwt` status is **undocumented and fragile**:

- `register-magic-link` (public signup)
- `email-confirmation` (live-only, public)
- `sia-verification-webhook` (webhook — likely should be `false`)
- `stripe-webhook` (webhook — check vs enhanced-stripe-webhook)
- `qg-launch-click-track`, `qg-launch-unsubscribe`, `qg-public-launch-settings` (public launch rewards)
- All `send-*-email` functions (invoked internally with service-role bearer)

**Action:** produce an explicit `verify_jwt` entry for every function; webhooks → `false`, public-by-design → documented, everything else → `true`.

---

## 6. CORS Findings

Two patterns coexist:

**✅ Correct allowlist (non-reflective):** retired functions, `repair-account`, `admin-register` — allow `quickguard.uk`, `www.quickguard.uk`, `readdy.ai` (+ subdomains), `localhost`/`127.0.0.1`.

**❌ Reflective / wildcard (violation):** `register-magic-link` uses `getCorsHeaders` returning `origin || '*'` — reflects arbitrary origin and falls back to `*`. For a registration endpoint this is a CORS broadening defect that should be allowlisted.

Many remaining functions need their CORS helper audited for the same reflective pattern.

---

## 7. Security Regression Check (Task 11)

| Function | Result |
|----------|--------|
| create-super-admin | ✅ Retired (410), no business logic |
| set-admin-password | ✅ Retired (410) |
| debug-hash | ✅ Retired (410) |
| fix-admin-password | ✅ Retired (410) |
| fix-admin-auth | ✅ Retired (410) |
| repair-account | ✅ `requireSuperAdmin` (active super_admin), dry-run default, audit log, UUID validation, batch cap 50 |
| admin-register | ✅ `requireSuperAdmin`, role allowlist `[admin, super_admin]`, audit log, password min 8, `email_confirm: false` |
| provision-user-account | ⚠️ needs full read (self-only claim in live list) |
| register-magic-link | ⚠️ **FINDING** — see below |

### ⚠️ Finding — `register-magic-link`

- Uses `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — **auto-confirms email without verified ownership.**
- Then `signInWithPassword(...)` returns a **live session immediately.**
- This violates the phase rules: "Do not auto-confirm email addresses without verified ownership" and "Registration does not return a live session before email ownership is verified."
- Also uses reflective CORS (`origin || '*'`) and heavy `any`.

**Classification:** this is a **behavioral** auth-flow concern, not a pure configuration defect. Per Task 11 it should be flagged as a blocker for a dedicated auth-flow review rather than silently "fixed" here (the frontend may depend on the immediate-session shape).

---

## 8. Live-Only Functions NOT in Repository (Task 18)

These exist in the live function list but have **no matching repo directory**:

| Live name | Risk |
|-----------|------|
| Create Admin Martin | **HIGH** — setup/debug endpoint, not in repo |
| Set Martin Password | **HIGH** — setup/debug endpoint, not in repo |
| Debug Admin Lookup | **HIGH** — debug endpoint, not in repo |
| audit-stripe | **MEDIUM** — undocumented |
| Notify Free Tier Limits | **MEDIUM** — undocumented worker |
| email-confirmation | **MEDIUM** — public, undocumented |

**Action:** these need explicit review and likely removal (requires a separate approved action — do not bulk-delete).

Retired-but-live functions (`create-super-admin`, `set-admin-password`, `debug-hash`, `fix-admin-password`, `fix-admin-auth`) are **safe** (return 410) but should also be removed live to reduce attack surface.

---

## 9. Secret-Name Matrix (names only, no values)

| Secret | Used by | Publicly exposable |
|--------|---------|--------------------|
| SUPABASE_URL | ~all | yes (non-secret) |
| SUPABASE_ANON_KEY | ~15 (manual anon check + user clients) | yes |
| SUPABASE_SERVICE_ROLE_KEY | ~all | **NO** |
| STRIPE_SECRET_KEY | ~26 | **NO** |
| STRIPE_WEBHOOK_SECRET | enhanced-stripe-webhook | **NO** |
| RESEND_API_KEY | create-guard-payout, process-email-queue, render-email-template | **NO** |
| SMTP_USER / SMTP_PASS / SMTP_HOST | admin-system-status, system-health, send-job-posted-email | **NO** |
| ADMIN_ALERT_EMAIL | send-accessibility-feedback-email, send-admin-password-reset-alert, send-contact-form-email | yes (address) |
| FROM_EMAIL | send-welcome-email, send-client-tier-email, send-guard-promo-welcome | yes (address) |
| SITE_URL / APP_URL | ~15 (hardcoded fallback `https://quickguard.uk`) | yes |
| GOOGLE_GEOCODING_API_KEY | geocode-address, create-job | **NO** |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT | send-push-notification, setup-push-vapid, get-vapid-public-key | public key yes, private **NO** |
| N8N_SIA_CHECK_WEBHOOK_URL / N8N_EMAIL_WEBHOOK_URL | sia-check, send-booking-confirmation, send-guard-booking-confirmation | no |
| SIA_VERIFICATION_API_KEY | sia-verification-webhook | **NO** |
| SB_ACCESS_TOKEN | security-dashboard (line 354) | **NO** — unusual, needs review |

### Secret hygiene flags

- `.env` contains a **placeholder** value: `GOOGLE_GEOCODING_API_KEY="your_google_geocoding_api_key_here"` — must be replaced with a real secret in the Supabase dashboard, not left as a literal.
- `.env` hardcodes `NEXT_PUBLIC_N8N_WEBHOOK_URL` (public, acceptable) but should be moved out if it later carries auth.
- `SITE_URL`/`APP_URL` hardcoded fallbacks to `quickguard.uk` are acceptable but should be set as secrets to avoid drift.

---

## 10. Proposed Deno Configuration (created only — NOT applied)

Because no CLI/Deno is available to verify, the following is the **recommended target structure**, documented for manual execution:

```jsonc
// supabase/functions/deno.json  (or root deno.json with functions scope)
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2.47.0",
    "stripe": "esm.sh/stripe@14.10.0?target=deno",
    "std/": "https://deno.land/std@0.168.0/",
    "web-push": "esm.sh/web-push@3.6.7"
  },
  "compilerOptions": {
    "lib": ["deno.window", "deno.ns", "dom", "dom.iterable", "esnext"]
  }
}
```

Requires rewriting all 130 import statements from direct URLs to aliases + a `deno check` pass. **Do not apply without running `deno check` against every entry point.**

---

## 11. Recommended CI Commands (created only)

Add to a CI workflow (none currently exists):

```
deno fmt --check supabase/functions
deno lint supabase/functions
deno check --all supabase/functions
supabase functions serve --no-verify-jwt   # local smoke, local Supabase only
npm run build                               # app (separate from Deno)
```

---

## 12. Completion Report Summary

| Item | Result |
|------|--------|
| Project reference | `vnywjfpkepjgclkbcmsj` ✅ |
| Git commit | not recorded (blocked) |
| CLI / Deno versions | not recorded (blocked) |
| Functions inventoried | 130 repo entry points |
| Dependency drift found | supabase-js 6+ specifiers, stripe 2, floating `@2` imports |
| `verify_jwt` declared | 6 of 130 |
| Security regressions | 5 retired-safe, 2 hardened-admin ✅, 1 flagged (register-magic-link auto-confirm) |
| Live-only dangerous functions | 6 flagged for review/removal |
| Functions deployed | **0** |
| Functions changed | **0** (investigation only) |
| Config files created | 0 (proposal documented above) |

---

## 13. Manual Actions & Blockers

1. **Provide Deno + Supabase CLI** (or run locally) to execute `deno check`/`fmt`/`lint` and `supabase functions deploy`.
2. **Resolve `register-magic-link` auto-confirm** — decide whether immediate session is intended (dedicated auth-flow review, do not hot-fix silently).
3. **Pin supabase-js** to one 2.x version and rewrite imports (or add import map).
4. **Explicit `verify_jwt`** for all 130 functions; set webhooks to `false`.
5. **Fix reflective CORS** in `register-magic-link` and audit remaining `origin || '*'` patterns.
6. **Replace `.env` placeholder** `GOOGLE_GEOCODING_API_KEY` with a real dashboard secret.
7. **Review/remove live-only** `Create Admin Martin`, `Set Martin Password`, `Debug Admin Lookup`, `audit-stripe` (separate approved action).
8. **Retire from live** the 5 retired-but-deployed 410 functions to shrink attack surface.

**Stop after Prompt 4C. Route/session repair is not started.**