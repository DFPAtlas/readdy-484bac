-- Close the legacy guard catalogue to new sales. Existing subscription, invoice,
-- entitlement, provider identifiers and reward records remain untouched.
do $$ begin
  if exists(select 1 from app.plans where slug='guard_starter' and (audience<>'guard' or monthly_price_pence<>0)) then
    raise exception 'Free guard plan configuration requires review';
  end if;
end $$;

update app.plans set active = false, updated_at = now()
where audience = 'guard' and monthly_price_pence > 0 and active;

insert into app.plans (slug,name,audience,features,monthly_price_pence,active,description,job_limit_per_month)
values ('guard_starter','Free Guard Account','guard',
  '["guard.apply_job","guard.view_jobs","guard.create_profile","guard.advanced_alerts"]'::jsonb,
  0,true,'Free guard profile, job browsing and applications. Approval and licence requirements apply.',null)
on conflict (slug) do update set job_limit_per_month = null,
  description = excluded.description, updated_at = now()
where app.plans.audience = 'guard' and app.plans.monthly_price_pence = 0;

-- Do not automatically cancel existing subscriptions: renewal treatment and any
-- credit/refund decision require provider reconciliation and reviewed notices.
