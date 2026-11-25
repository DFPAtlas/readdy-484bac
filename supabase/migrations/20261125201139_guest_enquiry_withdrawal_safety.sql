-- Serialize consent changes per receipt so withdrawal cannot be undone by an
-- in-flight save. Barriers contain no contact data and expire after 30 days.
create table app.guest_booking_withdrawals (
 receipt_hash text primary key check(receipt_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default now()+interval '30 days'
);
alter table app.guest_booking_withdrawals enable row level security;
revoke all on app.guest_booking_withdrawals from public,anon,authenticated;
grant all on app.guest_booking_withdrawals to service_role;
-- Admin removal uses the verified MFA Edge action and the same serialized path.
revoke delete on app.guest_booking_enquiries from authenticated;
drop policy guest_enquiries_admin_delete on app.guest_booking_enquiries;
create function app.guest_booking_enquiry_change(p_hash text,p_action text,p_data jsonb default null,p_submission text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare existing app.guest_booking_enquiries; saved_expiry timestamptz;begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('save','withdraw','complete') then raise exception 'Invalid enquiry operation';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hash,0));
 select * into existing from app.guest_booking_enquiries where receipt_hash=p_hash;
 if p_action in ('withdraw','complete') then
  if p_action='complete' and existing.id is not null and existing.submission_id is distinct from p_submission then return jsonb_build_object('removed',false);end if;
  delete from app.guest_booking_enquiries where receipt_hash=p_hash;
  insert into app.guest_booking_withdrawals(receipt_hash) values(p_hash) on conflict(receipt_hash) do update set expires_at=excluded.expires_at where guest_booking_withdrawals.expires_at<=now();
  return jsonb_build_object('removed',true);
 end if;
 if exists(select from app.guest_booking_withdrawals where receipt_hash=p_hash and expires_at>now()) then return jsonb_build_object('status','withdrawn');end if;
 if jsonb_typeof(p_data) is distinct from 'object' or p_data->'followup_consent' is distinct from 'true'::jsonb or p_data->>'consent_version' is distinct from 'booking-followup-2026-11-25' then raise exception 'Explicit booking consent required';end if;
 if existing.id is not null then
  if existing.email is distinct from p_data->>'email' or existing.contact_name is distinct from p_data->>'contact_name'
   or existing.submission_id is distinct from p_data->>'submission_id' or existing.postcode_area is distinct from p_data->>'postcode_area'
   or existing.start_date::text is distinct from p_data->>'start_date' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('saved',true,'expiresAt',existing.expires_at);
 end if;
 insert into app.guest_booking_enquiries(receipt_hash,submission_id,email,contact_name,postcode_area,start_date,followup_consent,consent_version)
 values(p_hash,p_data->>'submission_id',p_data->>'email',p_data->>'contact_name',p_data->>'postcode_area',(p_data->>'start_date')::date,true,'booking-followup-2026-11-25') returning expires_at into saved_expiry;
 return jsonb_build_object('saved',true,'expiresAt',saved_expiry);
end $$;
revoke all on function app.guest_booking_enquiry_change(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function app.guest_booking_enquiry_change(text,text,jsonb,text) to service_role;
create or replace function app.purge_expired_guest_enquiries()
returns integer language plpgsql security invoker set search_path=pg_catalog as $$
declare n integer;begin
 delete from app.guest_booking_enquiries where expires_at<=now() or start_date<(now() at time zone 'Europe/London')::date;
 get diagnostics n=row_count;
 delete from app.guest_booking_withdrawals where expires_at<=now();
 delete from app.guest_booking_limits where window_start<now()-interval '1 day';
 return n;
end $$;
