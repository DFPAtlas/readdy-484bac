-- Sanitised paid placement only; no private profile, plan or billing data is exposed.
create or replace function app.get_guard_placement(p_guard_ids uuid[])
returns table(id uuid, profile_boost boolean, priority_profile boolean)
language sql stable security definer set search_path = '' as $$
  select g.id,
    coalesce(e.features ? 'guard.profile_boost', false),
    coalesce(e.features ? 'guard.priority_profile', false)
  from app.guards g
  left join app.user_entitlements_data e on e.user_id=g.user_id and e.audience='guard'
    and e.is_active and e.subscription_status in ('active','trialing')
    and e.current_period_end > now()
  where g.id=any(p_guard_ids) and cardinality(p_guard_ids)<=200
    and g.is_active and g.profile_completed and g.verified_by is not null
    and g.verification_status in ('approved','verified')
    and app.guard_has_current_sia(g.sia_verified,g.sia_licence_number,g.sia_expiry_date,current_date)
    and (not coalesce(g.is_test_account,false) or exists (
      select 1 from app.client_applicant_profiles a where a.guard_id=g.id
    ) or g.user_id=auth.uid());
$$;
revoke all on function app.get_guard_placement(uuid[]) from public;
grant execute on function app.get_guard_placement(uuid[]) to anon,authenticated,service_role;

