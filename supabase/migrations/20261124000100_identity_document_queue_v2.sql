begin;
set local lock_timeout = '5s';

create schema if not exists identity_queue_private;
revoke all on schema identity_queue_private from public, anon, authenticated, service_role;

create table identity_queue_private.workers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);

alter table app.guards add column id_docs_submission_version bigint;
alter table app.document_checks
  add column submission_version bigint,
  add column submission_owner uuid,
  add column proof_reference jsonb,
  add column licence_reference jsonb,
  add column available_at timestamptz,
  add column lease_token uuid,
  add column lease_owner uuid,
  add column lease_expires_at timestamptz,
  add column completion_fingerprint text,
  add constraint document_checks_v2_identity check (
    submission_version is null or (submission_owner is not null and
      proof_reference is not null and licence_reference is not null and available_at is not null)
  ) not valid;

create sequence identity_queue_private.submission_versions;
create unique index document_checks_submission_version_idx
  on app.document_checks (submission_version) where submission_version is not null;
create index document_checks_v2_pending_idx on app.document_checks (available_at, created_at)
  where submission_version is not null and status = 'pending';
create index document_checks_v2_expiry_idx on app.document_checks (lease_expires_at)
  where submission_version is not null and status = 'processing';
create index document_checks_v2_proof_hash_idx on app.document_checks (poa_sha256)
  where status = 'done' and poa_sha256 is not null;
create index document_checks_v2_licence_hash_idx on app.document_checks (dl_front_sha256)
  where status = 'done' and dl_front_sha256 is not null;
create index guards_identity_proof_path_idx on app.guards (proof_of_address_url)
  where id_docs_submission_version is not null;
create index guards_identity_licence_path_idx on app.guards (driving_licence_front_url)
  where id_docs_submission_version is not null;

create function app.identity_queue_is_worker() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from identity_queue_private.workers where user_id = auth.uid()); $$;

create function identity_queue_private.require_worker() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if not exists (select 1 from identity_queue_private.workers w
                 where w.user_id = v_user and w.enabled) then
    raise exception 'identity worker permission required' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

create function identity_queue_private.disallow_worker_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('identity-worker:' || new.user_id::text,0));
  if (tg_table_schema = 'app' and exists(select 1 from identity_queue_private.workers where user_id = new.user_id))
     or (tg_table_schema = 'identity_queue_private' and exists(select 1 from app.admin_users where user_id = new.user_id)) then
    raise exception 'identity workers cannot be admins' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger identity_worker_cannot_be_admin before insert or update of user_id
  on app.admin_users for each row execute function identity_queue_private.disallow_worker_admin();
create trigger identity_admin_cannot_be_worker before insert or update of user_id
  on identity_queue_private.workers for each row execute function identity_queue_private.disallow_worker_admin();

-- A registered worker has no direct guard, queue, SIA, admin or object access.
-- Disabled workers retain these restrictions.
create policy identity_worker_no_direct_guards on app.guards as restrictive
  for all to authenticated using (not app.identity_queue_is_worker()) with check (not app.identity_queue_is_worker());
create policy identity_worker_no_direct_checks on app.document_checks as restrictive
  for all to authenticated using (not app.identity_queue_is_worker()) with check (not app.identity_queue_is_worker());
create policy identity_worker_no_direct_sia_checks on app.sia_checks as restrictive
  for all to authenticated using (not app.identity_queue_is_worker()) with check (not app.identity_queue_is_worker());
create policy identity_worker_no_admin_membership on app.admin_users as restrictive
  for all to authenticated using (not app.identity_queue_is_worker()) with check (not app.identity_queue_is_worker());
create policy identity_worker_no_direct_storage on storage.objects as restrictive
  for all to authenticated using (not app.identity_queue_is_worker()) with check (not app.identity_queue_is_worker());

create function identity_queue_private.object_reference(p_owner uuid, p_path text, p_kind text)
returns jsonb language sql volatile security definer set search_path = ''
as $$
  select jsonb_build_object('path',o.name,'id',o.id,'version',o.version,'etag',o.metadata->>'eTag')
  from storage.objects o
  where o.bucket_id = 'guard-documents' and o.name = p_path
    and split_part(o.name,'/',1) = p_owner::text
    and split_part(o.name,'/',2) ~ (case p_kind when 'proof' then '^poa-' when 'licence' then '^front-' end || '[0-9]+\.(pdf|png|jpg|jpeg|webp)$')
    and o.name = p_owner::text || '/' || split_part(o.name,'/',2)
    and nullif(o.version,'') is not null
    and (o.owner_id = p_owner::text or (o.owner_id is null and o.owner = p_owner))
    and o.archived_at is null and not coalesce(o.is_delete_marker,false)
