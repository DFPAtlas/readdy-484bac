-- RLS does not govern TRUNCATE or REFERENCES. Browser roles do not need
-- table definition privileges. Preserve row-level CRUD and service access.
revoke truncate, references, trigger on all tables in schema app from anon, authenticated, public;
alter default privileges for role postgres in schema app revoke truncate, references, trigger on tables from anon, authenticated, public;

-- These permissive false policies contribute no access; active owner/admin
-- policies already replace them. Do not remove restrictive deny policies.
drop policy if exists "Admins read all transactions" on app.transactions;
drop policy if exists "Clients read own transactions" on app.transactions;
drop policy if exists "Guards read own transactions" on app.transactions;
-- The ALL service policy already includes INSERT.
drop policy if exists "Service role manages transactions" on app.transactions;
