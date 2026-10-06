-- Restore the promised completion timeout without reviving the retired payout endpoint.
-- The database makes the overdue decision atomically; the scheduled Edge Function only
-- orchestrates the existing idempotent create-guard-payout transfer path.

-- BEGIN AUTO RELEASE CORE

alter table app.job_completion_requests
  add column if not exists auto_approved_at timestamptz,
  add column if not exists auto_release_hours integer,
  add column if not exists auto_payout_last_attempt_at timestamptz,
  add column if not exists auto_payout_next_attempt_at timestamptz,
  add column if not exists auto_payout_completed_at timestamptz,
  add column if not exists auto_payout_attempt_count integer not null default 0;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app.job_completion_requests'::regclass
      and conname = 'job_completion_requests_auto_release_hours_check'
  ) then
    alter table app.job_completion_requests
      add constraint job_completion_requests_auto_release_hours_check
      check (auto_release_hours is null or auto_release_hours between 0 and 720);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app.job_completion_requests'::regclass
      and conname = 'job_completion_requests_auto_payout_attempt_count_check'
  ) then
    alter table app.job_completion_requests
      add constraint job_completion_requests_auto_payout_attempt_count_check
      check (auto_payout_attempt_count >= 0);
  end if;
end
$migration$;

create index if not exists job_completion_requests_auto_release_candidates
  on app.job_completion_requests (requested_at, id)
  where status = 'pending';

create index if not exists job_completion_requests_auto_payout_retry
  on app.job_completion_requests (auto_payout_next_attempt_at, auto_approved_at)
  where auto_approved_at is not null and auto_payout_completed_at is null;

-- Return only genuinely due requests so a long custom release window cannot
-- repeatedly occupy the worker batch and starve later 72-hour requests.
create or replace function app.list_overdue_completion_payment_requests(p_limit integer default 100)
returns table("requestId" uuid)
language sql
security invoker
set search_path = ''
as $function$
  select request.id as "requestId"
  from app.job_completion_requests request
  join app.jobs job on job.id = request.job_id
  join app.job_assignments assignment
    on assignment.job_id = request.job_id and assignment.guard_id = request.guard_id
  join lateral (
    select transaction.metadata #>> '{breakdown,autoRelease}' as raw_release_hours
    from app.transactions transaction
    where transaction.job_id = job.id
      and transaction.client_id = job.client_id
      and transaction.transaction_type = 'job_payment'
      and transaction.status = 'completed'
      and transaction.stripe_payment_intent is not null
      and not coalesce(transaction.refunded, false)
      and coalesce(transaction.refund_amount, 0) = 0
    order by transaction.created_at desc
    limit 1
  ) payment on true
  cross join lateral (
    select case
      when payment.raw_release_hours ~ '^[0-9]+$'
        then least(720::numeric, payment.raw_release_hours::numeric)::integer
      else 72
    end as release_hours
  ) policy
  where request.status = 'pending'
    and job.status in ('awaiting_client_approval', 'payout_approved')
    and job.payment_status = 'funded'
    and not coalesce(job.is_deleted, false)
    and not coalesce(job.disputed, false)
    and assignment.status = 'completed'
    and assignment.payment_status = 'funded'
    and coalesce(assignment.completed_at, request.requested_at)
      + make_interval(hours => policy.release_hours) <= clock_timestamp()
    and not exists (
      select 1 from app.disputes
      where job_id = job.id and status = 'open'
    )
    and not exists (
      select 1 from app.financial_operations
      where job_id = job.id and state in ('processing', 'reconciliation_required')
    )
  order by coalesce(assignment.completed_at, request.requested_at), request.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$function$;

revoke all on function app.list_overdue_completion_payment_requests(integer)
  from public, anon, authenticated;
grant execute on function app.list_overdue_completion_payment_requests(integer)
  to service_role;

