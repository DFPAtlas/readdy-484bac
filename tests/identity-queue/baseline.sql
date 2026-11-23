-- Synthetic tables and roles matching the audited production surface.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema app;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema app,auth,storage to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create table app.guards(id uuid primary key,user_id uuid not null,profile_completed boolean,
  full_name text,postcode text,date_of_birth date,proof_of_address_url text,driving_licence_front_url text,
  id_docs_check_status text,id_docs_decision text,id_docs_reasons jsonb,id_docs_message text,
  id_docs_checked_at timestamptz,updated_at timestamptz,verification_status text default 'pending',
  verified_by uuid, is_active boolean default false, dashboard_access boolean default false);
create table app.admin_users(user_id uuid primary key,is_active boolean);
create table app.sia_checks(subject_id uuid,subject_type text,status text,sia_found boolean,
  sia_first_name text,sia_surname text,checked_at timestamptz);
create table storage.buckets(id text primary key,public boolean);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,
  owner uuid,owner_id text,version text,metadata jsonb,archived_at timestamptz,is_delete_marker boolean);
create table app.document_checks (
  id uuid primary key default gen_random_uuid(),guard_id uuid not null references app.guards(id),
  reason text,status text default 'pending',attempts int default 0,claimed_at timestamptz,claimed_by text,
  decision text,reasons jsonb,message text,error_message text,created_at timestamptz default now(),
  updated_at timestamptz,completed_at timestamptz,poa_sha256 text,dl_front_sha256 text
);
create unique index document_checks_one_open_per_guard on app.document_checks(guard_id)
  where status in ('pending','processing');
alter table app.guards enable row level security;
alter table app.document_checks enable row level security;
alter table app.sia_checks enable row level security;
alter table app.admin_users enable row level security;
alter table storage.objects enable row level security;
-- Permissive policies deliberately simulate other existing authenticated grants.
create policy fixture_guard on app.guards for all to authenticated using (true);
create policy fixture_queue on app.document_checks for all to authenticated using (true);
create policy fixture_sia on app.sia_checks for all to authenticated using (true);
create policy fixture_admin on app.admin_users for all to authenticated using (true);
create policy fixture_storage on storage.objects for all to authenticated using (true);
grant select,insert,update,delete on all tables in schema app,storage to authenticated,service_role;
create function app.request_document_check(p_guard_id uuid,p_reason text default 'manual')
returns uuid language sql security definer as $$ select null::uuid $$;
create function app.claim_document_check(p_worker text default null) returns setof app.document_checks
language sql security definer as $$ select * from app.document_checks where false $$;
revoke all on function app.request_document_check(uuid,text),app.claim_document_check(text)
  from public,anon,authenticated,service_role;
grant execute on function app.request_document_check(uuid,text),app.claim_document_check(text) to service_role;
create function app.sync_document_check_to_guard() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger document_checks_sync_guard after insert or update of status on app.document_checks
  for each row execute function app.sync_document_check_to_guard();
