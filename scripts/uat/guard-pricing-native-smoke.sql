-- Read-only role checks against the isolated seeded catalogue. No payment or
-- customer record is created. Run only in the qg-e2e-sandbox project.
begin;
set local role anon;
do $$ declare n integer; r record; expected integer;begin
 if not exists(select 1 from app.plans where slug='guard_starter' and active and monthly_price_pence=0 and job_limit_per_month is null) then raise exception 'Free guard account configuration missing';end if;
 if exists(select 1 from app.plans where audience='guard' and monthly_price_pence>0 and active) then raise exception 'Paid guard plan advertised';end if;
 select count(*) into n from app.plans where audience='client' and active; if n<>4 then raise exception 'Expected four active client tiers';end if;
 select count(*) into n from app.get_public_client_pricing_fees();if n<>4 then raise exception 'Expected four client fee rules';end if;
 for r in select p.slug,p.monthly_price_pence,p.job_limit_per_month,f.platform_fee_percent,f.platform_fee_fixed_pence from app.plans p join app.get_public_client_pricing_fees() f on f.plan_slug=p.slug where p.audience='client' and p.active loop
  if r.monthly_price_pence<>(case r.slug when 'client_free' then 0 when 'client-starter' then 4900 when 'client-pro' then 9900 when 'client-enterprise' then 19900 end) or r.job_limit_per_month is distinct from (case r.slug when 'client_free' then 1 when 'client-starter' then 10 when 'client-pro' then 30 else null end) then raise exception 'Client tier price or allowance mismatch';end if;
  expected:=case r.slug when 'client_free' then 13800 when 'client-starter' then 13200 when 'client-pro' then 12900 when 'client-enterprise' then 12600 else null end;
  if expected is null or 12000+round(12000*r.platform_fee_percent/100)::integer+r.platform_fee_fixed_pence<>expected then raise exception 'Client fee reconciliation failed';end if;
 end loop;
end $$;
reset role;
select jsonb_build_object('passed',true,'scope','anonymous isolated catalogue and four standard booking examples; no payment','client_tiers',4,'gross_guard_pence',12000) receipt;
rollback;
