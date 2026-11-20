create role anon; create role authenticated; create role service_role bypassrls;
create schema app; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('role',coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated'))$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
create table app.users(id uuid primary key,user_type text,email text,full_name text);
create table app.clients(id uuid primary key,user_id uuid,company_name text,contact_name text,email text,is_active boolean default true,is_suspended boolean default false);
create table app.guards(id uuid primary key,user_id uuid,full_name text,email text,is_active boolean default true,profile_image_url text,rating numeric default 0,total_reviews integer default 0,updated_at timestamptz);
create table app.admin_users(id uuid primary key default gen_random_uuid(),user_id uuid,full_name text,is_active boolean,role text);
create function app.is_active_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from app.admin_users where user_id=auth.uid() and is_active)$$;
create table app.jobs(id uuid primary key,client_id uuid,status text,is_deleted boolean default false,job_title text,updated_at timestamptz);
create table app.job_applications(id uuid primary key default gen_random_uuid(),job_id uuid,guard_id uuid);
create table app.job_invites(id uuid primary key default gen_random_uuid(),job_id uuid,guard_id uuid);
create table app.job_assignments(id uuid primary key,job_id uuid,guard_id uuid,status text,payment_status text,unique(job_id,guard_id));
create table app.messages(id uuid primary key default gen_random_uuid(),job_id uuid,sender_id uuid,sender_type text,receiver_id uuid,receiver_type text,message_text text,read boolean default false,created_at timestamptz default now());
alter table app.messages enable row level security;
create policy old_messages_owner on app.messages to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid()) with check(sender_id=auth.uid() or receiver_id=auth.uid());
create table app.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,user_type text not null,type text not null,title text not null,message text not null,link text,category text,priority integer default 5,is_read boolean default false,read boolean default false,data jsonb default '{}',created_at timestamptz default now());
alter table app.notifications enable row level security;
create policy notification_owner on app.notifications to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table app.notification_preferences(user_id uuid primary key,in_app_alerts boolean,messages boolean,payment_notifications boolean,payment_updates boolean,new_applicants boolean,guard_confirmations boolean);
create table app.push_subscriptions(user_id uuid);
create sequence app.ticket_references;
create table app.support_tickets(id uuid primary key default gen_random_uuid(),ticket_reference text default 'QG-'||nextval('app.ticket_references'),client_id uuid,guard_id uuid,related_job_id uuid,category text,subject text,description text,priority text,status text,contact_preference text,evidence_url text,requested_refund_amount numeric,refund_reason text,is_deleted boolean default false,updated_at timestamptz default now(),dfp_sync_status text);
create table app.ticket_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid,sender_id uuid,sender_type text,message_text text,is_internal boolean,created_at timestamptz default now(),dfp_sync_status text);
create table app.reviews(id uuid primary key,job_id uuid,guard_id uuid,client_id uuid,assignment_id uuid unique,rating integer,review_text text,private_note text,punctuality integer,professionalism integer,communication integer,appearance integer,reliability integer,would_hire_again boolean,site_instructions_followed boolean,attendance_status text,issue_reported boolean,issue_category text,issue_description text,status text,review_status text,created_at timestamptz default now());
create table app.transactions(id uuid primary key,client_id uuid,job_id uuid,status text,refund_amount numeric,amount numeric,updated_at timestamptz);
create table app.account_closures(id uuid primary key default gen_random_uuid(),user_id uuid unique,profile_id uuid,profile_type text,lease_token uuid,lease_until timestamptz,legal_hold boolean default false,status text default 'closing',leased_stage text,last_error text,updated_at timestamptz,profile_purged_at timestamptz,documents_purged_at timestamptz,financial_review_required_at timestamptz);
create table app.account_retention_events(closure_id uuid,event_type text,details jsonb);
create table public.team_member_configs(id uuid primary key default gen_random_uuid(),admin_user_id uuid,member_user_id uuid unique,enabled_features jsonb default '[]');
create table app.client_team_state(owner_user_id uuid primary key,revision bigint);
create table app.client_team_operations(id uuid primary key default gen_random_uuid(),owner_user_id uuid,client_id uuid,request_payload jsonb,result jsonb);
create function app.begin_account_closure(p_user_id uuid,p_actor_id uuid) returns jsonb language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  insert into app.account_closures(user_id,status) values(p_user_id,'closing'); return '{}'::jsonb;
end $$;
create function app.confirm_account_closure(p_id uuid) returns void language plpgsql as $$
begin
  update app.account_closures set status='closed' where id=p_id;
end $$;
create function app.manage_my_client_team(p_request jsonb) returns jsonb language plpgsql as $$
begin
  return '{}'::jsonb;
end $$;
grant usage on schema app,auth to anon,authenticated,service_role;
grant all on all tables in schema app to service_role;
grant select,insert,update,delete on app.messages,app.notifications to authenticated;
