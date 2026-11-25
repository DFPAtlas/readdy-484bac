-- Public guests receive only a count through the Edge handler. No guard rows or
-- enquiry tables/RPCs are exposed to anonymous or ordinary authenticated users.
create table app.guest_booking_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null check(hits>0)
);
create table app.guest_booking_enquiries (
  id uuid primary key default gen_random_uuid(),
  receipt_hash text not null unique check(receipt_hash ~ '^[a-f0-9]{64}$'),
  submission_id text not null check(submission_id ~ '^qgb_[a-zA-Z0-9]{10,80}$'),
  email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  contact_name text not null check(length(contact_name) between 1 and 100),
  postcode_area text not null check(length(postcode_area) between 2 and 4),
  start_date date not null,
  followup_consent boolean not null check(followup_consent),
  consent_version text not null check(consent_version='booking-followup-2026-11-25'),
  consent_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  check(expires_at>consent_at and expires_at<=consent_at+interval '30 days')
);
alter table app.guest_booking_limits enable row level security;
alter table app.guest_booking_enquiries enable row level security;
revoke all on app.guest_booking_limits,app.guest_booking_enquiries from public,anon,authenticated;
grant all on app.guest_booking_limits,app.guest_booking_enquiries to service_role;
-- Never grant the receipt digest to a browser, including administrators.
grant select(id,submission_id,email,contact_name,postcode_area,start_date,followup_consent,consent_version,consent_at,expires_at)
 on app.guest_booking_enquiries to authenticated;
create policy guest_enquiries_admin_read on app.guest_booking_enquiries for select to authenticated
 using(app.is_active_admin() and expires_at>now() and start_date>=(now() at time zone 'Europe/London')::date);
grant delete on app.guest_booking_enquiries to authenticated;
create policy guest_enquiries_admin_delete on app.guest_booking_enquiries for delete to authenticated using(app.is_active_admin());
create index guest_enquiries_expiry on app.guest_booking_enquiries(expires_at);

create function app.guest_booking_rate_limit(p_bucket text)
returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
declare k text; n integer; cap integer; minute_start timestamptz:=date_trunc('minute',now());begin
 if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then raise exception 'Invalid limiter key';end if;
 -- Global lock/budget also bounds callers who rotate or spoof forwarding headers.
 foreach k in array array['global',p_bucket] loop
  cap:=case when k='global' then 120 else 12 end;
  insert into app.guest_booking_limits(bucket,window_start,hits) values(k,minute_start,1)
   on conflict(bucket) do update set window_start=excluded.window_start,
    hits=case when guest_booking_limits.window_start=excluded.window_start then guest_booking_limits.hits+1 else 1 end
   returning hits into n;
  if n>cap then return false;end if;
 end loop;
 return true;
end $$;

create function app.guest_booking_match_count(p_lat double precision,p_lng double precision,p_date date,
 p_days integer,p_from time,p_to time,p_licence text,p_venue text,p_rate numeric)
