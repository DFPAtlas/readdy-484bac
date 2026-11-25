-- Only the isolated qg-e2e-sandbox. Every temporary enquiry and limiter write rolls back.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$ begin
 if exists(select from cron.job where active) or not exists(select from app.payment_audit_logs where id='b08b2911-9e16-4aa5-b1b9-202611220200' and metadata->>'phase'='closed') then raise exception 'Closed sandbox baseline required';end if;
end $$;
-- Fresh uncommitted synthetic identity; retained closed fixtures are untouched.
-- Auth/profile trigger definitions were inspected: these only write database rows.
do $$ declare fixture uuid:='968b950b-e461-4527-bc78-52b0c6feaa31'; baseline integer;begin
 if exists(select from auth.users where id=fixture or email='sandbox.availability.phase3@example.invalid') then raise exception 'Synthetic identity collision';end if;
 baseline:=app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15);
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(fixture,'sandbox.availability.phase3@example.invalid','{"role":"guard"}','{"full_name":"Synthetic availability fixture"}');
 if not exists(select from app.guards where user_id=fixture) then raise exception 'Synthetic guard trigger failed';end if;
 update app.guards set is_active=true,profile_completed=true,verified_by=fixture,verification_status='approved',sia_verified=true,sia_licence_number='SYNTHETIC-PHASE3',sia_expiry_date='2099-12-31',licence_types=array['Door Supervisor'],availability_status='available',available_days=array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],available_hours_from='08:00',available_hours_to='20:00',min_hourly_rate=15,hourly_rate=15,preferred_venue_categories='{}',home_latitude=51.5,home_longitude=-0.1,willing_to_travel=true,max_distance_miles=20,is_test_account=false where user_id=fixture;
 if app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15)<>baseline+1 then raise exception 'Eligible native guard not counted exactly once';end if;
 update app.guards set is_test_account=true where user_id=fixture;
 if app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15)<>baseline then raise exception 'Synthetic test profile leaked into count';end if;
 update app.guards set is_test_account=false,home_latitude=null where user_id=fixture;
 if app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15)<>baseline then raise exception 'Unknown location counted';end if;
end $$;
set local role anon;
do $$ begin
 begin perform app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15);raise exception 'Anonymous count RPC exposed';exception when insufficient_privilege then null;end;
 begin perform email from app.guest_booking_enquiries;raise exception 'Anonymous contact read exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if exists(select from app.guest_booking_enquiries) then raise exception 'Ordinary account can read contacts';end if;
 begin perform receipt_hash from app.guest_booking_enquiries;raise exception 'Receipt digest exposed';exception when insufficient_privilege then null;end;
 begin perform app.guest_booking_rate_limit(repeat('e',64));raise exception 'Browser limiter RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ declare n integer;begin
 n:=app.guest_booking_match_count(51.5,-0.1,current_date+2,1,'09:00','17:00','Door Supervisor','nightclub_bar',15);
 if n is null or n<0 then raise exception 'Actual aggregate unavailable';end if;
 begin perform app.guest_booking_match_count(51.5,-0.1,current_date-1,1,'09:00','17:00','Door Supervisor','nightclub_bar',15);raise exception 'Past request accepted';exception when raise_exception then if sqlerrm<>'Invalid availability request' then raise;end if;end;
 if exists(select from app.guest_booking_enquiries where receipt_hash=repeat('f',64)) then raise exception 'Synthetic receipt collision';end if;
 insert into app.guest_booking_enquiries(receipt_hash,submission_id,email,contact_name,postcode_area,start_date,followup_consent,consent_version,consent_at,expires_at)
 values(repeat('f',64),'qgb_nativesynthetic000000001','sandbox.enquiry@example.invalid','Synthetic enquiry','SW1A',current_date+2,true,'booking-followup-2026-11-25',now()-interval '2 days',now()-interval '1 day');
 perform app.purge_expired_guest_enquiries();
 if exists(select from app.guest_booking_enquiries where receipt_hash=repeat('f',64)) then raise exception 'Expiry did not remove synthetic enquiry';end if;
end $$;
reset role;
select jsonb_build_object('passed',true,'scope','native positive aggregate and test/unknown exclusions, invalid-date rejection, anonymous/client ACLs, receipt-column denial and synthetic retention; rollback only','active_cron',(select count(*) from cron.job where active),'retention_job_dormant',exists(select from cron.job where jobname='guest-booking-retention' and not active)) receipt;
rollback;
