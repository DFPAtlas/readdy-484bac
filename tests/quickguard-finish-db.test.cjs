const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const U='11111111-1111-4111-8111-111111111111',G='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333';
const C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',GP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',FC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const J='dddddddd-dddd-4ddd-8ddd-dddddddddddd',A='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',ID='ffffffff-ffff-4fff-8fff-ffffffffffff';
test('combined finish migrations enforce confirmed writes, atomic recovery and closure cleanup',async t=>{
 const db=new PGlite();
 try{
  await db.exec(fs.readFileSync('tests/fixtures/quickguard-finish-schema.sql','utf8'));
  const retention=fs.readFileSync('supabase/migrations/20261013051710_account_closure_retention.sql','utf8');
  const retentionStart=retention.indexOf('create function app.finish_account_retention_task(');
  await db.exec(retention.slice(retentionStart,retention.indexOf('end $$;',retentionStart)+7));
  for(const name of ['20261120170000_quickguard_finish_writes.sql','20261120170100_quickguard_team_closure.sql','20261120170200_quickguard_payment_notifications.sql','20261120183707_quickguard_profile_role_compatibility.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const root=async(sql,args=[])=>{await db.exec('reset role');if(args.length)return db.query(sql,args);const results=await db.exec(sql);return results.at(-1)||{rows:[]};};
  const user=async id=>{await root("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('set role authenticated');};
  const call=async(name,body)=>{const r=await db.query(`select app.${name}($1::jsonb) as result`,[JSON.stringify(body)]);return r.rows[0].result;};
  const counts=async()=> (await root('select (select count(*)::int from app.messages) as messages,(select count(*)::int from app.notifications) as notifications,(select count(*)::int from app.reviews) as reviews')).rows[0];
  const seed=async()=>{
   await db.exec('reset role;truncate app.team_closure_snapshots,app.account_closures,app.account_retention_events,app.client_team_operations,app.client_team_state,public.team_member_configs,app.messages,app.notifications,app.notification_preferences,app.reviews,app.ticket_messages,app.support_tickets,app.transactions,app.job_assignments,app.job_invites,app.job_applications,app.jobs,app.admin_users,app.guards,app.clients,app.users,auth.users cascade;');
   for(const [id,kind]of[[U,'client'],[G,'guard'],[F,'client']]){await root('insert into auth.users(id,email) values($1,$2)',[id,kind+'@example.test']);await root('insert into app.users(id,user_type,full_name,email) values($1,$2,$2,$3)',[id,kind,kind+'@example.test']);}
   await root("insert into app.clients(id,user_id,company_name) values($1,$2,'Owner'),($3,$4,'Foreign')",[C,U,FC,F]);
   await root("insert into app.guards(id,user_id,full_name) values($1,$2,'Synthetic guard')",[GP,G]);
   await root("insert into app.jobs(id,client_id,status) values($1,$2,'paid_out')",[J,C]);
   await root("insert into app.job_assignments(id,job_id,guard_id,status,payment_status) values($1,$2,$3,'completed','paid_out')",[A,J,GP]);
  };
  const message=(extra={})=>({operation_id:ID,expected_user_id:U,receiver_id:G,job_id:J,text:'Synthetic message',...extra});
  const ticket=(extra={})=>({operation_id:ID,expected_user_id:U,client_id:C,related_job_id:J,category:'general_support',subject:'Synthetic ticket',description:'Synthetic details',priority:'normal',contact_preference:'email',...extra});
  const review=(extra={})=>({jobId:J,guardId:GP,rating:5,attendanceStatus:'present',issueReported:false,...extra});
  const reviewCall=async(body=review(),actor=U)=>{await db.exec('reset role;set role service_role');return (await db.query('select app.submit_client_review($1,$2::jsonb) as result',[actor,JSON.stringify(body)])).rows[0].result;};
  await t.test('anonymous and authenticated callers cannot use private notification/review functions',async()=>{
   await seed();await user(U);
   await assert.rejects(db.query("select app.emit_user_notification('test',$1,'message','Title','Body')",[G]),/permission denied/);
   await assert.rejects(db.query('select app.submit_client_review($1,$2)',[U,JSON.stringify(review())]),/permission denied/);
   await db.exec('reset role;set role anon');await assert.rejects(call('send_owned_job_message',message()),/permission denied/);
  });
  await t.test('a send atomically writes one owned message and notification and replays the same request',async()=>{
   await seed();await user(U);const first=await call('send_owned_job_message',message());const replay=await call('send_owned_job_message',message());
   assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.equal(first.sender_id,U);assert.deepEqual(await counts(),{messages:1,notifications:1,reviews:0});
   await user(U);await assert.rejects(call('send_owned_job_message',message({text:'Changed retry'})),/retry differs/);
  });
  await t.test('foreign, changed-owner, closed, inactive and unrelated message targets fail without side effects',async()=>{
   for(const failure of ['foreign','identity','closed','inactive','unrelated']){
    await seed();if(failure==='closed')await root("insert into app.account_closures(user_id) values($1)",[U]);
    if(failure==='inactive')await root('update app.guards set is_active=false where id=$1',[GP]);
    if(failure==='unrelated')await root('delete from app.job_assignments');
    await user(failure==='foreign'?F:U);await assert.rejects(call('send_owned_job_message',message({expected_user_id:failure==='identity'?F:failure==='foreign'?F:U})));
    assert.deepEqual(await counts(),{messages:0,notifications:0,reviews:0});
   }
  });
  await t.test('notification failure rolls back the message and a retry produces one message',async()=>{
   await seed();await root("create function app.test_notification_failure() returns trigger language plpgsql as $$begin raise exception 'fixture notification failure';end$$;create trigger fixture_notification_failure before insert on app.notifications for each row execute function app.test_notification_failure();");
   await user(U);await assert.rejects(call('send_owned_job_message',message()),/fixture notification failure/);assert.equal((await counts()).messages,0);
   await root('drop trigger fixture_notification_failure on app.notifications;drop function app.test_notification_failure()');await user(U);await call('send_owned_job_message',message());assert.equal((await counts()).messages,1);
  });
  await t.test('notification preferences suppress the bell while preserving the saved message',async()=>{
   await seed();await root('insert into app.notification_preferences(user_id,messages) values($1,false)',[G]);await user(U);await call('send_owned_job_message',message());assert.deepEqual(await counts(),{messages:1,notifications:0,reviews:0});
  });
  await t.test('message partner lookup returns only minimal existing conversation contacts',async()=>{
   await seed();await user(U);await call('send_owned_job_message',message());await user(U);
   const peers=(await db.query('select app.get_my_message_partners($1) as rows',[[G,F]])).rows[0].rows;
   assert.equal(peers.length,1);assert.equal(peers[0].user_id,G);assert.equal(peers[0].email,undefined);
  });
  await t.test('read/unread acknowledges only received IDs and deletion cannot affect foreign messages',async()=>{
   await seed();await user(U);await call('send_owned_job_message',message());
   assert.deepEqual((await call('change_owned_job_messages',{expected_user_id:U,ids:[ID],action:'read'})).confirmed_ids,[]);
   await user(G);assert.deepEqual((await call('change_owned_job_messages',{expected_user_id:G,ids:[ID],action:'read'})).confirmed_ids,[ID]);
   await user(F);assert.deepEqual((await call('change_owned_job_messages',{expected_user_id:F,ids:[ID],action:'delete'})).confirmed_ids,[]);
   await user(U);assert.deepEqual((await call('change_owned_job_messages',{expected_user_id:U,ids:[ID],action:'delete'})).confirmed_ids,[ID]);
  });
  await t.test('direct client/guard Data API writes are rejected, preserving the confirmed mutation boundary',async()=>{
   await seed();await user(U);await assert.rejects(db.query("insert into app.messages(sender_id,receiver_id,message_text) values($1,$2,'direct')",[U,G]),/row-level security/);
  });
  await t.test('ticket creation confirms a single row, replays unchanged details and rejects a changed retry',async()=>{
   await seed();await user(U);const first=await call('create_client_support_ticket',ticket()),again=await call('create_client_support_ticket',ticket());assert.equal(first.id,ID);assert.equal(again.replayed,true);
   await assert.rejects(call('create_client_support_ticket',ticket({subject:'different'})),/retry differs/);assert.equal((await root('select count(*)::int as n from app.support_tickets')).rows[0].n,1);
  });
  await t.test('missing/foreign jobs, invalid refunds and foreign client contexts cannot create support tickets',async()=>{
   for(const change of [{category:'refund_request',related_job_id:null,requested_refund_amount:10},{category:'refund_request',requested_refund_amount:'NaN'},{category:'refund_request',requested_refund_amount:-5},{client_id:FC},{related_job_id:GP}]){
    await seed();await user(U);await assert.rejects(call('create_client_support_ticket',ticket(change)));assert.equal((await root('select count(*)::int as n from app.support_tickets')).rows[0].n,0);
   }
  });
  await t.test('ticket closure confirms owned IDs only and creates one idempotent central-support notice',async()=>{
   await seed();await user(U);await call('create_client_support_ticket',ticket());
   const request={expected_user_id:U,client_id:C,ids:[ID,GP]};const first=await call('close_client_support_tickets',request),again=await call('close_client_support_tickets',request);
   assert.deepEqual(first.confirmed_ids,[ID]);assert.deepEqual(again.closure_message_ids,first.closure_message_ids);assert.equal((await root('select count(*)::int as n from app.ticket_messages')).rows[0].n,1);
   await user(F);assert.deepEqual((await call('close_client_support_tickets',{expected_user_id:F,client_id:FC,ids:[ID]})).confirmed_ids,[]);
  });
  await t.test('review submission atomically saves a moderated review and the confirmed job state',async()=>{
   await seed();const result=await reviewCall();assert.equal(result.success,true);assert.equal(result.job_status,'closed');assert.equal(result.replayed,false);
   const replay=await reviewCall();assert.equal(replay.replayed,true);assert.equal(replay.review_id,result.review_id);assert.equal((await counts()).reviews,1);
   await assert.rejects(reviewCall(review({rating:4})),/already reviewed/);
  });
  await t.test('a failed job-state write rolls back the new review and a later retry completes once',async()=>{
   await seed();await root("create function app.test_review_failure() returns trigger language plpgsql as $$begin raise exception 'fixture job failure';end$$;create trigger fixture_review_failure before update on app.jobs for each row execute function app.test_review_failure();");
   await assert.rejects(reviewCall(),/fixture job failure/);assert.equal((await counts()).reviews,0);await root('drop trigger fixture_review_failure on app.jobs;drop function app.test_review_failure()');assert.equal((await reviewCall()).success,true);
  });
  await t.test('foreign ownership, unpaid assignments and invalid ratings cannot create reviews',async()=>{
   await seed();await assert.rejects(reviewCall(review(),F));await assert.rejects(reviewCall(review({rating:0})));
   await root("update app.job_assignments set payment_status='funded'");await assert.rejects(reviewCall());assert.equal((await counts()).reviews,0);
  });
  await t.test('financial notifications resolve the client auth ID and atomically notify funded guards once',async()=>{
   await seed();await root("update app.job_assignments set status='confirmed',payment_status='funded'");
   await root("insert into app.transactions(id,client_id,job_id,status,amount) values($1,$2,$3,'pending',80)",[ID,C,J]);
   await root("update app.transactions set status='completed' where id=$1",[ID]);
   const rows=(await root('select user_id,user_type,category from app.notifications order by user_type')).rows;assert.equal(rows.length,2);assert.ok(rows.some(x=>x.user_id===U&&x.user_type==='client'));assert.ok(rows.some(x=>x.user_id===G&&x.category==='booking_confirmed'));assert.ok(rows.every(x=>x.user_id!==C));
   await root('update app.transactions set updated_at=now() where id=$1',[ID]);assert.equal((await counts()).notifications,2);
  });
  await t.test('selection and application bells use authenticated recipients and retry without duplicates',async()=>{
   await seed();await root("update app.job_assignments set status='awaiting_payment'");
   let rows=(await root('select user_id,category from app.notifications')).rows;assert.deepEqual(rows,[{user_id:G,category:'guard_selection'}]);
   await root("update app.job_assignments set status='awaiting_payment'");assert.equal((await counts()).notifications,1);
   await root('insert into app.job_applications(job_id,guard_id) values($1,$2)',[J,GP]);
   rows=(await root("select user_id,category from app.notifications where category='new_applicants'")).rows;assert.deepEqual(rows,[{user_id:U,category:'new_applicants'}]);
   await root("delete from app.notifications;create function app.compensation_fixture_failure() returns trigger language plpgsql as $$begin raise exception 'fixture notification offline';end$$;create trigger fixture_compensation before insert on app.notifications for each row execute function app.compensation_fixture_failure();");
   await root("update app.job_assignments set status='confirmed';update app.job_assignments set status='selected',payment_status='processing'");
   assert.equal((await root('select status from app.job_assignments')).rows[0].status,'selected','payment compensation must remain retryable while notification insertion fails');
   await root('drop trigger fixture_compensation on app.notifications;drop function app.compensation_fixture_failure()');

  });
  await t.test('a silently dropped notification insert fails and rolls the originating message back',async()=>{
   await seed();await root("create function app.drop_fixture_notification() returns trigger language plpgsql as $$begin return null;end$$;create trigger fixture_drop before insert on app.notifications for each row execute function app.drop_fixture_notification();");
   await user(U);await assert.rejects(call('send_owned_job_message',message()),/not confirmed/);assert.equal((await counts()).messages,0);
   await root('drop trigger fixture_drop on app.notifications;drop function app.drop_fixture_notification()');
  });
  await t.test('rating failure and zero-row job updates cannot leave a saved review',async()=>{
   for(const target of ['guards','jobs']){
    await seed();await root(`create function app.drop_fixture_update() returns trigger language plpgsql as $$begin return null;end$$;create trigger fixture_drop before update on app.${target} for each row execute function app.drop_fixture_update();`);
    await assert.rejects(reviewCall(),/not confirmed/);assert.equal((await counts()).reviews,0);
    await root(`drop trigger fixture_drop on app.${target};drop function app.drop_fixture_update()`);
   }
  });
  await t.test('an older partial review is reconciled by its unchanged retry and final reviews close the job once',async()=>{
   await seed();await reviewCall();await root("update app.jobs set status='paid_out'");
   const recovered=await reviewCall();assert.equal(recovered.replayed,true);assert.equal(recovered.job_status,'closed');assert.equal((await counts()).reviews,1);
   await seed();await root("insert into app.guards(id,user_id,full_name) values($1,$2,'Second synthetic guard')",[FC,F]);
   await root("insert into app.job_assignments(id,job_id,guard_id,status,payment_status) values($1,$2,$3,'completed','paid_out')",[ID,J,FC]);
   const results=await Promise.all([reviewCall(),reviewCall(review({guardId:FC}))]);
   assert.equal(results[0].job_status,'review_pending');assert.equal(results[1].job_status,'closed');assert.equal((await counts()).reviews,2);
   assert.equal((await root("select count(*)::int as n from app.reviews where status='published'")).rows[0].n,0);
  });
  await t.test('closing an owner releases the member without disabling the member and keeps a private audit snapshot',async()=>{
   await seed();await root('insert into public.team_member_configs(admin_user_id,member_user_id) values($1,$2)',[U,F]);await root('insert into app.client_team_state values($1,4)',[U]);
   await root("insert into app.account_closures(user_id,status) values($1,'closing')",[U]);
   assert.equal((await root('select count(*)::int as n from public.team_member_configs')).rows[0].n,0);assert.equal((await root('select revision from app.client_team_state where owner_user_id=$1',[U])).rows[0].revision,5);
   assert.equal((await root('select count(*)::int as n from app.team_closure_snapshots')).rows[0].n,1);await root('insert into public.team_member_configs(admin_user_id,member_user_id) values($1,$2)',[G,F]);
   assert.equal((await root('select is_active from app.clients where user_id=$1',[F])).rows[0].is_active,true);await user(F);await assert.rejects(db.query('select * from app.team_closure_snapshots'),/permission denied/);
  });
  await t.test('team retention honors a hold then clears only the closed owner state/receipts at profile purge',async()=>{
   await seed();await root('insert into public.team_member_configs(admin_user_id,member_user_id) values($1,$2)',[U,F]);
   const c=(await root("insert into app.account_closures(user_id,status,legal_hold,leased_stage,lease_token,lease_until) values($1,'closed',true,'profile',$2,now()+interval '1 hour') returning id",[U,ID])).rows[0].id;
   await root('insert into app.client_team_operations(owner_user_id) values($1)',[U]);
   await root("select set_config('request.jwt.claim.role','service_role',false)");
   await assert.rejects(root('select app.finish_account_retention_task($1,$2,null)',[c,ID]),/hold/);
   assert.equal((await root('select count(*)::int as n from app.team_closure_snapshots')).rows[0].n,1);
   await root('update app.account_closures set legal_hold=false where id=$1',[c]);
   await root('select app.finish_account_retention_task($1,$2,null)',[c,ID]);
   assert.equal((await root('select count(*)::int as n from app.team_closure_snapshots')).rows[0].n,0);
   assert.equal((await root('select count(*)::int as n from app.client_team_operations')).rows[0].n,0);
   assert.equal((await root('select count(*)::int as n from app.client_team_state')).rows[0].n,0);
   assert.equal((await root('select profile_purged_at is not null as purged from app.account_closures where id=$1',[c])).rows[0].purged,true);
   assert.equal((await root('select is_active from app.clients where user_id=$1',[F])).rows[0].is_active,true);

  });
 }finally{await db.close();}
});
