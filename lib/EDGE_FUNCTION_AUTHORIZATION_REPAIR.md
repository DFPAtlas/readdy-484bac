# QuickGuard — Edge Function Authorization Repair (Prompt 5B)

Status: **Created only — nothing deployed.** Stopped at the deployment gate (no Deno runtime / CLI / test runner in this environment).

- Project reference: `vnywjfpkepjgclkbcmsj` (SaaS Supabase)
- Git commit: not recordable (no Git access)
- Live functions inventoried: 130+ repo dirs, ~130 live deployments (per 4C matrix)

---

## 1. Critical / High findings before repair

### CRITICAL-1 — `create-subscription-checkout` has NO authentication
`supabase/functions/create-subscription-checkout/index.ts`

- Reads `userId`, `accountType`, `planId` **straight from the request body**.
- Never calls `auth.getUser()` or validates any bearer token.
- Uses the **service-role key** to read/write `subscriptions`, `user_entitlements_data`, `clients`/`guards`, `notifications`, and `plan_change_history`.

Impact: any caller can switch any user's subscription plan, rewrite their entitlements/features, and create a Stripe checkout with `client_reference_id = victim's userId` — no login required.

Confirmed: the frontend (`app/pricing/PricingClient.tsx`, `app/upgrade/page.tsx`) already sends `Authorization: Bearer <access_token>` + a matching `userId`, but the function ignores the token. So the fix is non-breaking.

### CRITICAL-2 — `create-wizard-checkout` has the same hole
`supabase/functions/create-wizard-checkout/index.ts`

Same pattern: `userId`, `accountType`, `planId` from body, service-role client, no `auth.getUser()` anywhere.

### HIGH-1 — `register-magic-link` auto-confirms email and returns a live session
`supabase/functions/register-magic-link/index.ts`

- `createUser({ email, password, email_confirm: true, ... })` — email ownership never verified.
- Immediately calls `signInWithPassword` and returns `{ session, user }` in the response.
- Violates "never return a live session before email ownership is verified."
- Also: `getCorsHeaders` reflects `origin || '*'` — arbitrary origin reflection on a registration endpoint.

Carried forward from 4C/5A. Needs a dedicated auth-flow review (touches session issuance + frontend registration), not a silent hot-fix.

### HIGH-2 — `cancel-job` trusts caller-controlled `cancelledBy`
`supabase/functions/cancel-job/index.ts`

- `cancelledBy` comes from the body and drives the refund tier: `cancelledBy === 'guard'` → 100% guard-fee refund + service-fee refund; `'client'` → time-based tiers.
- A client (who legitimately owns the job) can pass `cancelledBy: 'guard'` to force a full refund path.
- Also reflects `origin` in CORS.

### MEDIUM-1 — `apply-to-job` decodes JWT manually without signature verification
`supabase/functions/apply-to-job/index.ts`

- `decodeJwtPayload(jwt)` base64-decodes the payload and trusts `payload.sub` as the authenticated user, then runs a **service-role** client (RLS bypassed). The token signature is never verified by Supabase.
- Ownership check (`guardData.user_id !== authUserId`) is present and correct, but the identity itself is unverified.
- CORS `*`.

### MEDIUM-2 — `create-job` allows caller-controlled featured/urgent flags
`supabase/functions/create-job/index.ts`

- `is_featured`, `is_urgent`, `featured_until`, `featuredDuration` are taken from the client form and persisted without server-side entitlement/payment check.
- A client can self-mark jobs "featured" to gain paid placement for free.
- Ownership check is correct (`client.user_id === user.id`); the issue is business-logic escalation, not identity.
- CORS `*`.

### MEDIUM-3 — Widespread CORS `*`
Functions still shipping `Access-Control-Allow-Origin: *`:
- `apply-to-job`, `create-review`, `dispute-job`, `create-job`, `connect-guard-payout`
- `register-magic-link` and `cancel-job` reflect the request origin directly.

Payment/payout and sensitive functions should use the QuickGuard + preview-dev allowlist, not a wildcard or reflection.

---

## 2. Functions verified SECURE (owner/role correctly enforced)

| Function | Auth | Authorization | Verdict |
|---|---|---|---|
| `create-guard-payout` | `auth.getUser(token)` | finance_admin/super_admin + is_active; amounts server-derived; Stripe Connect verified; idempotency key | Secure |
| `create-job-payment` | `auth.getUser()` | client ownership via `job.client_id === client.id`; amounts/fees server-derived; idempotency | Secure |
| `approve-job-completion` | `auth.getUser()` | client ownership for approve/dispute; finance_admin/super_admin + is_active for admin_approve | Secure |
| `create-review` | `auth.getUser()` | client ownership; rating validation; moderation status `hidden` | Secure |
| `dispute-job` | `auth.getUser()` | `job.client_id === client.id` | Secure |
| `provision-user-account` | `auth.getUser()` | self only, derives account type server-side | Secure |
| `get-user-provisioning` | `auth.getUser()` | super_admin only | Secure |
| `repair-account` | `auth.getUser()` | super_admin only, dry-run default | Secure |
| `admin-register` | `auth.getUser()` | super_admin only, `APPROVED_ROLES` allowlist | Secure |
| `release-guard-payment` | `auth.getUser()` | retired → 410 | Secure (retired) |
| `connect-guard-payout` | n/a | deprecated → 200 notice only | Retired |

---

## 3. Required remediation (exact, forward-only)

### Fix A — `create-subscription-checkout` (CRITICAL-1)
Add bearer verification + derive `userId` from the token; reject mismatched body ID; tighten CORS to allowlist. The function already receives the token from the frontend, so no frontend change is required.

```ts
function getAllowedOrigin(origin: string | null): string {
  if (origin && ALLOWED_SITE_URLS.includes(origin)) return origin;
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      if (hostname === 'readdy.ai' || hostname.endsWith('.readdy.ai')) return origin;
      if (hostname.endsWith('.vercel.app')) return origin;
      if (hostname === 'quickguard.uk' || hostname.endsWith('.quickguard.uk')) return origin;
    } catch { /* ignore */ }
  }
  return 'https://quickguard.uk';
}

