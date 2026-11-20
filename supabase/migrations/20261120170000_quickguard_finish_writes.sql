-- QG-R02/R04/R05/R06/R07: confirmed, retry-safe user actions.
-- No real messages, tickets, reviews or payment operations are created by installation.
create function app.qg_active_message_role(p_user uuid) returns text
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  if p_user is null or not exists(select 1 from auth.users where id=p_user and deleted_at is null and (banned_until is null or banned_until<=now()))
     or exists(select 1 from app.account_closures where user_id=p_user) then return null; end if;
  if exists(select 1 from app.admin_users where user_id=p_user and is_active) then return 'admin'; end if;
  select user_type into kind from app.users where id=p_user;
  if kind='client' and exists(select 1 from app.clients where user_id=p_user and is_active is distinct from false and is_suspended is distinct from true) then return kind; end if;
  if kind='guard' and exists(select 1 from app.guards where user_id=p_user and is_active is distinct from false) then return kind; end if;
  return null;
end $$;
revoke all on function app.qg_active_message_role(uuid) from public,anon,authenticated;

create function app.qg_notification_category(p_category text,p_type text,p_title text default '') returns text
language sql immutable set search_path='' as $$
  select case
    when nullif(btrim(p_category),'') is null and p_type='job_application' then 'new_applicants'
    when nullif(btrim(p_category),'') is null and p_type='job_selected' then 'guard_selection'
    when nullif(btrim(p_category),'') is null and p_type='job_invite' then 'job_update'
    when nullif(btrim(p_category),'') in ('job_update','new_applicants','guard_selection','guard_confirmation','payment_alert','message','support_ticket','account_billing','general','payment','guard_assigned','complaint','replacement_request','subscription','job_cancelled','refund_request','booking_confirmed','booking_disputed') then btrim(p_category)
    when p_type in ('job_update','new_applicants','guard_selection','guard_confirmation','payment_alert','message','support_ticket','account_billing','general','payment','guard_assigned','complaint','replacement_request','subscription','job_cancelled','refund_request','booking_confirmed','booking_disputed') then p_type
    when lower(coalesce(p_title,'')) like '%subscription%' then 'subscription'
    when lower(coalesce(p_title,'')) like '%refund%' then 'refund_request'
    when lower(coalesce(p_title,'')) like '%payment%' then 'payment_alert'
    else 'general' end
$$;
create function app.qg_normalize_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.category:=app.qg_notification_category(new.category,new.type,new.title);
  if new.priority is null or new.priority not between 0 and 3 then new.priority:=1; end if;
  return new;
end $$;
create trigger qg_normalize_notification before insert or update of category,type,title,priority on app.notifications
for each row execute function app.qg_normalize_notification();
update app.notifications set category=app.qg_notification_category(category,type,title),
  priority=case when priority between 0 and 3 then priority else 1 end
where category is distinct from app.qg_notification_category(category,type,title) or priority is null or priority not between 0 and 3;
revoke all on function app.qg_notification_category(text,text,text),app.qg_normalize_notification() from public,anon,authenticated;

