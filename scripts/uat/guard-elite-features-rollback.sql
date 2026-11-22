-- ONLY the closed isolated qg-e2e-sandbox branch. Native RPC/RLS checks, not
-- evidence of an actual provider payment, webhook delivery or reviewed SIA identity.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('qg.elite.failed','',true),set_config('qg.elite.checks','[]',true);
do $$ begin
 if exists(select 1 from cron.job where active)
 or not exists(select 1 from auth.users where id='8ec6113d-7b78-4c69-a90c-86d0e4b69714' and email='sandbox.guard@example.invalid')
 or not exists(select 1 from app.guards where id='20826398-1bcf-4a93-9b61-493c3e156610' and is_test_account and verified_by is not null)
 or not exists(select 1 from app.payment_audit_logs where id='b08b2911-9e16-4aa5-b1b9-202611220200' and metadata->>'phase'='closed')
 or exists(select 1 from app.user_entitlements_data where user_id='8ec6113d-7b78-4c69-a90c-86d0e4b69714')
 or exists(select 1 from app.qg_token_redemptions where user_id='8ec6113d-7b78-4c69-a90c-86d0e4b69714') then raise exception 'Exact isolated baseline required';end if;
 update app.guards set sia_verified=true,sia_licence_number='0000000000000000',sia_expiry_date='2028-10-01' where id='20826398-1bcf-4a93-9b61-493c3e156610';
 insert into app.user_entitlements(user_id,plan_slug,plan_name,audience,features,monthly_price_pence,subscription_status,current_period_end,cancel_at_period_end)
 select '8ec6113d-7b78-4c69-a90c-86d0e4b69714',slug,name,audience,features,monthly_price_pence,'active',now()+interval '30 days',false from app.plans where slug='guard-elite' and active;
 insert into app.qg_launch_reward_settings(key,value) values
 ('token_checkout_enabled','true'),('programme_enabled','true'),('token_expiry_months','12'),('token_value_pence_per_100','1000'),('max_redemption_percent_per_invoice','50') on conflict(key) do update set value=excluded.value;
 insert into app.qg_token_ledger(user_id,event_type,tokens,status,admin_note) values('8ec6113d-7b78-4c69-a90c-86d0e4b69714','manual_adjustment',500,'approved','QA ONLY — synthetic rollback fixture; no cash or provider payment');
exception when others then perform set_config('qg.elite.failed','setup: '||sqlstate||' '||sqlerrm,true);end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8ec6113d-7b78-4c69-a90c-86d0e4b69714","role":"authenticated"}',true);
do $$ declare p record;s jsonb;begin
 if current_setting('qg.elite.failed')<>'' then return;end if;
 select * into p from app.get_guard_placement(array['20826398-1bcf-4a93-9b61-493c3e156610'::uuid]);
 if p.id is null or not p.profile_boost or not p.priority_profile then raise exception 'Eligible Elite placement missing';end if;
 s:=app.get_my_token_checkout_summary();
 if (s->>'balance')::integer<>500 or (s->>'enabled')::boolean is not true then raise exception 'Owned summary mismatch';end if;
 begin perform app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220401','guard-elite','monthly',100);raise exception 'Expected service-only denial';exception when insufficient_privilege then null;end;
 perform set_config('qg.elite.checks','["owned Elite boost and priority flags","owned approved token summary","browser role cannot reserve tokens"]',true);
exception when others then perform set_config('qg.elite.failed','owned reads: '||sqlstate||' '||sqlerrm,true);end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$ declare r jsonb;retry jsonb;r2 jsonb;begin
 if current_setting('qg.elite.failed')<>'' then return;end if;
 begin perform app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220401','guard-elite','monthly',146);raise exception 'Expected invoice cap';exception when others then if sqlerrm not like 'Token discount exceeds invoice limit%' then raise;end if;end;
 r:=app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220401','guard-elite','monthly',100);
 retry:=app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220401','guard-elite','monthly',100);
 if r->>'id' is distinct from retry->>'id' or (r->>'credit_pence')::integer<>1000 or app.qg_available_tokens('8ec6113d-7b78-4c69-a90c-86d0e4b69714')<>400 then raise exception 'Reservation replay mismatch';end if;
 begin perform app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220402','guard-elite','monthly',100);raise exception 'Expected concurrent reservation denial';exception when others then if sqlerrm not like 'Finish or cancel the existing token checkout first%' then raise;end if;end;
 perform app.attach_qg_token_checkout((r->>'id')::uuid,'8ec6113d-7b78-4c69-a90c-86d0e4b69714','cs_test_QA_rollback_401','qgt_QA_rollback_401');
 perform app.finish_qg_token_checkout((r->>'id')::uuid,'8ec6113d-7b78-4c69-a90c-86d0e4b69714','cs_test_QA_rollback_401','qgt_QA_rollback_401',1000,true,false);
 perform app.finish_qg_token_checkout((r->>'id')::uuid,'8ec6113d-7b78-4c69-a90c-86d0e4b69714','cs_test_QA_rollback_401','qgt_QA_rollback_401',1000,true,false);
 if app.qg_available_tokens('8ec6113d-7b78-4c69-a90c-86d0e4b69714')<>400 then raise exception 'Duplicate confirmation consumed tokens';end if;
 r2:=app.reserve_qg_token_checkout('8ec6113d-7b78-4c69-a90c-86d0e4b69714','b08b2911-9e16-4aa5-b1b9-202611220402','guard-elite','monthly',100);
 perform app.finish_qg_token_checkout((r2->>'id')::uuid,'8ec6113d-7b78-4c69-a90c-86d0e4b69714','cs_test_QA_rollback_402','qgt_QA_rollback_402',1000,false,true);
 perform app.finish_qg_token_checkout((r2->>'id')::uuid,'8ec6113d-7b78-4c69-a90c-86d0e4b69714','cs_test_QA_rollback_402','qgt_QA_rollback_402',1000,false,true);
 if app.qg_available_tokens('8ec6113d-7b78-4c69-a90c-86d0e4b69714')<>400 then raise exception 'Expiry release mismatch';end if;
 perform set_config('qg.elite.checks',(current_setting('qg.elite.checks')::jsonb||jsonb_build_array('50 percent invoice cap','atomic reservation and idempotent replay','second pending checkout rejected','simulated confirmation consumes once','simulated expiry releases once'))::text,true);
exception when others then perform set_config('qg.elite.failed','token writes: '||sqlstate||' '||sqlerrm,true);end $$;
reset role;
select jsonb_build_object('passed',current_setting('qg.elite.failed')='','failure',nullif(current_setting('qg.elite.failed'),''),'checks',current_setting('qg.elite.checks')::jsonb,'provider_payment',false,'scope','native sandbox only; simulated provider references; all fixtures rolled back') receipt;
rollback;