create or replace function app.record_overdue_completion_payment_decision(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  request app.job_completion_requests;
  job app.jobs;
  assignment app.job_assignments;
  payment app.transactions;
  raw_auto_release_hours text;
  release_hours integer := 72;
  completed_at timestamptz;
  due_at timestamptz;
begin
  if p_request_id is null then
    raise exception 'Completion request is required';
  end if;

  -- Match the manual approval lock order: job, request, assignment.
  select * into request
  from app.job_completion_requests
  where id = p_request_id;

  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'not_found');
  end if;

  select * into job
  from app.jobs
  where id = request.job_id
  for update;

  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'associated_record_missing');
  end if;

  select * into request
  from app.job_completion_requests
  where id = p_request_id
  for update;

  select * into assignment
  from app.job_assignments
  where job_id = job.id and guard_id = request.guard_id
  for update;

  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'associated_record_missing');
  end if;

  if request.status <> 'pending'
    or job.status not in ('awaiting_client_approval', 'payout_approved')
    or job.payment_status <> 'funded'
    or assignment.status <> 'completed'
    or assignment.payment_status <> 'funded' then
    return jsonb_build_object('eligible', false, 'reason', 'state_changed');
  end if;

  if coalesce(job.is_deleted, false)
    or coalesce(job.disputed, false)
    or exists (
      select 1 from app.disputes
      where job_id = job.id and status = 'open'
    )
    or exists (
      select 1 from app.financial_operations
      where job_id = job.id and state in ('processing', 'reconciliation_required')
    ) then
    return jsonb_build_object('eligible', false, 'reason', 'finance_hold');
  end if;

  select * into payment
  from app.transactions
  where job_id = job.id
    and client_id = job.client_id
    and transaction_type = 'job_payment'
    and status = 'completed'
  order by created_at desc
  limit 1;

  if not found
    or payment.stripe_payment_intent is null
    or coalesce(payment.refunded, false)
    or coalesce(payment.refund_amount, 0) > 0 then
    return jsonb_build_object('eligible', false, 'reason', 'payment_not_releasable');
  end if;

  -- Use the policy frozen into the paid transaction, not a plan changed later.
  raw_auto_release_hours := payment.metadata #>> '{breakdown,autoRelease}';
  if raw_auto_release_hours ~ '^[0-9]+$' then
    release_hours := least(720::numeric, raw_auto_release_hours::numeric)::integer;
  end if;

  completed_at := coalesce(assignment.completed_at, request.requested_at);
  if completed_at is null then
    return jsonb_build_object('eligible', false, 'reason', 'completion_time_missing');
  end if;

  due_at := completed_at + make_interval(hours => release_hours);
  if due_at > clock_timestamp() then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'not_due',
      'dueAt', due_at,
      'autoReleaseHours', release_hours
    );
  end if;

  update app.job_completion_requests
  set status = 'approved',
      auto_approved_at = clock_timestamp(),
      auto_release_hours = release_hours,
      auto_payout_next_attempt_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = request.id;

  update app.job_assignments
  set payment_status = 'payout_pending', updated_at = clock_timestamp()
  where id = assignment.id;

  update app.jobs
  set status = 'payout_approved',
      disputed = false,
      disputed_at = null,
      disputed_reason = null,
      updated_at = clock_timestamp()
  where id = job.id;

  insert into app.payment_audit_logs(
    job_id, assignment_id, guard_id, client_id, from_status, to_status,
    changed_by, changed_by_role, event_type, reference_type, reference_id,
    details, created_at
  ) values (
    job.id, assignment.id, assignment.guard_id, job.client_id,
    assignment.payment_status, 'payout_pending', null, 'system',
    'completion_auto_approved', 'job_completion_request', request.id::text,
    jsonb_build_object(
      'auto_release_hours', release_hours,
      'completed_at', completed_at,
      'due_at', due_at,
      'policy_source', case
        when raw_auto_release_hours ~ '^[0-9]+$' then 'transaction_metadata'
        else 'default_72_hours'
      end
    ),
    clock_timestamp()
  );

  return jsonb_build_object(
    'eligible', true,
    'requestId', request.id,
    'assignmentId', assignment.id,
    'jobId', job.id,
    'guardId', assignment.guard_id,
    'dueAt', due_at,
    'autoReleaseHours', release_hours
  );
end
$function$;

revoke all on function app.record_overdue_completion_payment_decision(uuid)
  from public, anon, authenticated;
grant execute on function app.record_overdue_completion_payment_decision(uuid)
  to service_role;

