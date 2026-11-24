begin;
set local lock_timeout = '5s';

create table identity_queue_private.human_reviews (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null,
  reviewer_id uuid not null,
  submission_version bigint not null,
  proof_reference jsonb not null,
  licence_reference jsonb not null,
  back_reference jsonb not null,
  opened_at timestamptz not null default clock_timestamp(),
  attested_at timestamptz
);
create index human_reviews_guard_reviewer_idx
  on identity_queue_private.human_reviews(guard_id, reviewer_id, opened_at desc);

create table identity_queue_private.human_review_audit (
  id bigint generated always as identity primary key,
  review_id uuid not null references identity_queue_private.human_reviews(id),
  guard_id uuid not null,
  reviewer_id uuid not null,
  submission_version bigint not null,
  event text not null check(event in ('proof','licence','back','attested','approved','restored')),
  occurred_at timestamptz not null default clock_timestamp()
);
create index human_review_audit_review_event_idx
  on identity_queue_private.human_review_audit(review_id,event);

create function identity_queue_private.assert_reviewer(p_actor uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_actor is null or not exists (
    select 1 from app.admin_users a where a.user_id=p_actor and a.is_active
      and a.role in ('admin','super_admin') for share
  ) or exists (select 1 from identity_queue_private.workers w where w.user_id=p_actor) then
    raise exception 'Active authorised administrator required' using errcode='42501';
  end if;
end;
$$;

create function identity_queue_private.reviewer() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'AAL2 required' using errcode='42501';
  end if;
  perform identity_queue_private.assert_reviewer(v_actor);
  return v_actor;
end;
$$;

create function identity_queue_private.back_reference(g app.guards) returns jsonb
language sql volatile security definer set search_path = ''
as $$
  select jsonb_build_object('path',o.name,'id',o.id,'version',o.version,'etag',o.metadata->>'eTag')
  from storage.objects o where o.bucket_id='guard-documents'
    and o.name=g.driving_licence_back_url
    and o.name ~ ('^' || g.user_id::text || '/back-[0-9]+\.(png|jpe?g|webp|pdf)$')
    and (o.owner_id=g.user_id::text or (o.owner_id is null and o.owner=g.user_id))
    and nullif(o.version,'') is not null and o.archived_at is null and not coalesce(o.is_delete_marker,false)
$$;

create function identity_queue_private.review_context(p_review uuid,p_actor uuid,p_lock boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r identity_queue_private.human_reviews; g app.guards; j app.document_checks; n integer;
begin
  select * into r from identity_queue_private.human_reviews where id=p_review and reviewer_id=p_actor;
  if not found then raise exception 'Review unavailable' using errcode='42501'; end if;
  -- Serialize approval with pointer changes, then take fail-fast storage locks.
  -- Storage writes can take object locks before invalidating the guard, so never wait on those locks.
  if p_lock then
    select * into g from app.guards where id=r.guard_id for update;
    perform 1 from storage.objects o
      where o.id in ((r.back_reference->>'id')::uuid,
        (r.proof_reference->>'id')::uuid, (r.licence_reference->>'id')::uuid)
      order by o.id for share nowait;
    get diagnostics n = row_count;
    if n<>3 then raise exception 'Documents changed. Start a new review.' using errcode='55000'; end if;
  else
    select * into g from app.guards where id=r.guard_id;
  end if;
  select * into j from app.document_checks where guard_id=g.id and submission_version=r.submission_version;
  if identity_queue_private.references_current(g,j) is not true or j.submission_version is null
     or r.proof_reference is distinct from j.proof_reference or r.licence_reference is distinct from j.licence_reference
     or (r.back_reference-'sha256') is distinct from identity_queue_private.back_reference(g) then
    raise exception 'Documents changed. Start a new review.' using errcode='55000';
  end if;
  return jsonb_build_object('id',r.id,'guard',r.guard_id,'version',r.submission_version::text,
    'attested_at',r.attested_at,'proof',j.proof_reference,'licence',j.licence_reference,'back',r.back_reference);
end;
$$;

create function app.begin_guard_document_review(p_guard uuid,p_actor uuid,p_back jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare g app.guards; j app.document_checks; v_id uuid;
begin
  perform identity_queue_private.assert_reviewer(p_actor);
  select * into g from app.guards where id=p_guard for update;
  select * into j from app.document_checks where guard_id=g.id and submission_version=g.id_docs_submission_version;
  if j.submission_version is null or identity_queue_private.references_current(g,j) is not true or
    (p_back->>'sha256' ~ '^[a-f0-9]{64}$' and (p_back-'sha256')=identity_queue_private.back_reference(g)) is not true then
    raise exception 'Current document snapshot required' using errcode='55000';
  end if;
  insert into identity_queue_private.human_reviews(guard_id,reviewer_id,submission_version,proof_reference,licence_reference,back_reference)
    values (g.id,p_actor,j.submission_version,j.proof_reference,j.licence_reference,p_back) returning id into v_id;
  return v_id;
end;
$$;

create function app.guard_review_sources(p_guard uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare g app.guards;
begin
  perform identity_queue_private.assert_reviewer(p_actor);
  select * into g from app.guards where id=p_guard;
  return jsonb_build_object('owner',g.user_id,'back',identity_queue_private.back_reference(g));
end;
$$;

create function app.guard_review_document(p_review uuid,p_actor uuid,p_kind text,p_digest text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare ctx jsonb; ref jsonb;
begin
  perform identity_queue_private.assert_reviewer(p_actor);
  if p_kind is null or p_kind not in ('proof','licence','back') then
    raise exception 'Invalid document slot' using errcode='22023';
  end if;
  ctx := identity_queue_private.review_context(p_review,p_actor,p_digest is not null);
  ref := ctx->p_kind;
  if p_digest is not null then
    if ref->>'sha256' is distinct from p_digest then raise exception 'Document checksum mismatch' using errcode='55000'; end if;
    insert into identity_queue_private.human_review_audit(review_id,guard_id,reviewer_id,submission_version,event)
    values (p_review,(ctx->>'guard')::uuid,p_actor,(ctx->>'version')::bigint,p_kind);
  end if;
  return ref;
end;
$$;

create function app.guard_document_review_status(p_guard uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := identity_queue_private.reviewer(); g app.guards; item record; ctx jsonb;
begin
  select * into g from app.guards where id=p_guard;
  if not found then raise exception 'Guard unavailable' using errcode='55000'; end if;
  select id into item from identity_queue_private.human_reviews
    where guard_id=g.id and reviewer_id=actor order by opened_at desc limit 1;
  if found then
    begin ctx := identity_queue_private.review_context(item.id,actor);
    exception when sqlstate '55000' then ctx := null;
    end;
  end if;
  return jsonb_build_object('version',g.id_docs_submission_version::text,'status',g.id_docs_check_status,
    'advisory',g.id_docs_decision,'reasons',coalesce(g.id_docs_reasons,'[]'::jsonb),
    'review',ctx - 'proof' - 'licence' - 'back',
    'viewed',(select coalesce(jsonb_agg(distinct a.event),'[]'::jsonb)
       from identity_queue_private.human_review_audit a where a.review_id=(ctx->>'id')::uuid
         and a.event in ('proof','licence','back')),
    'verification_status',g.verification_status,
    'can_restore',g.verified_by is not null and (g.verification_status='suspended' or
      (g.verification_status in ('approved','verified') and (g.is_active is not true or g.dashboard_access is not true))));
end;
$$;

create function app.attest_guard_document_review(p_review uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := identity_queue_private.reviewer(); ctx jsonb;
begin
  ctx := identity_queue_private.review_context(p_review,actor,true);
  if (select count(distinct event) from identity_queue_private.human_review_audit
      where review_id=p_review and event in ('proof','licence','back'))<>3 then
    raise exception 'Open all current documents before attesting' using errcode='55000';
  end if;
  update identity_queue_private.human_reviews set attested_at=clock_timestamp()
    where id=p_review and attested_at is null;
  if found then
    insert into identity_queue_private.human_review_audit(review_id,guard_id,reviewer_id,submission_version,event)
    values (p_review,(ctx->>'guard')::uuid,actor,(ctx->>'version')::bigint,'attested');
  end if;
end;
$$;

-- All guard writers, including legacy service-role routes, encounter this fence.
create function identity_queue_private.require_review_transition() returns trigger
language plpgsql set search_path = ''
as $$
declare v_actor uuid; v_id uuid; ctx jsonb;
begin
  if new.verification_status in ('approved','verified') and
     (tg_op='INSERT' or new.verification_status is distinct from old.verification_status
      or (new.is_active is true and old.is_active is not true)
      or (new.dashboard_access is true and old.dashboard_access is not true)
      or new.verified_by is distinct from old.verified_by) then
    if tg_op='INSERT' or current_user <> (
      select pg_get_userbyid(p.proowner) from pg_proc p
        where p.oid='app.approve_guard_document_review(uuid,uuid,text)'::regprocedure
    ) then raise exception 'Use the version-bound guard review approval' using errcode='42501'; end if;
    v_actor := identity_queue_private.reviewer();
    if new.verified_by is distinct from v_actor then
      raise exception 'Reviewer identity mismatch' using errcode='42501';
    end if;
    v_id := nullif(current_setting('quickguard.human_review',true),'')::uuid;
    ctx := identity_queue_private.review_context(v_id,v_actor,true);
    if (ctx->>'guard')::uuid is distinct from new.id or ctx->>'attested_at' is null or
      (new.user_id,new.proof_of_address_url,new.driving_licence_front_url,new.driving_licence_back_url)
      is distinct from (old.user_id,old.proof_of_address_url,old.driving_licence_front_url,old.driving_licence_back_url) then
      raise exception 'Current human attestation required' using errcode='55000';
    end if;
  end if;
  return new;
end;
$$;

create function app.approve_guard_document_review(p_guard uuid,p_review uuid,p_action text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := identity_queue_private.reviewer(); ctx jsonb; g app.guards;
begin
  if p_action is null or p_action not in ('approve','restore') then raise exception 'Invalid approval action' using errcode='22023'; end if;
  ctx := identity_queue_private.review_context(p_review,actor,true);
  if (ctx->>'guard')::uuid is distinct from p_guard or ctx->>'attested_at' is null then
    raise exception 'Current human attestation required' using errcode='55000';
  end if;
  select * into g from app.guards where id=p_guard;
  if g.verification_status in ('approved','verified') and g.verified_by is null then
    raise exception 'Existing approval has no recorded reviewer' using errcode='P0002';
  end if;
  if g.verification_status in ('approved','verified') and g.verified_by is not null
    and g.is_active is true and g.dashboard_access is true then
    return jsonb_build_object('status',g.verification_status,'replayed',true);
  end if;
  if (p_action='restore' and (g.verified_by is null or (g.verification_status not in ('suspended','approved','verified')) is not false))
     or (p_action='approve' and g.verification_status='suspended') then
    raise exception 'Invalid guard status for this action' using errcode='55000';
  end if;
  perform set_config('quickguard.human_review',p_review::text,true);
  update app.guards set verification_status='approved',verified_by=actor,verified_at=clock_timestamp(),
    is_active=true,dashboard_access=true,profile_completed=true,rejection_reason=null,rejected_at=null,
    sia_verified=case when p_action='approve' then true else sia_verified end,
    sia_verified_at=case when p_action='approve' then clock_timestamp() else sia_verified_at end,
    updated_at=clock_timestamp() where id=p_guard returning * into g;
  if g.verification_status is distinct from 'approved' or g.is_active is not true
    or g.dashboard_access is not true or g.verified_by is distinct from actor then
    raise exception 'Guard could not be approved under existing account controls' using errcode='55000';
  end if;
  perform set_config('quickguard.human_review','',true);
  insert into identity_queue_private.human_review_audit(review_id,guard_id,reviewer_id,submission_version,event)
    values (p_review,p_guard,actor,(ctx->>'version')::bigint,case when p_action='restore' then 'restored' else 'approved' end);
  return jsonb_build_object('status','approved','replayed',false);
end;
$$;

create trigger zz_guard_document_review_fence
before insert or update of verification_status,verified_by,is_active,dashboard_access on app.guards
for each row execute function identity_queue_private.require_review_transition();

revoke execute on function identity_queue_private.assert_reviewer(uuid),identity_queue_private.reviewer(),
 identity_queue_private.back_reference(app.guards),identity_queue_private.review_context(uuid,uuid,boolean),
 identity_queue_private.require_review_transition() from public,anon,authenticated,service_role;
revoke all on function app.begin_guard_document_review(uuid,uuid,jsonb),app.guard_review_sources(uuid,uuid),
 app.guard_review_document(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function app.begin_guard_document_review(uuid,uuid,jsonb),app.guard_review_sources(uuid,uuid),
 app.guard_review_document(uuid,uuid,text,text) to service_role;
revoke all on function app.guard_document_review_status(uuid),app.attest_guard_document_review(uuid),
 app.approve_guard_document_review(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function app.guard_document_review_status(uuid),app.attest_guard_document_review(uuid),
 app.approve_guard_document_review(uuid,uuid,text) to authenticated;
-- Owners keep their uploads. Admin access to the identity bucket goes
-- through the scoped broker so a signed URL cannot bypass the access audit.
create policy identity_admin_scoped_document_reads on storage.objects as restrictive
for select to authenticated using (
  bucket_id <> 'guard-documents' or split_part(name,'/',1)=auth.uid()::text
);

notify pgrst, 'reload schema';
commit;