$$;

create function identity_queue_private.references_current(p_guard app.guards, p_job app.document_checks)
returns boolean language sql volatile security definer set search_path = ''
as $$
  select p_guard.id_docs_submission_version is not distinct from p_job.submission_version
    and p_guard.user_id = p_job.submission_owner
    and (p_job.proof_reference - 'sha256') =
      identity_queue_private.object_reference(p_guard.user_id,p_guard.proof_of_address_url,'proof')
    and (p_job.licence_reference - 'sha256') =
      identity_queue_private.object_reference(p_guard.user_id,p_guard.driving_licence_front_url,'licence')
$$;

create function app.identity_document_sources(p_user_id uuid)
returns jsonb language sql volatile security definer set search_path = ''
as $$
  select jsonb_build_object('guard_id',g.id,'proof',
    identity_queue_private.object_reference(g.user_id,g.proof_of_address_url,'proof'),
    'licence',identity_queue_private.object_reference(g.user_id,g.driving_licence_front_url,'licence'))
  from app.guards g where g.user_id = p_user_id and g.profile_completed is true
$$;

create function app.enqueue_identity_document_check(
  p_guard_id uuid, p_user_id uuid, p_proof jsonb, p_licence jsonb
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  g app.guards;
  previous app.document_checks;
  v_version bigint;
  v_id uuid;
begin
  select * into g from app.guards where id = p_guard_id and user_id = p_user_id and profile_completed is true for update;
  if not found then raise exception 'submitted guard required' using errcode = '42501'; end if;
  if (p_proof->>'sha256' ~ '^[0-9a-f]{64}$'
      and (p_proof - 'sha256') = identity_queue_private.object_reference(p_user_id,g.proof_of_address_url,'proof')
      and p_licence->>'sha256' ~ '^[0-9a-f]{64}$'
      and (p_licence - 'sha256') = identity_queue_private.object_reference(p_user_id,g.driving_licence_front_url,'licence')) is not true then
    raise exception 'document references changed or are invalid' using errcode = '22023';
  end if;
  -- Legacy jobs finish via their original contract before this guard can enter v2.
  if exists (select 1 from app.document_checks where guard_id = g.id and submission_version is null
             and status in ('pending','processing')) then
    raise exception 'legacy document check still open' using errcode = '55000';
  end if;
  select * into previous from app.document_checks where submission_version = g.id_docs_submission_version;
  if found and previous.status <> 'superseded' and previous.proof_reference = p_proof and previous.licence_reference = p_licence then
    return previous.id;
  end if;
  update app.document_checks set status = 'superseded', completed_at = clock_timestamp(),
    updated_at = clock_timestamp(), lease_expires_at = null
    where guard_id = g.id and submission_version is not null and status in ('pending','processing');
  v_version := nextval('identity_queue_private.submission_versions');
  insert into app.document_checks (guard_id,reason,status,attempts,submission_version,submission_owner,
      proof_reference,licence_reference,available_at)
    values (g.id,'reupload','pending',0,v_version,p_user_id,p_proof,p_licence,clock_timestamp())
    returning id into v_id;
  update app.guards set id_docs_submission_version = v_version, id_docs_check_status = 'pending',
    id_docs_decision = null, id_docs_reasons = null, id_docs_message = null, id_docs_checked_at = null,
    updated_at = clock_timestamp() where id = g.id;
  return v_id;
end;
$$;

create or replace function app.sync_document_check_to_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.submission_version is not null then return new; end if;
  if new.status in ('done','failed') then
    update app.guards set id_docs_check_status = new.status,
      id_docs_decision = coalesce(new.decision,guards.id_docs_decision),
      id_docs_reasons = new.reasons, id_docs_message = coalesce(new.message,new.error_message),
      id_docs_checked_at = coalesce(new.completed_at,new.updated_at,now()), updated_at = now()
      where id = new.guard_id and id_docs_submission_version is null;
  else
    update app.guards set id_docs_check_status = new.status, updated_at = now()
      where id = new.guard_id and id_docs_submission_version is null;
  end if;
  return new;
end;
$$;

create or replace function app.request_document_check(p_guard_id uuid,p_reason text default 'manual')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version bigint;
  v_reason text := lower(coalesce(nullif(btrim(p_reason),''),'manual'));
begin
  select id_docs_submission_version into v_version from app.guards where id = p_guard_id for update;
  if not found then raise exception 'guard not found'; end if;
  if v_version is not null then
    raise exception 'versioned document enqueue required' using errcode = '55000';
  end if;
  select id into v_id from app.document_checks where guard_id = p_guard_id
    and status in ('pending','processing') order by created_at desc limit 1;
  if v_id is null then
    insert into app.document_checks(guard_id,reason) values
      (p_guard_id,case when v_reason in ('onboarding','manual','reupload') then v_reason else 'manual' end)
      returning id into v_id;
    update app.guards set id_docs_check_status = 'pending',id_docs_message = null,updated_at = now()
      where id = p_guard_id;
  end if;
  return v_id;
end;
$$;

create or replace function app.claim_document_check(p_worker text default null) returns setof app.document_checks
language plpgsql security definer set search_path = ''
as $$
begin
  return query update app.document_checks d
  set status = 'processing', claimed_at = now(), claimed_by = coalesce(nullif(btrim(p_worker),''),'verifier'),
      attempts = d.attempts + 1, updated_at = now()
  where d.id = (select q.id from app.document_checks q where q.status = 'pending'
    and q.submission_version is null order by q.created_at limit 1 for update skip locked)
  returning d.*;
end;
$$;

-- Run before the input invalidator so an ordinary upload can still clear evidence.
create function identity_queue_private.protect_guard_advisory_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op = 'INSERT' then
      if coalesce(new.id_docs_submission_version::text,new.id_docs_check_status,
          new.id_docs_decision,new.id_docs_reasons::text,new.id_docs_message,
          new.id_docs_checked_at::text) is not null then
        raise exception 'server-owned identity document fields' using errcode = '42501';
      end if;
    elsif (old.id_docs_submission_version,old.id_docs_check_status,old.id_docs_decision,
           old.id_docs_reasons,old.id_docs_message,old.id_docs_checked_at)
       is distinct from
          (new.id_docs_submission_version,new.id_docs_check_status,new.id_docs_decision,
           new.id_docs_reasons,new.id_docs_message,new.id_docs_checked_at) then
      raise exception 'server-owned identity document fields' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger identity_queue_guard_advisory_fields
before insert or update on app.guards for each row
execute function identity_queue_private.protect_guard_advisory_fields();

create function identity_queue_private.invalidate_guard_input() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.id_docs_submission_version is not null and (
      old.user_id is distinct from new.user_id or
      old.proof_of_address_url is distinct from new.proof_of_address_url or
      old.driving_licence_front_url is distinct from new.driving_licence_front_url) then
    new.id_docs_check_status := 'pending';
    new.id_docs_decision := null;
    new.id_docs_reasons := null;
    new.id_docs_message := null;
    new.id_docs_checked_at := null;
  end if;
  return new;
end;
$$;

create trigger identity_queue_invalidate_guard_input
before update of user_id, proof_of_address_url, driving_licence_front_url on app.guards
for each row execute function identity_queue_private.invalidate_guard_input();

create function identity_queue_private.invalidate_changed_object() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.bucket_id = 'guard-documents' and (tg_op = 'DELETE' or
      (old.bucket_id,old.name,old.version,old.owner,old.owner_id,old.archived_at,old.is_delete_marker,old.metadata->>'eTag')
      is distinct from
      (new.bucket_id,new.name,new.version,new.owner,new.owner_id,new.archived_at,new.is_delete_marker,new.metadata->>'eTag')) then
    update app.guards set id_docs_check_status = 'pending', id_docs_decision = null,
      id_docs_reasons = null, id_docs_message = null, id_docs_checked_at = null
      where id_docs_submission_version is not null
      and (proof_of_address_url = old.name or driving_licence_front_url = old.name);
  end if;
  return null;
end;
$$;

create trigger identity_queue_invalidate_changed_object after update or delete on storage.objects
for each row execute function identity_queue_private.invalidate_changed_object();

create function identity_queue_private.publish_result(g app.guards, j app.document_checks) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if identity_queue_private.references_current(g,j) is true then
    update app.guards set id_docs_check_status = j.status, id_docs_decision = j.decision,
      id_docs_reasons = j.reasons, id_docs_message = j.error_message,
      id_docs_checked_at = j.completed_at, updated_at = clock_timestamp()
      where id = g.id;
  end if;
end;
$$;

create function app.claim_identity_document_check() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid := identity_queue_private.require_worker();
  g app.guards;
  j app.document_checks;
  v_job uuid;
begin
  -- Lock the guard before mutating its queue row, as enqueue/completion do.
  for i in 1..8 loop
    select d.id into v_job from app.document_checks d join app.guards q on q.id = d.guard_id
      where d.submission_version is not null and
      ((d.status = 'pending' and d.available_at <= clock_timestamp()) or
       (d.status = 'processing' and d.lease_expires_at <= clock_timestamp()))
      order by d.created_at,d.id limit 1 for update of q skip locked;
    if not found then return null; end if;
    select * into j from app.document_checks where id = v_job for update;
    -- The candidate scan can precede a concurrent commit. Recheck the
    -- locked row before changing its token or status.
    if not found or ((j.status = 'pending' and j.available_at <= clock_timestamp()) or
                     (j.status = 'processing' and j.lease_expires_at <= clock_timestamp())) is not true then
      continue;
    end if;
    select * into g from app.guards where id = j.guard_id;
    if identity_queue_private.references_current(g,j) is not true then
      update app.document_checks set status = 'superseded', completed_at = clock_timestamp(),
        updated_at = clock_timestamp(), lease_expires_at = null where id = j.id;
    elsif j.attempts >= 3 then
      update app.document_checks set status = 'failed', error_message = 'Identity check needs manual review',
        decision = 'review', reasons = '["attempt_limit"]', completed_at = clock_timestamp(),
        updated_at = clock_timestamp(), lease_expires_at = null where id = j.id returning * into j;
      perform identity_queue_private.publish_result(g,j);
    else
      update app.document_checks set status = 'processing', attempts = attempts + 1,
        claimed_at = clock_timestamp(), claimed_by = 'identity-v2', lease_owner = v_worker,
        lease_token = gen_random_uuid(), completion_fingerprint = null, lease_expires_at = clock_timestamp() + interval '10 minutes',
        updated_at = clock_timestamp() where id = j.id returning * into j;
      return jsonb_build_object('id',j.id,'token',j.lease_token,'version',j.submission_version,
        'profile_full_name',g.full_name,'profile_postcode',g.postcode,'profile_dob',g.date_of_birth,
        'sia',(select jsonb_build_object('first',s.sia_first_name,'last',s.sia_surname)
          from app.sia_checks s where s.subject_id = g.id and s.subject_type = 'guard'
          and s.status = 'done' and s.sia_found is true order by s.checked_at desc nulls last limit 1));
    end if;
  end loop;
  return null;
end;
$$;

create function app.identity_document_access(p_job uuid,p_token uuid,p_kind text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid := identity_queue_private.require_worker();
  j app.document_checks;
  g app.guards;
begin
  select * into j from app.document_checks where id = p_job and lease_token = p_token
    and lease_owner = v_worker and status = 'processing' and lease_expires_at > clock_timestamp();
  if not found then raise exception 'active claim required' using errcode = '42501'; end if;
  select * into g from app.guards where id = j.guard_id;
  if identity_queue_private.references_current(g,j) is not true then
    raise exception 'submission no longer current' using errcode = '42501';
  end if;
  case p_kind when 'proof' then return j.proof_reference;
    when 'licence' then return j.licence_reference;
    else raise exception 'unknown document kind' using errcode = '22023';
  end case;
end;
$$;

create function app.finish_identity_document_check(p_job uuid,p_token uuid,p_outcome text,p_reasons text[])
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid := identity_queue_private.require_worker();
  g app.guards;
  j app.document_checks;
  v_fingerprint text;
  v_hash text;
  v_duplicate boolean;
begin
  if p_outcome is null or p_outcome not in ('pass','review','reject','retry')
     or cardinality(coalesce(p_reasons,array[]::text[])) > 48
     or exists(select 1 from unnest(p_reasons) r where r is null or r !~ '^[a-z][a-z0-9_]{0,79}$') then
    raise exception 'invalid advisory result' using errcode = '22023';
  end if;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_array(p_outcome,p_reasons)::text,'UTF8')),'hex');
  select * into g from app.guards where id = (select guard_id from app.document_checks where id = p_job) for update;
  if not found then raise exception 'active claim required' using errcode = '42501'; end if;
  select * into j from app.document_checks where id = p_job for update;
  if j.lease_owner is distinct from v_worker or p_token is null or j.lease_token is distinct from p_token then
    raise exception 'active claim required' using errcode = '42501';
  end if;
  if j.completion_fingerprint = v_fingerprint and j.status in ('pending','done','failed') then
    return j.status;
  end if;
  if j.status <> 'processing' or j.lease_expires_at <= clock_timestamp() then
    raise exception 'active claim required' using errcode = '42501';
  end if;
  if identity_queue_private.references_current(g,j) is not true then
    update app.document_checks set status = 'superseded', completed_at = clock_timestamp(),
      updated_at = clock_timestamp(), lease_expires_at = null where id = j.id;
    return 'superseded';
  end if;
  if p_outcome = 'retry' and j.attempts < 3 then
    update app.document_checks set status = 'pending', lease_expires_at = null,
      available_at = clock_timestamp() + make_interval(secs => 30 * (1 << (j.attempts - 1))),
      completion_fingerprint = v_fingerprint, updated_at = clock_timestamp() where id = j.id;
    return 'pending';
  end if;
  -- Serialize cross-account duplicate checks by digest in a consistent order.
  for v_hash in select distinct h from unnest(array[j.proof_reference->>'sha256',j.licence_reference->>'sha256']) h order by h loop
    perform pg_advisory_xact_lock(hashtextextended('identity-document:' || v_hash,0));
  end loop;
  if j.lease_expires_at <= clock_timestamp() then
    raise exception 'active claim required' using errcode = '42501';
  end if;
  select exists(select 1 from app.document_checks d where d.guard_id <> j.guard_id and d.status = 'done'
    and (d.poa_sha256 in (j.proof_reference->>'sha256',j.licence_reference->>'sha256')
      or d.dl_front_sha256 in (j.proof_reference->>'sha256',j.licence_reference->>'sha256'))) into v_duplicate;

  update app.document_checks set status = case when p_outcome = 'retry' then 'failed' else 'done' end,
    decision = case when p_outcome = 'retry' or v_duplicate then 'review'
                    when p_outcome = 'pass' then 'approve' else p_outcome end,
    reasons = case when p_outcome = 'retry' then '["attempt_limit"]'::jsonb
      else to_jsonb(coalesce(p_reasons,array[]::text[]) || case when v_duplicate then array['document_used_elsewhere'] else array[]::text[] end) end,
    poa_sha256 = j.proof_reference->>'sha256', dl_front_sha256 = j.licence_reference->>'sha256',
    error_message = case when p_outcome = 'retry' then 'Identity check needs manual review' end,
    completed_at = clock_timestamp(), updated_at = clock_timestamp(), lease_expires_at = null,
    completion_fingerprint = v_fingerprint where id = j.id returning * into j;
  perform identity_queue_private.publish_result(g,j);
  return j.status;
