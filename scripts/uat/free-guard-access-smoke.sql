-- Only the isolated qg-e2e-sandbox branch. Temporary synthetic fixtures all roll
-- back; cron must remain disabled. No email/provider payment is exercised here.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('qg.free.failed','',true),set_config('qg.free.checks','[]',true);
do $$ begin
  if exists(select 1 from cron.job where active)
    or not exists(select 1 from auth.users where id='8ec6113d-7b78-4c69-a90c-86d0e4b69714' and email='sandbox.guard@example.invalid')
    or not exists(select 1 from app.guards where id='20826398-1bcf-4a93-9b61-493c3e156610' and is_test_account and is_active and verified_by is not null)
    or not exists(select 1 from app.jobs where id='b08b2911-9e16-4aa5-b1b9-202611220202' and job_title='QG E2E Sandbox — Fresh Alert After Queue Repair — Test Only' and status='cancelled')
    or exists(select 1 from app.job_applications where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')
    or exists(select 1 from app.job_assignments where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')
    or exists(select 1 from app.user_entitlements_data where user_id='8ec6113d-7b78-4c69-a90c-86d0e4b69714') then
    raise exception 'Exact isolated sandbox baseline required';
  end if;
  update app.guards set sia_verified=true,sia_licence_number='0000000000000000',sia_expiry_date='2028-10-01'
    where id='20826398-1bcf-4a93-9b61-493c3e156610';
  update app.jobs set status='open',is_deleted=false,start_date=current_date+10,end_date=current_date+10,job_access_level='elite'
    where id='b08b2911-9e16-4aa5-b1b9-202611220202';
exception when others then perform set_config('qg.free.failed','setup: '||sqlstate||' '||sqlerrm,true);end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8ec6113d-7b78-4c69-a90c-86d0e4b69714","role":"authenticated"}',true);
do $$ declare u jsonb;p record;begin
  if current_setting('qg.free.failed')<>'' then return;end if;
  u:=app.get_my_feature_usage('guard_application');
  if (u->>'allowed')::boolean is not true or u->'limit'<>'null'::jsonb or u->'remaining'<>'null'::jsonb then raise exception 'Free usage response missing';end if;
  select * into p from app.get_guard_placement(array['20826398-1bcf-4a93-9b61-493c3e156610'::uuid]);
  if p.id is null or p.profile_boost or p.priority_profile then raise exception 'Neutral owned placement missing';end if;
  begin
    perform app.submit_job_application('8ec6113d-7b78-4c69-a90c-86d0e4b69714','20826398-1bcf-4a93-9b61-493c3e156610','b08b2911-9e16-4aa5-b1b9-202611220202');
    raise exception 'Expected browser EXECUTE denial';
  exception when insufficient_privilege then null;end;
  perform set_config('qg.free.checks','["owned free usage without entitlement","neutral placement","browser cannot submit trusted RPC"]',true);
exception when others then perform set_config('qg.free.failed','owned reads: '||sqlstate||' '||sqlerrm,true);end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$ declare r jsonb;begin
  if current_setting('qg.free.failed')<>'' then return;end if;
  begin
    perform app.submit_job_application('00000000-0000-4000-8000-000000000001','20826398-1bcf-4a93-9b61-493c3e156610','b08b2911-9e16-4aa5-b1b9-202611220202');
    raise exception 'Expected owner denial';
  exception when others then if sqlerrm<>'qg_apply:forbidden' then raise;end if;end;
  r:=app.submit_job_application('8ec6113d-7b78-4c69-a90c-86d0e4b69714','20826398-1bcf-4a93-9b61-493c3e156610','b08b2911-9e16-4aa5-b1b9-202611220202','QA ONLY — free application rollback smoke');
  if r->>'applicationId' is null or (r->>'replayed')::boolean then raise exception 'New free application missing';end if;
  begin
    perform app.submit_job_application('8ec6113d-7b78-4c69-a90c-86d0e4b69714','20826398-1bcf-4a93-9b61-493c3e156610','b08b2911-9e16-4aa5-b1b9-202611220202');
    raise exception 'Expected duplicate denial';
  exception when others then if sqlerrm<>'qg_apply:already_applied' then raise;end if;end;
  if (select count(*) from app.job_applications where job_id='b08b2911-9e16-4aa5-b1b9-202611220202')<>1 then raise exception 'Exactly one application required';end if;
  perform set_config('qg.free.checks',(current_setting('qg.free.checks')::jsonb||jsonb_build_array('foreign actor rejected','service application to Elite job without entitlement','duplicate rejected; exactly one application'))::text,true);
exception when others then perform set_config('qg.free.failed','application: '||sqlstate||' '||sqlerrm,true);end $$;
reset role;
select jsonb_build_object('passed',current_setting('qg.free.failed')='','failure',nullif(current_setting('qg.free.failed'),''),'checks',current_setting('qg.free.checks')::jsonb,'scope','native isolated sandbox; fixture data rolled back; no email or provider payment') receipt;
rollback;
