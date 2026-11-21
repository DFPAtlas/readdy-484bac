-- Versioned client terms. Job snapshots and guard acceptances never follow a
-- mutable template pointer; changing the default affects future publications.
create table app.client_contract_templates (
  id uuid primary key, client_id uuid not null references app.clients(id) on delete cascade,
  title text not null check(length(btrim(title)) between 1 and 160),
  terms text not null check(length(btrim(terms)) between 1 and 60000),
  content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index client_contract_templates_owner on app.client_contract_templates(client_id,created_at desc);
create table app.client_contract_defaults (
  client_id uuid primary key references app.clients(id) on delete cascade,
  template_id uuid not null references app.client_contract_templates(id)
);
create table app.job_contracts (
  job_id uuid primary key references app.jobs(id) on delete cascade,
  client_id uuid not null, template_id uuid not null,
  title text not null, terms text not null, content_sha256 text not null,
  attached_at timestamptz not null default now()
);
create table app.job_contract_acceptances (
  job_id uuid not null references app.job_contracts(job_id) on delete cascade,
  guard_id uuid not null, actor_user_id uuid not null,
  content_sha256 text not null, accepted_at timestamptz not null default now(),
  primary key(job_id,guard_id)
);
alter table app.client_contract_templates enable row level security;
alter table app.client_contract_defaults enable row level security;
alter table app.job_contracts enable row level security;
alter table app.job_contract_acceptances enable row level security;
revoke all on app.client_contract_templates,app.client_contract_defaults,app.job_contracts,app.job_contract_acceptances from public,anon,authenticated;
grant all on app.client_contract_templates,app.client_contract_defaults,app.job_contracts,app.job_contract_acceptances to service_role;
create policy contract_templates_service on app.client_contract_templates to service_role using(true) with check(true);
create policy contract_defaults_service on app.client_contract_defaults to service_role using(true) with check(true);
create policy job_contracts_service on app.job_contracts to service_role using(true) with check(true);
create policy contract_acceptances_service on app.job_contract_acceptances to service_role using(true) with check(true);

create function app.qg_client_has_owned_feature(p_user uuid,p_feature text) returns boolean
language sql stable security definer set search_path='' as $$
 select app.qg_active_message_role(p_user)='client' and exists(select 1 from app.user_entitlements_data e
 where e.user_id=p_user and e.is_active is true and e.audience='client' and jsonb_typeof(e.features)='array' and e.features @> jsonb_build_array(p_feature));
$$;
revoke all on function app.qg_client_has_owned_feature(uuid,text) from public,anon,authenticated;

create function app.get_my_contract_settings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();cid uuid;selected uuid; versions jsonb;allowed boolean;
begin
 if app.qg_active_message_role(actor) is distinct from 'client' or (select count(*) from app.clients where user_id=actor)<>1 then raise insufficient_privilege;end if;
 select id into strict cid from app.clients where user_id=actor;
 allowed:=coalesce(app.qg_client_has_owned_feature(actor,'client.custom_contracts'),false);
 select template_id into selected from app.client_contract_defaults where client_id=cid;
 select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id),'[]') into versions from
  (select id,title,terms,content_sha256,created_at from app.client_contract_templates where client_id=cid and (id=selected or id in (select id from app.client_contract_templates where client_id=cid order by created_at desc,id limit 100)) order by created_at desc,id limit 101) v;
 return jsonb_build_object('client_id',cid,'allowed',allowed,'default_template_id',selected,'templates',versions);
end $$;
revoke all on function app.get_my_contract_settings() from public,anon;
grant execute on function app.get_my_contract_settings() to authenticated;