-- Keep redemption closed until sandbox acceptance and a deliberate rollout.
insert into app.qg_launch_reward_settings(key,value) values ('token_checkout_enabled','false'::jsonb) on conflict(key) do nothing;
alter table app.qg_token_redemptions add column if not exists checkout_request_id uuid;
alter table app.qg_token_redemptions add column if not exists billing_cycle text;
create unique index if not exists qg_token_redemptions_request_unique on app.qg_token_redemptions(checkout_request_id) where checkout_request_id is not null;
create unique index if not exists qg_token_redemptions_checkout_unique on app.qg_token_redemptions(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

create or replace function app.qg_available_tokens(p_user_id uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
declare v_months integer; e record; quantities bigint[]:='{}'; expiries timestamptz[]:='{}'; approved boolean[]:='{}';
 v_debit bigint; v_take bigint; v_debt bigint:=0; v_total bigint:=0; i integer;
begin
  select (value #>> '{}')::integer into v_months from app.qg_launch_reward_settings where key='token_expiry_months';
  if v_months is null or v_months not between 1 and 120 then raise exception 'Token expiry configuration unavailable';end if;
  -- Replay grants and spend in FIFO order. Subtracting every historical spend
  -- from only today's unexpired grants would wrongly consume new rewards again.
  -- Explicit expiry ledger entries are informational: grant dates already expire
  -- each lot, so counting those debits too would remove the same tokens twice.
  for e in
    select created_at,tokens::bigint quantity,1 kind,status='approved' spendable from app.qg_token_ledger
      where user_id=p_user_id and tokens>0 and status in ('approved','expired')
        and event_type in ('profile_bonus','referral_approved','manual_adjustment')
    union all
    select created_at,tokens::bigint,2,true from app.qg_token_ledger
      where user_id=p_user_id and tokens<0 and status='approved' and event_type in ('manual_adjustment','clawback')
    union all
    select created_at,-tokens_used::bigint,2,true from app.qg_token_redemptions
      where user_id=p_user_id and status in ('pending','confirmed')
    order by created_at,kind
  loop
    if e.quantity>0 then
      v_take:=least(v_debt,e.quantity);v_debt:=v_debt-v_take;
      quantities:=array_append(quantities,e.quantity-v_take);
      expiries:=array_append(expiries,e.created_at+make_interval(months=>v_months));
      approved:=array_append(approved,e.spendable);
    else
      v_debit:=-e.quantity;
      if cardinality(quantities)>0 then
        for i in 1..cardinality(quantities) loop
          if expiries[i]>e.created_at then
            v_take:=least(quantities[i],v_debit);quantities[i]:=quantities[i]-v_take;v_debit:=v_debit-v_take;
          end if;
          exit when v_debit=0;
        end loop;
      end if;
      v_debt:=v_debt+v_debit;
    end if;
  end loop;
  if cardinality(quantities)>0 then
    for i in 1..cardinality(quantities) loop
      if approved[i] and expiries[i]>now() then v_total:=v_total+quantities[i];end if;
    end loop;
  end if;
  return least(greatest(v_total,0),2147483647)::integer;
end $$;
revoke all on function app.qg_available_tokens(uuid) from public,anon,authenticated;
grant execute on function app.qg_available_tokens(uuid) to service_role;

create or replace function app.get_qg_token_balance(user_uuid uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is distinct from user_uuid and nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' is distinct from 'service_role'
    then raise exception 'Token balance belongs to another account' using errcode='42501';end if;
  return app.qg_available_tokens(user_uuid);
end $$;
revoke all on function app.get_qg_token_balance(uuid) from public,anon;
grant execute on function app.get_qg_token_balance(uuid) to authenticated,service_role;

create or replace function app.get_my_token_checkout_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_enabled boolean; v_rate integer; v_cap integer;
begin
 if auth.uid() is null or exists(select 1 from app.account_closures where user_id=auth.uid()) then raise exception 'Active account required' using errcode='42501';end if;
 select value='true'::jsonb into v_enabled from app.qg_launch_reward_settings where key='token_checkout_enabled';
 select (value #>> '{}')::integer into v_rate from app.qg_launch_reward_settings where key='token_value_pence_per_100';
 select (value #>> '{}')::integer into v_cap from app.qg_launch_reward_settings where key='max_redemption_percent_per_invoice';
 return jsonb_build_object('enabled',coalesce(v_enabled,false) and exists(select 1 from app.qg_launch_reward_settings where key='programme_enabled' and value='true'::jsonb),
   'balance',app.qg_available_tokens(auth.uid()),'pence_per_100',v_rate,'max_percent',v_cap,
   'new_subscription',not exists(select 1 from app.subscriptions where user_id=auth.uid() and stripe_subscription_id is not null),
   'pending',(select jsonb_build_object('request_id',checkout_request_id,'tokens',tokens_used,'plan_slug',plan_slug,'billing_cycle',billing_cycle) from app.qg_token_redemptions where user_id=auth.uid() and status='pending' and checkout_request_id is not null order by created_at limit 1));
end $$;
revoke all on function app.get_my_token_checkout_summary() from public,anon;
grant execute on function app.get_my_token_checkout_summary() to authenticated;

-- Only the authenticated checkout service can reserve credits. It verifies the
-- Stripe price against the catalogue before calling; no browser supplied amount.
create or replace function app.reserve_qg_token_checkout(p_user_id uuid,p_request_id uuid,p_plan_slug text,p_billing_cycle text,p_tokens integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r app.qg_token_redemptions; p app.plans; v_rate integer; v_cap integer; v_price bigint; v_credit bigint;
begin
 if p_request_id is null or p_user_id is null or p_tokens is null or p_tokens<=0 or (p_billing_cycle is null or p_billing_cycle not in ('monthly','annual')) then raise exception 'Invalid token checkout';end if;
 if exists(select 1 from app.account_closures where user_id=p_user_id) then raise exception 'Active account required';end if;
 perform pg_advisory_xact_lock(hashtextextended('qg-token:'||p_user_id::text,0));
 select * into r from app.qg_token_redemptions where checkout_request_id=p_request_id;
 if found then
   if r.user_id<>p_user_id or r.plan_slug<>p_plan_slug or r.billing_cycle<>p_billing_cycle or r.tokens_used<>p_tokens then raise exception 'Token checkout request mismatch';end if;
   if r.status<>'pending' then raise exception 'Token checkout already closed';end if;
   return to_jsonb(r);
 end if;
 if not exists(select 1 from app.qg_launch_reward_settings where key='token_checkout_enabled' and value='true'::jsonb)
 or not exists(select 1 from app.qg_launch_reward_settings where key='programme_enabled' and value='true'::jsonb) then raise exception 'Token checkout is unavailable';end if;
 if exists(select 1 from app.qg_token_redemptions where user_id=p_user_id and status='pending') then raise exception 'Finish or cancel the existing token checkout first';end if;
 if exists(select 1 from app.subscriptions where user_id=p_user_id and (stripe_subscription_id is not null or status in ('trialing','past_due','unpaid','incomplete','paused'))) then raise exception 'Tokens currently support new subscriptions only';end if;
 select * into p from app.plans where slug=p_plan_slug and active;
 if not found or p.audience not in ('guard','client') or p.monthly_price_pence<=0 then raise exception 'Subscription plan unavailable';end if;
 if (p.audience='guard' and not exists(select 1 from app.guards where user_id=p_user_id and is_active))
 or (p.audience='client' and not exists(select 1 from app.clients where user_id=p_user_id and is_active)) then raise exception 'Subscription account mismatch';end if;
 select (value #>> '{}')::integer into v_rate from app.qg_launch_reward_settings where key='token_value_pence_per_100';
 select (value #>> '{}')::integer into v_cap from app.qg_launch_reward_settings where key='max_redemption_percent_per_invoice';
 if v_rate is null or v_rate<=0 or v_rate>100000 or v_cap is null or v_cap not between 1 and 50 then raise exception 'Token conversion configuration unavailable';end if;
 v_price:=p.monthly_price_pence::bigint * case when p_billing_cycle='annual' then 10 else 1 end;
 v_credit:=p_tokens::bigint*v_rate/100;
 if v_credit<=0 or v_credit>v_price*v_cap/100 then raise exception 'Token discount exceeds invoice limit';end if;
 if app.qg_available_tokens(p_user_id)<p_tokens then raise exception 'Insufficient approved tokens';end if;
 insert into app.qg_token_redemptions(user_id,tokens_used,credit_pence,status,plan_slug,account_type,checkout_request_id,billing_cycle)
 values(p_user_id,p_tokens,v_credit::integer,'pending',p_plan_slug,p.audience,p_request_id,p_billing_cycle) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function app.reserve_qg_token_checkout(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function app.reserve_qg_token_checkout(uuid,uuid,text,text,integer) to service_role;

create or replace function app.attach_qg_token_checkout(p_id uuid,p_user_id uuid,p_session_id text,p_coupon_id text)
returns void language plpgsql security definer set search_path='' as $$
declare r app.qg_token_redemptions;
begin
 select * into r from app.qg_token_redemptions where id=p_id for update;
 if not found or r.user_id<>p_user_id or r.status<>'pending' or p_session_id is null or p_coupon_id is null or p_session_id not like 'cs_%' or p_coupon_id not like 'qgt_%'
 or (r.stripe_checkout_session_id is not null and r.stripe_checkout_session_id<>p_session_id)
 or (r.stripe_coupon_id is not null and r.stripe_coupon_id<>p_coupon_id) then raise exception 'Token checkout attachment mismatch';end if;
 update app.qg_token_redemptions set stripe_checkout_session_id=p_session_id,stripe_coupon_id=p_coupon_id where id=p_id;
end $$;
revoke all on function app.attach_qg_token_checkout(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function app.attach_qg_token_checkout(uuid,uuid,text,text) to service_role;

-- Called exclusively after signature validation with a freshly retrieved Stripe
-- Checkout Session. A client return URL never spends or releases tokens.
create or replace function app.finish_qg_token_checkout(p_id uuid,p_user_id uuid,p_session_id text,p_coupon_id text,p_discount_pence integer,p_paid boolean,p_expired boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r app.qg_token_redemptions;
begin
 select * into r from app.qg_token_redemptions where id=p_id for update;
 if not found or r.user_id<>p_user_id or r.credit_pence<>p_discount_pence
 or p_session_id is null or p_coupon_id is null or p_session_id not like 'cs_%' or p_coupon_id not like 'qgt_%'
 or (r.stripe_checkout_session_id is not null and r.stripe_checkout_session_id<>p_session_id)
 or (r.stripe_coupon_id is not null and r.stripe_coupon_id<>p_coupon_id)
 or p_paid is null or p_expired is null or p_discount_pence is null or p_paid=p_expired then raise exception 'Token checkout confirmation mismatch';end if;
 if (p_paid and r.status='confirmed') or (p_expired and r.status='cancelled') then return;end if;
 if r.status<>'pending' then raise exception 'Token checkout already closed';end if;
 update app.qg_token_redemptions set stripe_checkout_session_id=p_session_id,stripe_coupon_id=p_coupon_id,
 status=case when p_paid then 'confirmed' else 'cancelled' end,
 confirmed_at=case when p_paid then now() else null end,cancelled_at=case when p_expired then now() else null end where id=p_id;
end $$;
revoke all on function app.finish_qg_token_checkout(uuid,uuid,text,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function app.finish_qg_token_checkout(uuid,uuid,text,text,integer,boolean,boolean) to service_role;
