const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const U='11111111-1111-4111-8111-111111111111',G='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333';
const C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',GP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',FC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const J='dddddddd-dddd-4ddd-8ddd-dddddddddddd',A='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',ID='ffffffff-ffff-4fff-8fff-ffffffffffff';
const migration='supabase/migrations/20261120183707_quickguard_profile_role_compatibility.sql';
test('profile-only accounts retain confirmed writes without a legacy app.users mirror',async t=>{
 const db=new PGlite();
 try{
  await db.exec(fs.readFileSync('tests/fixtures/quickguard-finish-schema.sql','utf8'));
  await db.exec("alter table auth.users add column raw_user_meta_data jsonb default '{}';alter table app.messages add foreign key(sender_id) references auth.users(id);alter table app.messages add foreign key(receiver_id) references auth.users(id);alter table app.notifications add foreign key(user_id) references auth.users(id);");
  const retention=fs.readFileSync('supabase/migrations/20261013051710_account_closure_retention.sql','utf8'),start=retention.indexOf('create function app.finish_account_retention_task(');
  await db.exec(retention.slice(start,retention.indexOf('end $$;',start)+7));
  for(const file of ['20261120170000_quickguard_finish_writes.sql','20261120170100_quickguard_team_closure.sql','20261120170200_quickguard_payment_notifications.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  const root=async(sql,args=[])=>{await db.exec('reset role');if(args.length)return db.query(sql,args);return (await db.exec(sql)).at(-1)||{rows:[]};};
  const user=async id=>{await root("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('set role authenticated');};
  const rpc=async(name,body)=> (await db.query(`select app.${name}($1::jsonb) result`,[JSON.stringify(body)])).rows[0].result;
  const role=async id=>(await root('select app.qg_active_message_role($1) kind',[id])).rows[0].kind;
  const seed=async()=>{
   await db.exec('reset role;truncate app.team_closure_snapshots,app.account_closures,app.account_retention_events,app.client_team_operations,app.client_team_state,public.team_member_configs,app.messages,app.notifications,app.notification_preferences,app.reviews,app.ticket_messages,app.support_tickets,app.transactions,app.job_assignments,app.job_invites,app.job_applications,app.jobs,app.admin_users,app.guards,app.clients,app.users,auth.users cascade;');
   for(const id of [U,G,F])await root('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
   await root("insert into app.clients(id,user_id,company_name) values($1,$2,'Synthetic owner'),($3,$4,'Foreign owner')",[C,U,FC,F]);
   await root("insert into app.guards(id,user_id,full_name,email) values($1,$2,'Synthetic guard','private@example.test')",[GP,G]);
   await root("insert into app.jobs(id,client_id,status) values($1,$2,'paid_out')",[J,C]);
   await root("insert into app.job_assignments(id,job_id,guard_id,status,payment_status) values($1,$2,$3,'completed','paid_out')",[A,J,GP]);
  };
  const message=(extra={})=>({operation_id:ID,expected_user_id:U,receiver_id:G,job_id:J,text:'Synthetic compatibility message',...extra});
  const review={jobId:J,guardId:GP,rating:5,attendanceStatus:'present',issueReported:false};
  const submit=async()=>{await db.exec('reset role;set role service_role');return (await db.query('select app.submit_client_review($1,$2::jsonb) result',[U,JSON.stringify(review)])).rows[0].result;};
  const ticket={operation_id:ID,expected_user_id:U,client_id:C,related_job_id:J,category:'general_support',subject:'Synthetic compatibility request',description:'Test details',priority:'normal',contact_preference:'email'};
  await t.test('the deployed baseline reproduces the live 403 with an active Auth identity and client profile',async()=>{
   await seed();assert.equal(await role(U),null);await assert.rejects(submit(),error=>error.code==='42501');
   assert.equal((await root('select count(*)::int n from app.reviews')).rows[0].n,0);
  });
  await db.exec('reset role');await db.exec(fs.readFileSync(migration,'utf8'));
  await t.test('a profile-only client saves one moderated review, closes its job and recovers an unchanged retry',async()=>{
   await seed();assert.equal(await role(U),'client');assert.equal(await role(G),'guard');
   const first=await submit(),again=await submit();assert.equal(first.success,true);assert.equal(first.job_status,'closed');assert.equal(again.replayed,true);assert.equal(again.review_id,first.review_id);
   const result=(await root("select (select count(*)::int from app.reviews) n,(select status from app.reviews limit 1) status,(select count(*)::int from app.users) mirrors")).rows[0];
   assert.deepEqual(result,{n:1,status:'hidden',mirrors:0});
  });
  await t.test('profile-only client and guard messages atomically notify the correct Auth recipients',async()=>{
   await seed();await user(U);const first=await rpc('send_owned_job_message',message());assert.equal(first.replayed,false);assert.equal((await rpc('send_owned_job_message',message())).replayed,true);
   await user(G);await rpc('send_owned_job_message',message({operation_id:A,expected_user_id:G,receiver_id:U,text:'Synthetic reply'}));
   const rows=(await root('select user_id,user_type from app.notifications order by user_type')).rows;assert.deepEqual(rows,[{user_id:U,user_type:'client'},{user_id:G,user_type:'guard'}]);
   assert.equal((await root('select count(*)::int n from app.users')).rows[0].n,0);
  });
  await t.test('conversation contact lookup keeps minimal names for profile-only peers and cannot enumerate other accounts',async()=>{
   await seed();await user(U);await rpc('send_owned_job_message',message());await user(G);
   const lookup=async ids=>(await db.query('select app.get_my_message_partners($1) result',[ids])).rows[0].result;
   const client=await lookup([U,U,F]);assert.equal(client.length,1);assert.equal(client[0].full_name,'Synthetic owner');assert.equal(client[0].user_type,'client');assert.equal(client[0].email,undefined);
   await user(U);const guard=await lookup([G]);assert.equal(guard[0].full_name,'Synthetic guard');assert.equal(guard[0].user_type,'guard');assert.equal(guard[0].email,undefined);
   await user(F);assert.deepEqual(await lookup([U,G]),[]);
  });
  await t.test('a profile-only client creates and closes one owned support ticket with replayable receipts',async()=>{
   await seed();await user(U);await rpc('create_client_support_ticket',ticket);assert.equal((await rpc('create_client_support_ticket',ticket)).replayed,true);
   const closed=await rpc('close_client_support_tickets',{expected_user_id:U,client_id:C,ids:[ID,GP]});assert.deepEqual(closed.confirmed_ids,[ID]);assert.equal(closed.closure_message_ids.length,1);
   await user(F);assert.deepEqual((await rpc('close_client_support_tickets',{expected_user_id:F,client_id:FC,ids:[ID]})).confirmed_ids,[]);
  });
  await t.test('a transaction transition no longer silently suppresses a valid profile-only client bell',async()=>{
   await seed();await root("insert into app.transactions(id,client_id,job_id,status,amount) values($1,$2,$3,'pending',80)",[ID,C,J]);await root("update app.transactions set status='completed' where id=$1",[ID]);
   assert.deepEqual((await root('select user_id,user_type,category from app.notifications')).rows,[{user_id:U,user_type:'client',category:'payment_alert'}]);
  });
  await t.test('bans, deletions, closures, suspended/inactive and ambiguous profiles remain denied without mirror rows',async()=>{
   const cases=[
    ["update auth.users set banned_until=now()+interval '1 day' where id=$1",[U]],
    ['update auth.users set deleted_at=now() where id=$1',[U]],
    ['insert into app.account_closures(user_id) values($1)',[U]],
    ['update app.clients set is_active=false where user_id=$1',[U]],
    ['update app.clients set is_suspended=true where user_id=$1',[U]],
    ['delete from app.clients where user_id=$1',[U]],
    ['insert into app.guards(id,user_id) values($1,$2)',[FC,U]],
    ['insert into app.clients(id,user_id) values($1,$2)',[GP,U]],
   ];
   for(const [sql,args]of cases){await seed();await root(sql,args);assert.equal(await role(U),null);await user(U);await assert.rejects(rpc('send_owned_job_message',message()));assert.equal((await root('select count(*)::int n from app.messages')).rows[0].n,0);}
   await seed();await root('update app.guards set is_active=false where user_id=$1',[G]);assert.equal(await role(G),null);await user(U);await assert.rejects(rpc('send_owned_job_message',message()));
  });
  await t.test('stored role conflicts and user-editable metadata cannot be used to gain another role',async()=>{
   await seed();await root("insert into app.users(id,user_type) values($1,'guard')",[U]);assert.equal(await role(U),null);
   await seed();await root("update auth.users set raw_user_meta_data='{\"user_type\":\"admin\"}' where id=$1",[U]);assert.equal(await role(U),'client');
   await root('delete from app.clients where user_id=$1',[U]);assert.equal(await role(U),null);
   await root('insert into app.admin_users(user_id,is_active) values($1,false)',[U]);assert.equal(await role(U),null);
   await root('update app.admin_users set is_active=true where user_id=$1',[U]);assert.equal(await role(U),'admin');
  });
  await t.test('private functions, foreign job ownership and notification preferences remain enforced',async()=>{
   await seed();await user(U);await assert.rejects(db.query('select app.qg_active_message_role($1)',[U]),/permission denied/);await assert.rejects(db.query('select app.submit_client_review($1,$2)',[U,JSON.stringify(review)]),/permission denied/);
   await user(F);await assert.rejects(rpc('send_owned_job_message',message({expected_user_id:F})),error=>error.code==='42501');
   await root('insert into app.notification_preferences(user_id,messages) values($1,false)',[G]);await user(U);await rpc('send_owned_job_message',message());assert.equal((await root('select count(*)::int n from app.notifications')).rows[0].n,0);
   await db.exec('reset role;set role anon');await assert.rejects(db.query('select app.get_my_message_partners($1)',[[G]]),/permission denied/);
  });
 }finally{await db.close();}
});
