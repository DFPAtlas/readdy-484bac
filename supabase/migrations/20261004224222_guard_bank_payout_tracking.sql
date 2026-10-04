-- Bank payouts are aggregate deposits, not individual job transfers.
create table if not exists app.guard_bank_payouts (
 id uuid primary key default gen_random_uuid(),
 guard_id uuid not null references app.guards(id),
 stripe_account_id text not null,
 stripe_payout_id text not null unique,
 amount_minor bigint not null check(amount_minor > 0),
 currency text not null check(currency ~ '^[a-z]{3}$'),
 status text not null check(status in ('pending','in_transit','paid','failed','canceled')),
 arrival_date timestamptz,
 bank_last4 text,
 failure_code text,
 failure_message text,
 livemode boolean not null,
 stripe_created_at timestamptz not null,
 updated_at timestamptz not null default now()
);
create index if not exists guard_bank_payouts_guard_created on app.guard_bank_payouts(guard_id,stripe_created_at desc);
alter table app.guard_bank_payouts enable row level security;
revoke all on app.guard_bank_payouts from public,anon,authenticated;
grant select on app.guard_bank_payouts to authenticated;
grant all on app.guard_bank_payouts to service_role;
create policy guard_bank_payouts_read on app.guard_bank_payouts for select to authenticated using (
 exists(select 1 from app.guards g where g.id=guard_id and g.user_id=(select auth.uid()))
 or exists(select 1 from app.admin_users a where a.user_id=(select auth.uid()) and a.is_active and a.role in ('super_admin','finance_admin'))
);
create policy guard_bank_payouts_service on app.guard_bank_payouts for all to service_role using(true) with check(true);

-- Signing keys never appear in client-selectable tables or function responses.
create table if not exists app.bank_payout_webhook_keys (
 endpoint_id text primary key,
 signing_secret text not null,
 livemode boolean not null,
 active boolean not null default true
);
alter table app.bank_payout_webhook_keys enable row level security;
revoke all on app.bank_payout_webhook_keys from public,anon,authenticated;
grant all on app.bank_payout_webhook_keys to service_role;
create policy bank_payout_webhook_keys_service on app.bank_payout_webhook_keys for all to service_role using(true) with check(true);

create table if not exists app.bank_payout_events (
 stripe_event_id text primary key,
 stripe_account_id text not null,
 stripe_payout_id text not null,
 processed_at timestamptz not null default now()
);
alter table app.bank_payout_events enable row level security;
revoke all on app.bank_payout_events from public,anon,authenticated;
grant all on app.bank_payout_events to service_role;
create policy bank_payout_events_service on app.bank_payout_events for all to service_role using(true) with check(true);

create or replace function app.record_guard_bank_payout(p_account_id text,p_payout jsonb,p_event_id text default null)
returns jsonb language plpgsql security invoker set search_path=app,pg_temp as $$
declare v_guard uuid; v_existing app.guard_bank_payouts%rowtype; v_row app.guard_bank_payouts%rowtype; v_event text; v_changed boolean;
begin
 if p_account_id is null or p_account_id !~ '^acct_' or p_payout->>'id' !~ '^po_' or
    p_payout->>'status' not in ('pending','in_transit','paid','failed','canceled') or
    jsonb_typeof(p_payout->'amount') <> 'number' or (p_payout->>'amount')::numeric <= 0 or
    (p_payout->>'amount')::numeric <> trunc((p_payout->>'amount')::numeric) or
    p_payout->>'currency' !~ '^[a-z]{3}$' or jsonb_typeof(p_payout->'livemode') <> 'boolean' or
    jsonb_typeof(p_payout->'created') <> 'number' then raise exception 'Invalid bank payout'; end if;
 if p_payout->>'id' is null or p_payout->>'status' is null or p_payout->>'currency' is null or p_payout->>'created' is null or p_payout->>'livemode' is null or p_payout->>'amount' is null then raise exception 'Incomplete bank payout'; end if;
 select id into strict v_guard from app.guards where stripe_account_id=p_account_id;
 -- Serialize updates for this recipient, including sync versus webhook races.
 perform 1 from app.guards where id=v_guard for update;
 if p_event_id is not null then
  insert into app.bank_payout_events(stripe_event_id,stripe_account_id,stripe_payout_id)
  values(p_event_id,p_account_id,p_payout->>'id') on conflict do nothing returning stripe_event_id into v_event;
  if v_event is null then return jsonb_build_object('replayed',true); end if;
 end if;
 select * into v_existing from app.guard_bank_payouts where stripe_payout_id=p_payout->>'id' for update;
 if v_existing.id is not null and (v_existing.stripe_account_id<>p_account_id or v_existing.guard_id<>v_guard) then raise exception 'Bank payout account mismatch'; end if;
 if v_existing.id is not null and (v_existing.amount_minor<>(p_payout->>'amount')::bigint or v_existing.currency<>p_payout->>'currency' or v_existing.livemode<>(p_payout->>'livemode')::boolean) then raise exception 'Bank payout immutable fields mismatch'; end if;
 -- Current Stripe reads are authoritative, but paid may legitimately become failed.
 -- Never regress a terminal state to an earlier pending/in_transit snapshot.
 if v_existing.status in ('paid','failed','canceled') and p_payout->>'status' in ('pending','in_transit') then return jsonb_build_object('ignored_stale',true); end if;
 if v_existing.status in ('failed','canceled') and p_payout->>'status' <> v_existing.status then return jsonb_build_object('ignored_stale',true); end if;
 v_changed := v_existing.id is null or v_existing.status is distinct from p_payout->>'status' or v_existing.failure_code is distinct from p_payout->>'failure_code';
 insert into app.guard_bank_payouts(guard_id,stripe_account_id,stripe_payout_id,amount_minor,currency,status,arrival_date,bank_last4,failure_code,failure_message,livemode,stripe_created_at)
 values(v_guard,p_account_id,p_payout->>'id',(p_payout->>'amount')::bigint,p_payout->>'currency',p_payout->>'status',to_timestamp((p_payout->>'arrival_date')::double precision),left(p_payout->>'bank_last4',4),p_payout->>'failure_code',p_payout->>'failure_message',(p_payout->>'livemode')::boolean,to_timestamp((p_payout->>'created')::double precision))
 on conflict(stripe_payout_id) do update set status=excluded.status,arrival_date=excluded.arrival_date,bank_last4=excluded.bank_last4,failure_code=excluded.failure_code,failure_message=excluded.failure_message,updated_at=now()
 returning * into v_row;
 if v_changed then
  insert into app.payment_audit_logs(guard_id,from_status,to_status,event_type,stripe_event_id,reference_type,reference_id,details)
  values(v_guard,v_existing.status,v_row.status,'bank_payout.'||v_row.status,p_event_id,'guard_bank_payout',v_row.id,jsonb_build_object('stripe_payout_id',v_row.stripe_payout_id,'stripe_account_id',p_account_id,'amount_minor',v_row.amount_minor,'currency',v_row.currency,'failure_code',v_row.failure_code));
 end if;
 return jsonb_build_object('id',v_row.id,'status',v_row.status);
exception when no_data_found then return jsonb_build_object('ignored_unknown_account',true);
end $$;
revoke all on function app.record_guard_bank_payout(text,jsonb,text) from public,anon,authenticated;
grant execute on function app.record_guard_bank_payout(text,jsonb,text) to service_role;
