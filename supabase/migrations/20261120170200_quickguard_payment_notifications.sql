-- R06: future financial record transitions and their in-app notifications share
-- the same database transaction. Replaying a webhook does not send another bell.
create function app.qg_transaction_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; owner_client uuid; state text:=lower(coalesce(new.status,'')); title text; body text; category text; entry record; event_key text;
begin
  if new.job_id is null then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.refund_amount is not distinct from old.refund_amount then return new; end if;
  if state not in ('completed','paid','failed','refunded','partially_refunded','partial_refund') then return new; end if;
  select c.id,c.user_id into owner_client,recipient from app.jobs j join app.clients c on c.id=j.client_id where j.id=new.job_id;
  if recipient is null then raise exception 'Cannot resolve payment notification owner'; end if;
  if new.client_id is not null and new.client_id<>owner_client then raise exception 'Payment notification client mismatch'; end if;
  category:='payment_alert';
  if state in ('completed','paid') then title:='Payment Received — Job Funded'; body:='Your recorded job payment has been funded.';
  elsif state='failed' then title:='Payment Failed'; body:='Your recorded job payment failed. Please retry or contact support.';
  else title:='Payment Refunded'; body:='Your recorded job payment refund has been updated.'; category:='refund_request'; end if;
  event_key:='transaction:'||new.id::text||':'||state||':'||coalesce(new.refund_amount,0)::text;
  perform app.emit_user_notification(event_key,recipient,'payment',title,body,'/client/payment-centre',category,1,jsonb_build_object('job_id',new.job_id,'transaction_id',new.id));
  if state in ('completed','paid') then
    for entry in select a.id,g.user_id from app.job_assignments a join app.guards g on g.id=a.guard_id
      where a.job_id=new.job_id and a.payment_status='funded' loop
      perform app.emit_user_notification('funded-assignment:'||entry.id::text,entry.user_id,'booking_confirmed','Booking Funded',
        'Your booking has been funded. Payout becomes eligible after completion and client approval.','/guard/dashboard','booking_confirmed',1,jsonb_build_object('job_id',new.job_id));
    end loop;
  end if;
  return new;
end $$;
revoke all on function app.qg_transaction_notifications() from public,anon,authenticated;
create trigger qg_transaction_notifications after insert or update on app.transactions
for each row execute function app.qg_transaction_notifications();

-- Selection/application callers cannot insert another user's bell through RLS.
-- Generate those bells from the committed, server-authorized relationship instead.
create function app.qg_job_contact_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; jid uuid:=new.job_id;
begin
  if tg_table_name='job_assignments' then
    if new.status not in ('selected','awaiting_payment') then return new; end if;
    -- A rollback from confirmed to legacy selected is payment compensation, not a new selection.
    if tg_op='UPDATE' and (old.status is not distinct from new.status or new.status='selected') then return new; end if;
    select user_id into recipient from app.guards where id=new.guard_id;
    if recipient is null then raise exception 'Selection notification recipient unavailable'; end if;
    perform app.emit_user_notification('selected-assignment:'||new.id::text,recipient,'job_selected',
      'You have been selected','You have been provisionally selected for a job. Booking confirms after client payment.',
      '/guard/dashboard','guard_selection',1,jsonb_build_object('job_id',jid));
  else
    select c.user_id into recipient from app.jobs j join app.clients c on c.id=j.client_id where j.id=jid;
    if recipient is null then raise exception 'Application notification recipient unavailable'; end if;
    perform app.emit_user_notification('job-application:'||new.id::text,recipient,'job_application',
      'New Application Received','A guard applied for your job.',
      '/client/jobs/applicants?id='||jid::text,'new_applicants',1,jsonb_build_object('job_id',jid));
  end if;
  return new;
end $$;
revoke all on function app.qg_job_contact_notifications() from public,anon,authenticated;
create trigger qg_selection_notification after insert or update of status on app.job_assignments
for each row execute function app.qg_job_contact_notifications();
create trigger qg_application_notification after insert on app.job_applications
for each row execute function app.qg_job_contact_notifications();