create function app.save_my_contract_template(p_id uuid,p_title text,p_terms text,p_expected_default uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cid uuid;selected uuid;prior app.client_contract_templates%rowtype;digest text;
begin
 if not coalesce(app.qg_client_has_owned_feature(actor,'client.custom_contracts'),false) or (select count(*) from app.clients where user_id=actor)<>1 then raise insufficient_privilege;end if;
 select id into strict cid from app.clients where user_id=actor;
 if p_id is null or p_title is null or length(btrim(p_title)) not between 1 and 160 or p_terms is null or length(btrim(p_terms)) not between 1 and 60000 then raise exception 'Enter a title and contract terms (up to 60000 characters)';end if;
 digest:=encode(sha256(convert_to(p_terms,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('client_contract:'||cid::text,0));
 select * into prior from app.client_contract_templates where id=p_id;
 if found then
  if prior.client_id<>cid or prior.title is distinct from btrim(p_title) or prior.terms is distinct from p_terms then raise exception 'Contract retry differs from the original request';end if;
  return app.get_my_contract_settings()||jsonb_build_object('saved_id',p_id,'replayed',true);
 end if;
 select template_id into selected from app.client_contract_defaults where client_id=cid;
 if selected is distinct from p_expected_default then raise exception 'Default contract changed. Reload before saving';end if;
 insert into app.client_contract_templates(id,client_id,title,terms,content_sha256) values(p_id,cid,btrim(p_title),p_terms,digest);
 insert into app.client_contract_defaults values(cid,p_id) on conflict(client_id) do update set template_id=excluded.template_id;
 if not exists(select 1 from app.client_contract_templates where id=p_id and client_id=cid and title=btrim(p_title) and terms=p_terms and content_sha256=digest)
  or not exists(select 1 from app.client_contract_defaults where client_id=cid and template_id=p_id) then raise exception 'Contract save could not be confirmed';end if;
 return app.get_my_contract_settings()||jsonb_build_object('saved_id',p_id,'replayed',false);
end $$;
revoke all on function app.save_my_contract_template(uuid,text,text,uuid) from public,anon;
grant execute on function app.save_my_contract_template(uuid,text,text,uuid) to authenticated;

create function app.set_my_default_contract(p_template_id uuid,p_expected_default uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cid uuid;selected uuid;
begin
 if not coalesce(app.qg_client_has_owned_feature(actor,'client.custom_contracts'),false) or (select count(*) from app.clients where user_id=actor)<>1 then raise insufficient_privilege;end if;
 select id into strict cid from app.clients where user_id=actor;
 perform pg_advisory_xact_lock(hashtextextended('client_contract:'||cid::text,0));
 select template_id into selected from app.client_contract_defaults where client_id=cid;
 if selected is not distinct from p_template_id then return app.get_my_contract_settings();end if;
 if selected is distinct from p_expected_default then raise exception 'Default contract changed. Reload before saving';end if;
 if p_template_id is null then delete from app.client_contract_defaults where client_id=cid;
 else
  if not exists(select 1 from app.client_contract_templates where id=p_template_id and client_id=cid) then raise insufficient_privilege;end if;
  insert into app.client_contract_defaults values(cid,p_template_id) on conflict(client_id) do update set template_id=excluded.template_id;
 end if;
 select template_id into selected from app.client_contract_defaults where client_id=cid;
 if selected is distinct from p_template_id then raise exception 'Default contract save could not be confirmed';end if;
 return app.get_my_contract_settings();
end $$;
revoke all on function app.set_my_default_contract(uuid,uuid) from public,anon;
grant execute on function app.set_my_default_contract(uuid,uuid) to authenticated;

create function app.attach_default_job_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if new.is_deleted is true or new.is_draft is true or new.status='draft' then return new;end if;
 if tg_op='UPDATE' then if old.status is distinct from 'draft' and old.is_draft is distinct from true then return new;end if;end if;
 select user_id into owner_id from app.clients where id=new.client_id;
 if not coalesce(app.qg_client_has_owned_feature(owner_id,'client.custom_contracts'),false) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('client_contract:'||new.client_id::text,0));
 insert into app.job_contracts(job_id,client_id,template_id,title,terms,content_sha256)
 select new.id,new.client_id,t.id,t.title,t.terms,t.content_sha256 from app.client_contract_defaults d
 join app.client_contract_templates t on t.id=d.template_id and t.client_id=d.client_id where d.client_id=new.client_id
 on conflict(job_id) do nothing;
 if exists(select 1 from app.client_contract_defaults where client_id=new.client_id) and not exists(select 1 from app.job_contracts where job_id=new.id and client_id=new.client_id) then raise exception 'Job contract snapshot could not be confirmed';end if;
 return new;
end $$;
revoke all on function app.attach_default_job_contract() from public,anon,authenticated;
create trigger attach_default_job_contract after insert or update of status,is_draft on app.jobs for each row execute function app.attach_default_job_contract();

create function app.get_job_contract(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();kind text;gid uuid;job app.jobs%rowtype;contract app.job_contracts%rowtype;receipt app.job_contract_acceptances%rowtype;
begin
 kind:=app.qg_active_message_role(actor);
 if kind is null then raise insufficient_privilege;end if;
 select * into job from app.jobs where id=p_job_id;
 if job.id is null or job.is_deleted is true then raise insufficient_privilege;end if;
 if kind='client' then
  if not exists(select 1 from app.clients where id=job.client_id and user_id=actor) then raise insufficient_privilege;end if;
 elsif kind='guard' then
  if (select count(*) from app.guards where user_id=actor)<>1 then raise insufficient_privilege;end if;
  select id into strict gid from app.guards where user_id=actor;
  if job.status<>'open' and not exists(select 1 from app.job_applications where job_id=p_job_id and guard_id=gid)
    and not exists(select 1 from app.job_assignments where job_id=p_job_id and guard_id=gid)
    and not exists(select 1 from app.job_invites where job_id=p_job_id and guard_id=gid) then raise insufficient_privilege;end if;
 elsif kind<>'admin' then raise insufficient_privilege;end if;
 select * into contract from app.job_contracts where job_id=p_job_id;
 if not found then return jsonb_build_object('job_id',p_job_id,'contract',null);end if;
 if contract.client_id is distinct from job.client_id then raise insufficient_privilege;end if;
 select * into receipt from app.job_contract_acceptances where job_id=p_job_id and guard_id=gid;
 return jsonb_build_object('job_id',p_job_id,'contract',jsonb_build_object('title',contract.title,'terms',contract.terms,'content_sha256',contract.content_sha256,'attached_at',contract.attached_at,'accepted_at',receipt.accepted_at),'can_accept',kind='guard');
end $$;
revoke all on function app.get_job_contract(uuid) from public,anon;
grant execute on function app.get_job_contract(uuid) to authenticated;

create function app.accept_job_contract(p_job_id uuid,p_expected_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();gid uuid;detail jsonb;digest text;
begin
 if app.qg_active_message_role(actor) is distinct from 'guard' then raise insufficient_privilege;end if;
 detail:=app.get_job_contract(p_job_id);digest:=detail->'contract'->>'content_sha256';
 if digest is null or digest is distinct from p_expected_sha256 then raise exception 'Contract changed. Reload and review the terms';end if;
 select id into strict gid from app.guards where user_id=actor;
 insert into app.job_contract_acceptances(job_id,guard_id,actor_user_id,content_sha256) values(p_job_id,gid,actor,digest) on conflict(job_id,guard_id) do nothing;
 if not exists(select 1 from app.job_contract_acceptances where job_id=p_job_id and guard_id=gid and actor_user_id=actor and content_sha256=digest) then raise exception 'Contract acceptance could not be confirmed';end if;
 return app.get_job_contract(p_job_id);
end $$;
revoke all on function app.accept_job_contract(uuid,text) from public,anon;
grant execute on function app.accept_job_contract(uuid,text) to authenticated;

create function app.require_assignment_contract_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.status,'') not in ('cancelled','rejected','declined','withdrawn') and exists(select 1 from app.job_contracts c where c.job_id=new.job_id
   and not exists(select 1 from app.job_contract_acceptances a where a.job_id=c.job_id and a.guard_id=new.guard_id and a.content_sha256=c.content_sha256)) then
   raise exception using errcode='P0001',message='Guard must review and accept the job contract before assignment';
 end if;return new;
end $$;
revoke all on function app.require_assignment_contract_acceptance() from public,anon,authenticated;
create trigger require_assignment_contract_acceptance before insert or update of job_id,guard_id,status on app.job_assignments for each row execute function app.require_assignment_contract_acceptance();

create function app.prevent_contract_revision_update() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Published contract versions and acceptance receipts are immutable. Create a new version';end $$;
revoke all on function app.prevent_contract_revision_update() from public,anon,authenticated;
create trigger immutable_contract_templates before update on app.client_contract_templates for each row execute function app.prevent_contract_revision_update();
create trigger immutable_job_contracts before update on app.job_contracts for each row execute function app.prevent_contract_revision_update();
create trigger immutable_contract_acceptances before update on app.job_contract_acceptances for each row execute function app.prevent_contract_revision_update();

-- The service tier is derived from trusted entitlements, not a browser field.
-- Severity remains separate so an urgent safety incident is never demoted.
alter table app.support_tickets add column support_tier text not null default 'standard' check(support_tier in ('standard','priority'));
create function app.set_support_service_tier() returns trigger language plpgsql security definer set search_path='' as $$
declare requester uuid;
begin
 if tg_op='UPDATE' then new.support_tier:=old.support_tier;return new;end if;
 select user_id into requester from app.clients where id=new.client_id;
 new.support_tier:=case when coalesce(app.qg_client_has_owned_feature(requester,'client.priority_support'),false) then 'priority' else 'standard' end;
 return new;
end $$;
revoke all on function app.set_support_service_tier() from public,anon,authenticated;
create trigger set_support_service_tier before insert or update on app.support_tickets for each row execute function app.set_support_service_tier();
notify pgrst, 'reload schema';
