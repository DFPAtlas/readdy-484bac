-- Only these named sandbox credentials are exposed to the Edge service role.
-- Plaintext values remain encrypted in Vault, never in app tables or source.
create view app.sandbox_runtime_credentials
with (security_invoker = true)
as select name, decrypted_secret as secret
from vault.decrypted_secrets
where name in ('qg_sandbox_resend_key', 'qg_sandbox_bank_payout_webhook');

revoke all on app.sandbox_runtime_credentials from public, anon, authenticated;
grant select on app.sandbox_runtime_credentials to service_role;