serve(async (req) => {
  const origin = getAllowedOrigin(req.headers.get('origin'));
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { userId: bodyUserId, accountType, planId, userEmail, billingCycle, siteUrl: bodySiteUrl } = body;

    const userId = user.id;
    if (!accountType || !planId) return new Response(JSON.stringify({ error: 'Missing required fields: accountType, planId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (bodyUserId && bodyUserId !== userId) return new Response(JSON.stringify({ error: 'User ID does not match authenticated account' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const publicSupabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
    // ... rest unchanged (price lookup, existing-sub switch, checkout session) ...
```

Note: also remove the `console.log('[create-subscription-checkout] Request body:', JSON.stringify(body))` line (logs private body).

### Fix B — `create-wizard-checkout` (CRITICAL-2)
Apply the identical auth block: verify bearer token, derive `userId` from `auth.getUser()`, reject mismatched body ID.

### Fix C — `register-magic-link` (HIGH-1)
Deferred to a dedicated auth-flow review (session issuance + registration semantics). Do NOT hot-fix without frontend coordination. Minimum required outcome: `email_confirm: false` + magic-link/OTP confirmation before issuing a session, and an allowlisted CORS.

### Fix D — `cancel-job` (HIGH-2)
Derive `cancelledBy` from the authenticated identity/role, not the body. Only a guard owner may cancel as `guard`; only the client owner may cancel as `client`. Never trust a caller-supplied cancellation actor for refund tiering.

### Fix E — `apply-to-job` (MEDIUM-1)
Replace manual `decodeJwtPayload` with `auth.getUser(token)`; replace CORS `*` with the allowlist.

### Fix F — `create-job` (MEDIUM-2)
Reject or server-validate `is_featured`/`is_urgent`/`featured_until` (do not accept from the client unless an entitlement check passes); replace CORS `*`.

### Fix G — CORS allowlist sweep (MEDIUM-3)
Replace `*` / origin-reflection with the QuickGuard + preview-dev allowlist on all browser-called functions.

---

## 4. Manual actions (blocked on missing tooling)

1. Provide a Deno/`supabase` CLI environment so `deno check`, `deno lint`, `deno fmt --check`, and `supabase functions deploy` can run against this project.
2. Confirm live `verify_jwt` for `create-subscription-checkout` and `create-wizard-checkout` (expected `false`; the in-function `getUser()` will supply the missing auth regardless).
3. Record current live versions of the two checkout functions for rollback before any deploy.
4. Deploy Fix A and Fix B first (highest severity, non-breaking), then re-run the negative-authorization test set.
5. Schedule `register-magic-link` for a dedicated auth-flow review (auto-confirm + live-session issue).

## 5. Negative-test set (to run locally/staging before deploy)

No-token → 401 · invalid token → 401 · expired → 401 · wrong role → 403 · inactive admin → 403 · client→other client's record → 403 · guard→other guard's record → 403 · body role escalation → 403 · body userId substitution → 403 · missing ownership → 403 · invalid webhook signature → 401 · replayed webhook → no duplicate · disallowed origin/method → 405/403 · authorized owner → allowed · active admin role → allowed · public endpoint returns only safe fields · sensitive values absent from logs.

## 6. Explicit confirmation

No real payment, payout, email, reward award, or production-account mutation was used during this audit. All inspection was read-only.