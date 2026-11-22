# Review private-note access

The review form labels private notes as visible only to QuickGuard's admin team. The authenticated role had table-wide SELECT and the existing guard-owner RLS policy therefore allowed guards to read private_note directly. The same field was present in the legacy public.reviews compatibility view. This was reproduced with a synthetic QA note; production metadata showed the same grants/policy. No real review text was inspected.

Replace app.reviews table-wide browser SELECT with its existing non-private columns. Keep private_note available to trusted backend/service access. Preserve the legacy security-invoker view's column shape but redact private_note to NULL, avoiding an indirect reference that would otherwise break safe projections after the column revoke. RLS, review creation/moderation writes and trusted backend grants remain intact.

Change the assigned-guard review query and admin count queries to explicit safe fields so they continue working without wildcard access.

Validation: 32 Postgres/review/workflow tests passed, including the before/after private-note reproduction, guard/client owner isolation, anonymous isolation, legacy view redaction, safe count/read queries and trusted backend access. Repository and admin TypeScript passed. Applied to the isolated sandbox: authenticated guard private-column privilege is false, safe review remains visible, and legacy private_note is NULL.

Deployment order: publish the frontend query changes before applying migration 20261122015948_protect_review_private_notes.sql to production. Otherwise old wildcard review queries will fail closed until the frontend is updated. This migration does not erase any private notes.

