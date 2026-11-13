CREATE OR REPLACE FUNCTION app.keep_closed_account_inactive()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from app.account_closures where user_id=new.user_id) then
  if tg_op='INSERT' then raise exception 'Closed account cannot create a new profile'; end if;
  if tg_table_name='user_entitlements_data' then
   new.subscription_status:='canceled';
  else
   new.is_active:=false;
  end if;
  if tg_table_name='guards' then new.dashboard_access:=false; end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION app.begin_account_closure(p_user_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g app.guards%rowtype; c app.clients%rowtype; r app.account_closures%rowtype; typ text; pid uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into r from app.account_closures where user_id=p_user_id for update;
 if found then return to_jsonb(r); end if;
 if p_actor_id<>p_user_id and not exists(select 1 from app.admin_users where user_id=p_actor_id and is_active and role='super_admin') then raise insufficient_privilege; end if;
 if exists(select 1 from app.admin_users where user_id=p_user_id) then raise exception 'Administrator accounts require separate review'; end if;
 select * into g from app.guards where user_id=p_user_id for update;
 select * into c from app.clients where user_id=p_user_id for update;
 if g.id is not null and c.id is not null then raise exception 'Review both role profiles before closure'; end if;
 if g.id is null and c.id is null then raise exception 'Account profile not found'; end if;
 typ:=case when g.id is not null then 'guard' else 'client' end; pid:=coalesce(g.id,c.id);
 if exists(select 1 from app.subscriptions where user_id=p_user_id and stripe_subscription_id is not null and coalesce(status,'') not in ('canceled','cancelled','incomplete_expired')) then
  raise exception 'Cancel the paid subscription and wait for cancellation to complete before closure'; end if;
 if (typ='client' and exists(select 1 from app.jobs where client_id=pid and coalesce(status,'') not in ('completed','cancelled','closed','draft'))) or
    (typ='guard' and exists(select 1 from app.job_assignments where guard_id=pid and coalesce(status,'') not in ('completed','cancelled','rejected'))) then
  raise exception 'Complete or cancel outstanding bookings before closure'; end if;
 if exists(select 1 from app.disputes where (guard_id=g.id or client_id=c.id) and coalesce(status,'') not in ('resolved','closed')) then raise exception 'Resolve the open dispute before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_bank_payouts where guard_id=pid and coalesce(status,'') not in ('paid','canceled','cancelled')) then raise exception 'Resolve bank payouts before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_payouts where guard_id=pid and coalesce(status,'') not in ('completed','paid','cancelled')) then raise exception 'Resolve outstanding payouts before closure'; end if;
 insert into app.account_closures(user_id,profile_id,profile_type,closed_by) values(p_user_id,pid,typ,p_actor_id) returning * into r;
 if typ='guard' then update app.guards set is_active=false,dashboard_access=false where id=pid;
 else update app.clients set is_active=false where id=pid; end if;
 update app.user_entitlements_data set subscription_status='canceled' where user_id=p_user_id;
 insert into app.account_retention_events(closure_id,event_type,actor_id) values(r.id,'closure_started',p_actor_id);
 return to_jsonb(r);
end $function$;
