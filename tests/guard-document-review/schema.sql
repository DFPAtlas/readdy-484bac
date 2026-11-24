-- Extra production-shaped columns and JWT AAL for the isolated fixture only.
alter table app.admin_users add column role text;
alter table app.guards add column driving_licence_back_url text,
  add column verified_at timestamptz, add column rejection_reason text,
  add column rejected_at timestamptz, add column sia_verified boolean,
  add column sia_verified_at timestamptz;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))
$$;