-- Service writers resolve profile IDs before calling this function. Authenticated
-- callers cannot create a cross-user notification through the Data API.
create function app.emit_user_notification(p_event_key text,p_user_id uuid,p_type text,p_title text,p_message text,
  p_link text default null,p_category text default null,p_priority integer default 1,p_data jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare kind text; nid uuid; inserted uuid; existing app.notifications%rowtype; prefs app.notification_preferences%rowtype; category text;
begin
  if p_event_key is null or length(p_event_key) not between 1 and 300 or p_user_id is null
     or nullif(btrim(p_type),'') is null or nullif(btrim(p_title),'') is null or nullif(btrim(p_message),'') is null
     or length(p_title)>500 or length(p_message)>10000 or (p_link is not null and (left(p_link,1)<>'/' or left(p_link,2)='//')) then
    raise exception using errcode='22023',message='Invalid notification';
  end if;
  -- Closed/inactive recipients are a terminal suppression, not a retry storm.
  kind:=app.qg_active_message_role(p_user_id);
  if kind is null then return null; end if;
  category:=app.qg_notification_category(p_category,p_type,p_title);
  select * into prefs from app.notification_preferences where user_id=p_user_id;
  if prefs.in_app_alerts is false or (category='message' and prefs.messages is false)
    or (category='new_applicants' and prefs.new_applicants is false)
    or (category in ('guard_selection','guard_confirmation','booking_confirmed') and prefs.guard_confirmations is false)
    or (category in ('payment','payment_alert','refund_request') and (prefs.payment_notifications is false or prefs.payment_updates is false)) then return null; end if;
  nid:=md5('quickguard-notification:'||p_event_key)::uuid;
  perform pg_advisory_xact_lock(hashtextextended(nid::text,0));
  select * into existing from app.notifications where id=nid;
  if found then
    if existing.user_id is distinct from p_user_id or existing.user_type is distinct from kind or existing.type is distinct from p_type then
      raise exception using errcode='23505',message='Notification event belongs to another recipient';
    end if;
    return nid;
  end if;
  insert into app.notifications(id,user_id,user_type,type,title,message,link,category,priority,is_read,read,data)
    values(nid,p_user_id,kind,p_type,p_title,p_message,p_link,app.qg_notification_category(p_category,p_type,p_title),p_priority,false,false,coalesce(p_data,'{}'::jsonb)) returning id into inserted;
  if inserted is distinct from nid or not exists(select 1 from app.notifications where id=nid and user_id=p_user_id and user_type=kind) then raise exception 'Notification insert was not confirmed'; end if;
  return nid;
end $$;
revoke all on function app.emit_user_notification(text,uuid,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function app.emit_user_notification(text,uuid,text,text,text,text,text,integer,jsonb) to service_role;

create function app.send_owned_job_message(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); receiver uuid; v_job_id uuid; operation uuid; kind text; peer_kind text;
  client_user uuid; guard_user uuid; client_id uuid; v_guard_id uuid; body text; prior app.messages%rowtype; saved app.messages%rowtype;
begin
  receiver:=(p_request->>'receiver_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(x::text,0)) from (select distinct unnest(array[actor,receiver]) x order by x) ordered where x is not null;
  kind:=app.qg_active_message_role(actor);
  receiver:=(p_request->>'receiver_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  v_job_id:=nullif(p_request->>'job_id','')::uuid; body:=btrim(p_request->>'text');
  if actor is null or actor is distinct from (p_request->>'expected_user_id')::uuid or kind is null then raise insufficient_privilege; end if;
  peer_kind:=app.qg_active_message_role(receiver);
  if operation is null or receiver=actor or peer_kind is null or body is null or length(body) not between 1 and 1000 then
    raise exception using errcode='22023',message='Invalid message or recipient';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(operation::text,0));
  select * into prior from app.messages where id=operation;
  if found then
    if prior.sender_id is distinct from actor or prior.receiver_id is distinct from receiver or prior.job_id is distinct from v_job_id or prior.message_text is distinct from body then
      raise exception using errcode='23505',message='Message retry differs from the original request';
    end if;
    return jsonb_build_object('id',prior.id,'sender_id',actor,'receiver_id',receiver,'job_id',v_job_id,'message_text',body,'replayed',true);
  end if;
  if v_job_id is not null then
    select c.id,c.user_id into client_id,client_user from app.jobs j join app.clients c on c.id=j.client_id where j.id=v_job_id and j.is_deleted is distinct from true for share of j;
    guard_user:=case when kind='guard' then actor when peer_kind='guard' then receiver end;
    select id into v_guard_id from app.guards where user_id=guard_user;
    if client_user is null or v_guard_id is null or not ((actor=client_user and receiver=guard_user) or (receiver=client_user and actor=guard_user))
       or not (exists(select 1 from app.job_applications a where a.job_id=v_job_id and a.guard_id=v_guard_id)
         or exists(select 1 from app.job_assignments a where a.job_id=v_job_id and a.guard_id=v_guard_id)
         or exists(select 1 from app.job_invites a where a.job_id=v_job_id and a.guard_id=v_guard_id)) then
      raise exception using errcode='42501',message='You can only message an assigned, applying or invited job contact';
    end if;
  elsif kind<>'admin' and peer_kind<>'admin' and not exists(select 1 from app.messages m where m.job_id is null and
    ((m.sender_id=actor and m.receiver_id=receiver) or (m.sender_id=receiver and m.receiver_id=actor))) then
    raise exception using errcode='42501',message='This conversation is not available';
  end if;
  insert into app.messages(id,job_id,sender_id,sender_type,receiver_id,receiver_type,message_text,read)
    values(operation,v_job_id,actor,kind,receiver,peer_kind,body,false) returning * into saved;
  if saved.id is distinct from operation or saved.sender_id is distinct from actor or saved.receiver_id is distinct from receiver or saved.job_id is distinct from v_job_id or saved.message_text is distinct from body then raise exception 'Message save was not confirmed'; end if;
  perform app.emit_user_notification('message:'||operation::text,receiver,'message','New message','You have a new QuickGuard message.',
    case peer_kind when 'guard' then '/guard/messages' when 'client' then '/client/messages' else '/admin/messages' end,'message',1);
  return jsonb_build_object('id',saved.id,'sender_id',actor,'receiver_id',receiver,'job_id',v_job_id,'message_text',body,'replayed',false);
end $$;
revoke all on function app.send_owned_job_message(jsonb) from public,anon;
grant execute on function app.send_owned_job_message(jsonb) to authenticated;

create function app.change_owned_job_messages(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ids uuid[]; action text:=p_request->>'action'; confirmed uuid[];
begin
  if actor is null or actor is distinct from (p_request->>'expected_user_id')::uuid or app.qg_active_message_role(actor) is null then raise insufficient_privilege; end if;
  if action is null or action not in ('read','unread','delete') or jsonb_typeof(p_request->'ids') is distinct from 'array' or jsonb_array_length(p_request->'ids') not between 1 and 200 then raise exception 'Invalid message selection'; end if;
  select array_agg(distinct value::uuid) into ids from jsonb_array_elements_text(p_request->'ids');
  if action='delete' then
    with changed as (delete from app.messages where id=any(ids) and (sender_id=actor or receiver_id=actor) returning id)
      select coalesce(array_agg(id),'{}'::uuid[]) into confirmed from changed;
  else
    with changed as (update app.messages set read=(action='read') where id=any(ids) and receiver_id=actor returning id)
      select coalesce(array_agg(id),'{}'::uuid[]) into confirmed from changed;
  end if;
  return jsonb_build_object('confirmed_ids',confirmed);
end $$;
revoke all on function app.change_owned_job_messages(jsonb) from public,anon;
grant execute on function app.change_owned_job_messages(jsonb) to authenticated;

create function app.get_my_message_partners(p_user_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if app.qg_active_message_role(actor) is null or coalesce(cardinality(p_user_ids),0)>200 then raise insufficient_privilege; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'full_name',
    coalesce(nullif(g.full_name,''),nullif(c.company_name,''),nullif(c.contact_name,''),nullif(a.full_name,''),nullif(u.full_name,''),'Contact unavailable'),
    'profile_image_url',g.profile_image_url,'rating',g.rating,'user_type',case when a.is_active then 'admin' else u.user_type end)),'[]'::jsonb)
    into result from app.users u left join app.guards g on g.user_id=u.id left join app.clients c on c.user_id=u.id left join app.admin_users a on a.user_id=u.id
    where u.id=any(p_user_ids) and exists(select 1 from app.messages m where
      (m.sender_id=actor and m.receiver_id=u.id) or (m.receiver_id=actor and m.sender_id=u.id));
  return result;
end $$;
revoke all on function app.get_my_message_partners(uuid[]) from public,anon;
grant execute on function app.get_my_message_partners(uuid[]) to authenticated;
-- Browser client/guard writes use the atomic operations above. Keep existing
-- administrative messaging and service workers available.
create policy qg_messages_confirmed_insert on app.messages as restrictive for insert to authenticated with check(app.is_active_admin());
create policy qg_messages_confirmed_update on app.messages as restrictive for update to authenticated using(app.is_active_admin()) with check(app.is_active_admin());
create policy qg_messages_confirmed_delete on app.messages as restrictive for delete to authenticated using(app.is_active_admin());

create function app.create_client_support_ticket(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cid uuid; tid uuid; jid uuid; category text; subject text; description text;
  priority text; contact text; evidence text; amount numeric; reason text; prior app.support_tickets%rowtype; saved app.support_tickets%rowtype;
begin
  if actor is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select id into cid from app.clients where user_id=actor;
  if app.qg_active_message_role(actor) is distinct from 'client' or actor is distinct from (p_request->>'expected_user_id')::uuid
     or cid is distinct from (p_request->>'client_id')::uuid then raise insufficient_privilege; end if;
  tid:=(p_request->>'operation_id')::uuid; jid:=nullif(p_request->>'related_job_id','')::uuid;
  category:=p_request->>'category'; subject:=btrim(p_request->>'subject'); description:=btrim(p_request->>'description');
  priority:=p_request->>'priority'; contact:=p_request->>'contact_preference'; evidence:=nullif(btrim(p_request->>'evidence_url'),''); reason:=nullif(btrim(p_request->>'refund_reason'),'');
  if tid is null or category not in ('general_support','payment_issue','guard_no_show','late_arrival','poor_performance','refund_request','job_cancellation','technical_issue','account_billing')
     or subject is null or length(subject) not between 1 and 200 or description is null or length(description) not between 1 and 10000
     or category is null or priority is null or contact is null or priority not in ('low','normal','high','urgent') or contact not in ('email','phone') then raise exception using errcode='22023',message='Review the ticket details'; end if;
  if category in ('guard_no_show','late_arrival','poor_performance','refund_request','job_cancellation') and jid is null then raise exception 'Select a related job'; end if;
  if jid is not null and not exists(select 1 from app.jobs where id=jid and client_id=cid and is_deleted is distinct from true) then raise insufficient_privilege; end if;
  if evidence is not null and (length(evidence)>2000 or evidence !~ '^https://[^[:space:]]+$') then raise exception 'Use an HTTPS evidence link'; end if;
  if category='refund_request' then
    if coalesce(p_request->>'requested_refund_amount','') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' then raise exception 'Enter a valid refund amount'; end if;
    amount:=(p_request->>'requested_refund_amount')::numeric;
    if amount<=0 then raise exception 'Enter a positive refund amount'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(tid::text,0));
  select * into prior from app.support_tickets where id=tid;
  if found then
    if prior.client_id is distinct from cid or prior.related_job_id is distinct from jid or prior.category is distinct from category
      or prior.subject is distinct from subject or prior.description is distinct from description or prior.priority is distinct from priority
      or prior.contact_preference is distinct from contact or prior.evidence_url is distinct from evidence or prior.requested_refund_amount is distinct from amount
      or prior.refund_reason is distinct from reason then raise exception 'Ticket retry differs from the original request'; end if;
    return jsonb_build_object('id',prior.id,'client_id',cid,'ticket_reference',prior.ticket_reference,'replayed',true);
  end if;
  insert into app.support_tickets(id,client_id,related_job_id,category,subject,description,priority,status,contact_preference,evidence_url,requested_refund_amount,refund_reason)
    values(tid,cid,jid,category,subject,description,priority,'open',contact,evidence,amount,reason) returning * into saved;
  if saved.id is distinct from tid or saved.client_id is distinct from cid then raise exception 'Ticket save was not confirmed'; end if;
  return jsonb_build_object('id',saved.id,'client_id',cid,'ticket_reference',saved.ticket_reference,'replayed',false);
end $$;
revoke all on function app.create_client_support_ticket(jsonb) from public,anon;
grant execute on function app.create_client_support_ticket(jsonb) to authenticated;

create function app.close_client_support_tickets(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cid uuid; ids uuid[]; confirmed uuid[];
begin
  if actor is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select id into cid from app.clients where user_id=actor;
  if app.qg_active_message_role(actor) is distinct from 'client' or actor is distinct from (p_request->>'expected_user_id')::uuid
    or cid is distinct from (p_request->>'client_id')::uuid then raise insufficient_privilege; end if;
  if jsonb_typeof(p_request->'ids') is distinct from 'array' or jsonb_array_length(p_request->'ids') not between 1 and 200 then raise exception 'Invalid ticket selection'; end if;
  select array_agg(distinct value::uuid) into ids from jsonb_array_elements_text(p_request->'ids');
  perform 1 from app.support_tickets where id=any(ids) and client_id=cid order by id for update;
  update app.support_tickets set status='closed',updated_at=now() where id=any(ids) and client_id=cid and is_deleted is distinct from true and status not in ('resolved','closed');
  insert into app.ticket_messages(id,ticket_id,sender_id,sender_type,message_text,is_internal)
    select md5('quickguard-ticket-close:'||id::text)::uuid,id,cid,'client','The client closed this request in QuickGuard. Please review the closure in central support.',false
    from app.support_tickets where id=any(ids) and client_id=cid and is_deleted is distinct from true and status='closed' on conflict(id) do nothing;
  if exists(select 1 from app.support_tickets t where t.id=any(ids) and t.client_id=cid and t.is_deleted is distinct from true and t.status='closed'
    and not exists(select 1 from app.ticket_messages m where m.id=md5('quickguard-ticket-close:'||t.id::text)::uuid
      and m.ticket_id=t.id and m.sender_id=cid and m.sender_type='client'
      and m.message_text='The client closed this request in QuickGuard. Please review the closure in central support.')) then
    raise exception 'Closure notice save was not confirmed';
  end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into confirmed from app.support_tickets where id=any(ids) and client_id=cid and is_deleted is distinct from true and status='closed';
  return jsonb_build_object('confirmed_ids',confirmed,'closure_message_ids',(select coalesce(jsonb_agg(md5('quickguard-ticket-close:'||x::text)::uuid),'[]'::jsonb) from unnest(confirmed) x));
end $$;
revoke all on function app.close_client_support_tickets(jsonb) from public,anon;
grant execute on function app.close_client_support_tickets(jsonb) to authenticated;

-- Service-only entry point: create-review authenticates the bearer token first.
create function app.submit_client_review(p_actor uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid; jid uuid:=(p_request->>'jobId')::uuid; gid uuid:=(p_request->>'guardId')::uuid;
  j app.jobs%rowtype; a app.job_assignments%rowtype; prior app.reviews%rowtype; desired jsonb; rid uuid; rating integer; next_status text; replayed boolean:=false; count_changed integer;
begin
  if p_actor is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  if app.qg_active_message_role(p_actor) is distinct from 'client' then raise insufficient_privilege; end if;
  select id into cid from app.clients where user_id=p_actor;
  rating:=(p_request->>'rating')::integer;
  if rating is null or rating not between 1 and 5 or (p_request->>'rating') !~ '^[1-5]$' then raise exception using errcode='22023',message='Invalid rating'; end if;
  select * into j from app.jobs where id=jid and client_id=cid and is_deleted is distinct from true for update;
  if not found or j.status not in ('paid_out','review_pending','closed') then raise insufficient_privilege; end if;
  select * into a from app.job_assignments where job_id=jid and guard_id=gid for update;
  if not found or a.status<>'completed' or a.payment_status<>'paid_out' then raise insufficient_privilege; end if;
  desired:=jsonb_build_object('rating',rating,'review_text',nullif(btrim(p_request->>'reviewText'),''),'private_note',nullif(btrim(p_request->>'privateNote'),''),
    'punctuality',(p_request->>'punctuality')::integer,'professionalism',(p_request->>'professionalism')::integer,'communication',(p_request->>'communication')::integer,
    'appearance',(p_request->>'appearance')::integer,'reliability',(p_request->>'reliability')::integer,'would_hire_again',(p_request->>'wouldHireAgain')::boolean,
    'site_instructions_followed',(p_request->>'siteInstructionsFollowed')::boolean,'attendance_status',coalesce(p_request->>'attendanceStatus','present'),
    'issue_reported',coalesce((p_request->>'issueReported')::boolean,false),'issue_category',case when (p_request->>'issueReported')::boolean then nullif(btrim(p_request->>'issueCategory'),'') end,
    'issue_description',case when (p_request->>'issueReported')::boolean then nullif(btrim(p_request->>'issueDescription'),'') end);
  if length(coalesce(desired->>'review_text',''))>500 or length(coalesce(desired->>'private_note',''))>500 or length(coalesce(desired->>'issue_description',''))>500
    or length(coalesce(desired->>'issue_category',''))>100 or desired->>'attendance_status' not in ('present','late','no_show')
    or ((desired->>'issue_reported')::boolean and nullif(desired->>'issue_category','') is null)
    or exists(select 1 from jsonb_each(desired) e where e.key in ('punctuality','professionalism','communication','appearance','reliability') and e.value<>'null'::jsonb and (e.value::text !~ '^[1-5]$')) then raise exception 'Invalid review details'; end if;
  select * into prior from app.reviews where assignment_id=a.id;
  if found then
    if prior.client_id<>cid or (to_jsonb(prior)->'rating') is distinct from desired->'rating'
      or exists(select 1 from jsonb_each(desired) e where to_jsonb(prior)->e.key is distinct from e.value) then raise exception using errcode='23505',message='You have already reviewed this guard'; end if;
    rid:=prior.id; replayed:=true;
  else
    if j.status='closed' then raise insufficient_privilege; end if;
    rid:=coalesce(nullif(p_request->>'operationId','')::uuid,md5('review:'||a.id::text)::uuid);
    insert into app.reviews(id,job_id,guard_id,client_id,assignment_id,rating,review_text,private_note,punctuality,professionalism,communication,appearance,reliability,would_hire_again,site_instructions_followed,attendance_status,issue_reported,issue_category,issue_description,status,review_status)
      select rid,jid,gid,cid,a.id,r.rating,r.review_text,r.private_note,r.punctuality,r.professionalism,r.communication,r.appearance,r.reliability,r.would_hire_again,r.site_instructions_followed,r.attendance_status,r.issue_reported,r.issue_category,r.issue_description,'hidden',case when r.issue_reported then 'issue_reported' else 'reviewed' end
      from jsonb_populate_record(null::app.reviews,desired) r;
    get diagnostics count_changed=row_count; if count_changed<>1 then raise exception 'Review insert was not confirmed'; end if;
  end if;
  perform 1 from app.guards where id=gid for update;
  update app.guards set rating=coalesce((select round(avg(r.rating)::numeric,1) from app.reviews r where r.guard_id=gid and r.status='published'),0),
    total_reviews=(select count(*) from app.reviews r where r.guard_id=gid and r.status='published'),updated_at=now() where id=gid;
  get diagnostics count_changed=row_count; if count_changed<>1 then raise exception 'Guard rating update was not confirmed'; end if;
  next_status:=case when not exists(select 1 from app.job_assignments x where x.job_id=jid and x.status='completed' and x.payment_status='paid_out'
    and not exists(select 1 from app.reviews r where r.assignment_id=x.id)) then 'closed' else 'review_pending' end;
  update app.jobs set status=next_status,updated_at=now() where id=jid and client_id=cid;
  get diagnostics count_changed=row_count; if count_changed<>1 or not exists(select 1 from app.jobs where id=jid and client_id=cid and status=next_status) then raise exception 'Job review state was not confirmed'; end if;
  return jsonb_build_object('success',true,'review_id',rid,'job_status',next_status,'replayed',replayed,'message','Review submitted for moderation');
end $$;
revoke all on function app.submit_client_review(uuid,jsonb) from public,anon,authenticated;
grant execute on function app.submit_client_review(uuid,jsonb) to service_role;
