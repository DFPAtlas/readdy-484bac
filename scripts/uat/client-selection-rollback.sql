-- Run only against the isolated alfwwggavmyerjyqumuo branch.
-- All fixture, notification and audit changes roll back. No browser push,
-- Edge Function or provider checkout call is made. Cron must remain disabled.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('qg.selection.failure','',true),set_config('qg.selection.checks','[]',true);
do $$ begin
  if exists(select 1 from cron.job where active)
    or not exists(select 1 from auth.users where id='8ec6113d-7b78-4c69-a90c-86d0e4b69714' and email='sandbox.guard@example.invalid')
    or not exists(select 1 from app.guards where id='20826398-1bcf-4a93-9b61-493c3e156610' and is_test_account and is_active and verified_by is not null)
    or not exists(select 1 from app.jobs where id='b08b2911-9e16-4aa5-b1b9-202611220202' and job_title='QG E2E Sandbox — Fresh Alert After Queue Repair — Test Only' and status='cancelled')
    or not exists(select 1 from app.clients c join app.jobs j on j.client_id=c.id where j.id='b08b2911-9e16-4aa5-b1b9-202611220202' and c.user_id='8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b')
    or exists(select 1 from app.job_applications where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')
    or exists(select 1 from app.job_assignments where job_id='b08b2911-9e16-4aa5-b1b9-202611220202') then
    raise exception 'Exact isolated sandbox baseline required';
  end if;
  update app.guards set sia_verified=true,sia_licence_number='0000000000000000',sia_expiry_date=current_date+365 where id='20826398-1bcf-4a93-9b61-493c3e156610';
  update app.jobs set start_date=current_date+10,end_date=current_date+10,start_time='09:00',end_time='17:00',number_of_days=1,status='draft',is_draft=true,is_deleted=false where id='b08b2911-9e16-4aa5-b1b9-202611220202';
  insert into app.job_applications(job_id,guard_id,status) values('b08b2911-9e16-4aa5-b1b9-202611220202','20826398-1bcf-4a93-9b61-493c3e156610','pending');
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b","role":"authenticated"}',true);
do $$ begin
  begin
    perform app.select_job_guards('b08b2911-9e16-4aa5-b1b9-202611220202','[{"guard_id":"20826398-1bcf-4a93-9b61-493c3e156610","agreed_hourly_rate":1,"agreed_hours":1,"gross_guard_amount":1}]'::jsonb);
    raise exception 'Expected denial was absent';
  exception when others then
    if sqlerrm <> 'job_not_selectable' then raise;end if;
  end;
  perform set_config('qg.selection.checks',(current_setting('qg.selection.checks')::jsonb||jsonb_build_array('draft denied'))::text,true);
exception when others then perform set_config('qg.selection.failure',sqlstate||' '||sqlerrm,true);end $$;
reset role;
update app.jobs set status='cancelled',is_draft=false where id='b08b2911-9e16-4aa5-b1b9-202611220202';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b","role":"authenticated"}',true);
do $$ begin
  begin
    perform app.select_job_guards('b08b2911-9e16-4aa5-b1b9-202611220202','[{"guard_id":"20826398-1bcf-4a93-9b61-493c3e156610","agreed_hourly_rate":1,"agreed_hours":1,"gross_guard_amount":1}]'::jsonb);
    raise exception 'Expected denial was absent';
  exception when others then
    if sqlerrm <> 'job_not_selectable' then raise;end if;
  end;
  perform set_config('qg.selection.checks',(current_setting('qg.selection.checks')::jsonb||jsonb_build_array('cancelled denied'))::text,true);
exception when others then perform set_config('qg.selection.failure',sqlstate||' '||sqlerrm,true);end $$;
reset role;
update app.jobs set status='open',is_draft=false where id='b08b2911-9e16-4aa5-b1b9-202611220202'; update app.job_applications set status='withdrawn' where job_id='b08b2911-9e16-4aa5-b1b9-202611220202';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b","role":"authenticated"}',true);
do $$ begin
  begin
    perform app.select_job_guards('b08b2911-9e16-4aa5-b1b9-202611220202','[{"guard_id":"20826398-1bcf-4a93-9b61-493c3e156610","agreed_hourly_rate":1,"agreed_hours":1,"gross_guard_amount":1}]'::jsonb);
    raise exception 'Expected denial was absent';
  exception when others then
    if sqlerrm <> 'application_not_selectable' then raise;end if;
  end;
  perform set_config('qg.selection.checks',(current_setting('qg.selection.checks')::jsonb||jsonb_build_array('withdrawn denied'))::text,true);
exception when others then perform set_config('qg.selection.failure',sqlstate||' '||sqlerrm,true);end $$;
reset role;
update app.job_applications set status='pending' where job_id='b08b2911-9e16-4aa5-b1b9-202611220202';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b","role":"authenticated"}',true);
do $$ declare r jsonb;a record;assignment_id uuid;begin
  r:=app.select_job_guards('b08b2911-9e16-4aa5-b1b9-202611220202','[{"guard_id":"20826398-1bcf-4a93-9b61-493c3e156610","agreed_hourly_rate":1,"agreed_hours":1,"gross_guard_amount":1}]'::jsonb);
  if (r->>'success')::boolean is not true then raise exception 'Selection not acknowledged';end if;
  select * into a from app.job_assignments where job_id='b08b2911-9e16-4aa5-b1b9-202611220202' and guard_id='20826398-1bcf-4a93-9b61-493c3e156610';
  if a.id is null or a.status<>'awaiting_payment' or a.payment_status<>'pending' or a.agreed_hours<>8
    or a.agreed_hourly_rate<>(select coalesce(nullif(hourly_rate,0), (select hourly_rate from app.jobs where id='b08b2911-9e16-4aa5-b1b9-202611220202')) from app.guards where id='20826398-1bcf-4a93-9b61-493c3e156610')
    or a.gross_guard_amount<>a.agreed_hourly_rate*8 then raise exception 'Provisional amounts/state mismatch';end if;
  assignment_id:=a.id;
  r:=app.select_job_guards('b08b2911-9e16-4aa5-b1b9-202611220202','[{"guard_id":"20826398-1bcf-4a93-9b61-493c3e156610","agreed_hourly_rate":1,"agreed_hours":1,"gross_guard_amount":1}]'::jsonb);
  if (r->>'success')::boolean is not true or (select count(*) from app.job_assignments where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')<>1
    or (select id from app.job_assignments where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')<>assignment_id then raise exception 'Retry duplicated assignment';end if;
  if not exists(select 1 from app.jobs where id='b08b2911-9e16-4aa5-b1b9-202611220202' and status='awaiting_payment' and payment_status='pending') then raise exception 'Unexpected job/payment state';end if;
  perform set_config('qg.selection.checks',(current_setting('qg.selection.checks')::jsonb||jsonb_build_array('eligible applicant provisionally selected','browser amounts ignored','retry retains one assignment','job remains unpaid'))::text,true);
exception when others then perform set_config('qg.selection.failure',sqlstate||' '||sqlerrm,true);end $$;
reset role;
select jsonb_build_object('passed',current_setting('qg.selection.failure')='','failure',nullif(current_setting('qg.selection.failure'),''),'checks',current_setting('qg.selection.checks')::jsonb,'scope','isolated sandbox authenticated database RPC; all fixture writes rolled back; browser not exercised; no checkout') receipt;
rollback;
