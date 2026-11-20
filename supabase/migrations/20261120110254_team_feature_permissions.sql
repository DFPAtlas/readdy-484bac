-- Return only the authenticated member's effective delegated feature keys.
-- Browser RLS intentionally does not expose another user's private entitlement.
create function app.get_my_team_features()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  config public.team_member_configs%rowtype;
  owner_features jsonb;
  result jsonb;
begin
  if caller_id is null then return '[]'::jsonb; end if;
  -- Existing pair uniqueness allows several owners; do not choose one silently.
  if (select count(*) from public.team_member_configs where member_user_id = caller_id) <> 1 then
    return '[]'::jsonb;
  end if;
  select * into strict config from public.team_member_configs where member_user_id = caller_id;
  if config.admin_user_id = caller_id then return '[]'::jsonb; end if;
  if exists (select 1 from app.account_closures where user_id in (caller_id, config.admin_user_id)) then
    return '[]'::jsonb;
  end if;
  if (select count(*) from app.clients where user_id = caller_id and is_active is true) <> 1
     or (select count(*) from app.clients where user_id = config.admin_user_id and is_active is true) <> 1
     or not exists (select 1 from app.users where id = caller_id and user_type = 'client')
     or not exists (select 1 from app.users where id = config.admin_user_id and user_type = 'client') then
    return '[]'::jsonb;
  end if;
  select features into owner_features from app.user_entitlements_data
    where user_id = config.admin_user_id and is_active is true and audience = 'client';
  if jsonb_typeof(owner_features) is distinct from 'array'
     or not owner_features @> '["client.team_access"]'::jsonb
     or jsonb_typeof(config.enabled_features) is distinct from 'array' then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(feature order by feature), '[]'::jsonb) into result
  from (
    select distinct value as feature from jsonb_array_elements_text(config.enabled_features)
    where value in (
      'client.post_job', 'client.view_guard_profiles', 'client.advanced_matching',
      'client.priority_support', 'client.job_templates', 'client.analytics_dashboard',
      'client.direct_contact', 'client.unlimited_jobs', 'client.bulk_posting',
      'client.multi_site', 'client.team_access', 'client.custom_contracts',
      'client.api_access', 'client.escrow_payments', 'client.job_history', 'client.job_tracker'
    ) and owner_features @> jsonb_build_array(value)
  ) allowed;
  return result;
end;
$$;

revoke all on function app.get_my_team_features() from public, anon;
grant execute on function app.get_my_team_features() to authenticated, service_role;
comment on function app.get_my_team_features() is
  'Caller-only team feature intersection; no owner identity, billing data or entitlement row is returned.';
