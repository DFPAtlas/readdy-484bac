-- G01: every new application, including the authoritative RPC and invitation
-- path, rejects elapsed UK job dates. A failure rolls back quota/invite writes.
-- Existing applications, historical reads and idempotent replays are unchanged.
create or replace function app.guard_application_requires_current_job()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare job_day date;
begin
  select j.start_date into job_day from app.jobs j where j.id = new.job_id for share;
  if not found then raise exception 'qg_apply:job_not_found'; end if;
  if job_day is null or job_day < (statement_timestamp() at time zone 'Europe/London')::date then
    raise exception 'qg_apply:job_expired';
  end if;
  return new;
end;
$$;
revoke all on function app.guard_application_requires_current_job() from public, anon, authenticated;
create trigger guard_application_requires_current_job
before insert on app.job_applications for each row
execute function app.guard_application_requires_current_job();