end;
$$;

create function app.identity_document_queue_ready() returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform identity_queue_private.require_worker();
  perform d.id from app.document_checks d limit 1;
  perform o.version from storage.objects o where o.bucket_id = 'guard-documents' limit 1;
  return exists(select 1 from storage.buckets b where b.id = 'guard-documents' and b.public is false);
end;
$$;

revoke execute on all functions in schema identity_queue_private from public,anon,authenticated,service_role;
revoke all on function app.identity_queue_is_worker() from public,anon,authenticated,service_role;
grant execute on function app.identity_queue_is_worker() to authenticated;
revoke all on function app.identity_document_sources(uuid),app.enqueue_identity_document_check(uuid,uuid,jsonb,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function app.identity_document_sources(uuid),app.enqueue_identity_document_check(uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function app.claim_identity_document_check(),app.identity_document_access(uuid,uuid,text),
  app.finish_identity_document_check(uuid,uuid,text,text[]),app.identity_document_queue_ready()
  from public,anon,authenticated,service_role;
grant execute on function app.claim_identity_document_check(),app.identity_document_access(uuid,uuid,text),
  app.finish_identity_document_check(uuid,uuid,text,text[]),app.identity_document_queue_ready() to authenticated;

notify pgrst, 'reload schema';
commit;