returns integer language plpgsql security invoker set search_path=pg_catalog as $$
declare n integer;begin
 if p_lat is null or p_lng is null or p_lat not between 49 and 61 or p_lng not between -9 and 2
  or p_days is null or p_days not between 1 and 90 or p_date is null or p_date>(now() at time zone 'Europe/London')::date+90
  or p_from is null or p_to is null or p_from=p_to or (p_date+p_from) at time zone 'Europe/London'<=now()
  or p_rate is null or p_rate not between 10 and 1000
  or p_licence is null or p_licence not in ('Door Supervisor','Security Guard','CCTV Operator','Close Protection','Dog Handler','any')
  or p_venue is null or p_venue not in ('nightclub_bar','retail_shop','construction_site','private_event','festival_public_event','warehouse_property','office_building','other') then raise exception 'Invalid availability request';end if;
 if extract(epoch from (p_to-p_from+case when p_to<p_from then interval '24 hours' else interval '0' end))/3600 not between 0.5 and 16 then raise exception 'Invalid shift duration';end if;
 with shifts as (
  select p_date+i as day,p_date+i+p_from as starts,
   p_date+i+p_to+case when p_to<p_from then interval '1 day' else interval '0' end as ends
  from generate_series(0,p_days-1) i
 )
 select count(*)::integer into n from app.guards g
 where g.is_active is true and g.profile_completed is true and g.verified_by is not null
  and g.verification_status in ('approved','verified') and not coalesce(g.is_test_account,false)
  and g.sia_verified is true and nullif(btrim(g.sia_licence_number),'') is not null
  and g.sia_expiry_date>=(select max(ends::date) from shifts)
  and coalesce(lower(g.sia_scraped_status),'') not in ('revoked','suspended','expired','cancelled','invalid')
  and (p_licence='any' and cardinality(g.licence_types)>0 or p_licence=any(g.licence_types))
  and g.availability_status='available' and cardinality(g.available_days)>0
  and g.available_hours_from is not null and g.available_hours_to is not null
  and coalesce(g.min_hourly_rate,g.hourly_rate)>0 and coalesce(g.min_hourly_rate,g.hourly_rate)<=p_rate
  and (cardinality(g.preferred_venue_categories) is null or cardinality(g.preferred_venue_categories)=0 or p_venue=any(g.preferred_venue_categories))
  and g.home_latitude between -90 and 90 and g.home_longitude between -180 and 180 and g.willing_to_travel is true
  and coalesce(nullif(g.max_distance_miles,0),nullif(g.default_search_radius_km,0)*0.621371)>0
  and 3958.8*2*asin(sqrt(least(1.0,greatest(0.0,
   power(sin(radians(g.home_latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(g.home_latitude))*power(sin(radians(g.home_longitude-p_lng)/2),2)))))
    <=coalesce(nullif(g.max_distance_miles,0),nullif(g.default_search_radius_km,0)*0.621371)
  and not exists(select from shifts s where not exists(
   select from generate_series(-1,0) offset_day
   where exists(select from unnest(g.available_days) d where lower(btrim(d))=lower(to_char(s.day+offset_day,'FMDay')))
    and s.starts>=s.day+offset_day+g.available_hours_from
    and s.ends<=s.day+offset_day+g.available_hours_to+case when g.available_hours_to<=g.available_hours_from then interval '1 day' else interval '0' end
  ))
  and not exists(select from app.job_assignments a join app.jobs j on j.id=a.job_id cross join shifts s
   where a.guard_id=g.id and coalesce(a.status,'') not in ('cancelled','canceled','declined','rejected','completed','no_show')
    and not coalesce(j.is_deleted,false) and coalesce(j.status,'') not in ('cancelled','canceled','closed','completed','paid_out','draft')
    and (j.start_date is null or j.start_date<=s.ends::date and coalesce(j.end_date,j.start_date)>=s.starts::date-1)
    and (j.start_date is null or j.start_time is null or j.end_time is null or exists(
     select from generate_series(greatest(j.start_date,s.day-1),least(coalesce(j.end_date,j.start_date),s.day+1),interval '1 day') booked_day
     where tsrange(booked_day::date+j.start_time,booked_day::date+j.end_time+case when j.end_time<=j.start_time then interval '1 day' else interval '0' end,'[)') && tsrange(s.starts,s.ends,'[)')
    )));
 return n;
end $$;

create function app.purge_expired_guest_enquiries()
returns integer language plpgsql security invoker set search_path=pg_catalog as $$
declare n integer;begin
 delete from app.guest_booking_enquiries where expires_at<=now() or start_date<(now() at time zone 'Europe/London')::date;
 get diagnostics n=row_count;
 delete from app.guest_booking_limits where window_start<now()-interval '1 day';
 return n;
end $$;
revoke all on function app.guest_booking_rate_limit(text),app.guest_booking_match_count(double precision,double precision,date,integer,time,time,text,text,numeric),app.purge_expired_guest_enquiries() from public,anon,authenticated;
grant execute on function app.guest_booking_rate_limit(text),app.guest_booking_match_count(double precision,double precision,date,integer,time,time,text,text,numeric),app.purge_expired_guest_enquiries() to service_role;
-- Register dormant until the reviewed production rollout. Sandbox cron stays off.
do $$ declare job bigint;begin
 if to_regclass('cron.job') is not null then
  if not exists(select from cron.job where jobname='guest-booking-retention') then
   job:=cron.schedule('guest-booking-retention','15 * * * *','select app.purge_expired_guest_enquiries()');
   perform cron.alter_job(job,active:=false);
  end if;
 end if;
end $$;
