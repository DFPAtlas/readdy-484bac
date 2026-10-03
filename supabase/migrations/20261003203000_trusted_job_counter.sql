CREATE OR REPLACE FUNCTION app.protect_client_server_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
BEGIN
  IF current_user = 'qg_job_counter_writer' THEN
    IF (to_jsonb(NEW) - ARRAY['total_jobs_posted','active_jobs','updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['total_jobs_posted','active_jobs','updated_at']) THEN
      RAISE EXCEPTION 'Counter writer cannot modify other client fields' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.role() = 'authenticated' AND NOT is_active_admin() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.profile_completed IS DISTINCT FROM OLD.profile_completed
      OR NEW.total_jobs_posted IS DISTINCT FROM OLD.total_jobs_posted
      OR NEW.active_jobs IS DISTINCT FROM OLD.active_jobs
      OR NEW.total_spent IS DISTINCT FROM OLD.total_spent
      OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id
      OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
      OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
      OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
      OR NEW.billing_cycle_day IS DISTINCT FROM OLD.billing_cycle_day
    THEN
      RAISE EXCEPTION 'Attempt to modify protected client fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='qg_job_counter_writer') then
    create role qg_job_counter_writer nologin noinherit;
  end if;
end $$;
grant usage on schema app to qg_job_counter_writer;
grant select(id,total_jobs_posted,active_jobs), update(total_jobs_posted,active_jobs) on app.clients to qg_job_counter_writer;
create policy job_counter_select on app.clients for select to qg_job_counter_writer using(true);
create policy job_counter_update on app.clients for update to qg_job_counter_writer using(true) with check(true);

create or replace function public.update_client_job_counts()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
declare
  target_client uuid;
  delta integer := 0;
  old_active boolean := false;
  new_active boolean := false;
begin
  if TG_OP <> 'INSERT' then
    old_active := coalesce(OLD.status in ('open','pending','awaiting_guard_selection','awaiting_payment','confirmed','in_progress','awaiting_client_approval'),false);
  end if;
  if TG_OP <> 'DELETE' then
    new_active := coalesce(NEW.status in ('open','pending','awaiting_guard_selection','awaiting_payment','confirmed','in_progress','awaiting_client_approval'),false);
  end if;
  if TG_OP = 'UPDATE' and NEW.client_id is distinct from OLD.client_id then
    raise exception 'Job ownership cannot change' using errcode='42501';
  end if;
  target_client := case when TG_OP='DELETE' then OLD.client_id else NEW.client_id end;
  delta := new_active::integer - old_active::integer;
  update app.clients
  set total_jobs_posted=coalesce(total_jobs_posted,0)+case when TG_OP='INSERT' then 1 else 0 end,
      active_jobs=greatest(0,coalesce(active_jobs,0)+delta)
  where id=target_client;
  return null;
end;
$$;
grant qg_job_counter_writer to postgres;
grant create on schema public to qg_job_counter_writer;
alter function public.update_client_job_counts() owner to qg_job_counter_writer;
revoke create on schema public from qg_job_counter_writer;
revoke qg_job_counter_writer from postgres;
revoke all on function public.update_client_job_counts() from public,anon,authenticated;
drop trigger if exists trigger_update_client_job_counts on app.jobs;
create trigger trigger_update_client_job_counts after insert or update or delete on app.jobs for each row execute function public.update_client_job_counts();