create or replace function app.claim_auto_payout_attempt(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  request app.job_completion_requests;
  job app.jobs;
  assignment app.job_assignments;
begin
  if p_request_id is null then
    raise exception 'Completion request is required';
  end if;

  select * into request
  from app.job_completion_requests
  where id = p_request_id
  for update;

  if not found
    or request.status <> 'approved'
    or request.auto_approved_at is null
    or request.auto_payout_completed_at is not null then
    return jsonb_build_object('claimed', false, 'reason', 'not_pending');
  end if;

  if request.auto_payout_next_attempt_at is not null
    and request.auto_payout_next_attempt_at > clock_timestamp() then
    return jsonb_build_object('claimed', false, 'reason', 'retry_not_due');
  end if;

  select * into job
  from app.jobs
  where id = request.job_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'associated_record_missing');
  end if;

  select * into assignment
  from app.job_assignments
  where job_id = request.job_id and guard_id = request.guard_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'associated_record_missing');
  end if;

  if assignment.payment_status in ('paid', 'paid_out', 'completed')
    or coalesce(assignment.payout_released, false) then
    update app.job_completion_requests
    set auto_payout_completed_at = clock_timestamp(),
        auto_payout_next_attempt_at = null,
        updated_at = clock_timestamp()
    where id = request.id;
    return jsonb_build_object('claimed', false, 'reason', 'already_complete');
  end if;

  if assignment.payment_status = 'payout_processing' then
    update app.job_completion_requests
    set auto_payout_next_attempt_at = clock_timestamp() + interval '1 hour',
        updated_at = clock_timestamp()
    where id = request.id;
    return jsonb_build_object('claimed', false, 'reason', 'processing');
  end if;

  if assignment.status <> 'completed'
    or assignment.payment_status <> 'payout_pending'
    or job.status <> 'payout_approved'
    or coalesce(job.disputed, false)
    or coalesce(job.is_deleted, false)
    or exists (
      select 1 from app.disputes
      where job_id = job.id and status = 'open'
    ) then
    update app.job_completion_requests
    set auto_payout_next_attempt_at = clock_timestamp() + interval '1 hour',
        updated_at = clock_timestamp()
    where id = request.id;
    return jsonb_build_object('claimed', false, 'reason', 'finance_hold');
  end if;

  update app.job_completion_requests
  set auto_payout_last_attempt_at = clock_timestamp(),
      auto_payout_next_attempt_at = clock_timestamp() + interval '1 hour',
      auto_payout_attempt_count = auto_payout_attempt_count + 1,
      updated_at = clock_timestamp()
  where id = request.id;

  return jsonb_build_object(
    'claimed', true,
    'requestId', request.id,
    'assignmentId', assignment.id,
    'jobId', job.id,
    'guardId', assignment.guard_id,
    'attempt', request.auto_payout_attempt_count + 1
  );
end
$function$;

revoke all on function app.claim_auto_payout_attempt(uuid)
  from public, anon, authenticated;
grant execute on function app.claim_auto_payout_attempt(uuid)
  to service_role;

-- END AUTO RELEASE CORE

-- A generated Vault token authenticates pg_cron without exposing service-role keys.
do $migration$
begin
  if not exists (
    select 1 from vault.secrets where name = 'qg_payout_worker_token'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'qg_payout_worker_token',
      'QuickGuard overdue guard payout scheduler token'
    );
  end if;
end
$migration$;

create or replace function app.validate_payout_worker_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select coalesce(
    exists (
      select 1
      from vault.decrypted_secrets secret
      where secret.name = 'qg_payout_worker_token'
        and secret.decrypted_secret = p_token
        and p_token is not null
        and length(p_token) >= 32
    ),
    false
  );
$function$;

revoke all on function app.validate_payout_worker_token(text)
  from public, anon, authenticated;
grant execute on function app.validate_payout_worker_token(text)
  to service_role;

-- Remove every retired caller, including renamed jobs that still target the 410 route.
do $migration$
declare
  scheduled_job record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for scheduled_job in
    select jobid
    from cron.job
    where jobname in ('auto-release-guard-payments', 'process-overdue-guard-payouts')
       or command like '%/functions/v1/auto-release-guard-payments%'
       or command like '%/functions/v1/process-overdue-guard-payouts%'
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end
$migration$;

select cron.schedule(
  'process-overdue-guard-payouts',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := 'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/process-overdue-guard-payouts',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-qg-payout-worker-token', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'qg_payout_worker_token'
          limit 1
        )
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);
