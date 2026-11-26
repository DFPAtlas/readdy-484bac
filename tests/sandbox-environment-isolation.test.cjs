const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const isolation=load('supabase/functions/_shared/environment-isolation.ts');
const {QUICKGUARD_SANDBOX_URL:project,QUICKGUARD_SANDBOX_ORIGIN:origin}=isolation;
test('credential migration revokes inherited browser grants and exposes only named sandbox secrets to service role',async()=>{
  const db=new PGlite();try{
    await db.exec("create role anon;create role authenticated;create role service_role;create schema app;create schema vault;grant usage on schema app to anon,authenticated,service_role;grant usage on schema vault to service_role;alter default privileges in schema app grant select on tables to authenticated;create table vault.decrypted_secrets(name text,decrypted_secret text);grant select on vault.decrypted_secrets to service_role;insert into vault.decrypted_secrets values('qg_sandbox_resend_key','test-only'),('qg_sandbox_bank_payout_webhook','test-only'),('unrelated-production-secret','never-exposed');");
    await db.exec(fs.readFileSync('supabase/migrations/20261125225126_sandbox_runtime_credentials.sql','utf8'));
    const grants=(await db.query("select has_table_privilege('anon','app.sandbox_runtime_credentials','select') as anon,has_table_privilege('authenticated','app.sandbox_runtime_credentials','select') as authenticated,has_table_privilege('service_role','app.sandbox_runtime_credentials','select') as service")).rows[0];assert.deepEqual(grants,{anon:false,authenticated:false,service:true});
    await db.exec('set role service_role');assert.deepEqual((await db.query('select name from app.sandbox_runtime_credentials order by name')).rows.map(r=>r.name),['qg_sandbox_bank_payout_webhook','qg_sandbox_resend_key']);
  }finally{await db.close();}
});
test('sandbox activation requires its exact configured origin; production behavior is preserved',()=>{
  assert.equal(isolation.activationOrigin(project,origin),origin);
  for(const url of [undefined,'https://quickguard.uk',origin+'/path',origin+'?x=1',origin+'#x',origin.replace('https://','https://user@')]) assert.throws(()=>isolation.activationOrigin(project,url));
  assert.equal(isolation.activationOrigin('https://vnywjfpkepjgclkbcmsj.supabase.co'), 'https://quickguard.uk');
});
test('sandbox mail fails closed on empty or malformed policies and any unapproved recipient',()=>{
  const email='synthetic@example.invalid';
  assert.equal(isolation.sandboxRecipientAllowed(project,[email],JSON.stringify([email])),true);
  for(const policy of [undefined,'null','{}','[]','[4]','["bad"]','invalid']) assert.equal(isolation.sandboxRecipientAllowed(project,[email],policy),false);
  assert.equal(isolation.sandboxRecipientAllowed(project,[email,'other@example.invalid'],JSON.stringify([email])),false);
  assert.equal(isolation.sandboxRecipientAllowed(project,[],JSON.stringify([email])),false);
});
test('signed events must match configured key mode; sandbox never accepts live mode',()=>{
  for(const prefix of ['sk','rk']) {
    assert.equal(isolation.stripeEventMatchesEnvironment(project,`${prefix}_test_fixture`,false),true);
    for(const mode of [true,undefined,null,'false']) assert.equal(isolation.stripeEventMatchesEnvironment(project,`${prefix}_test_fixture`,mode),false);
    assert.equal(isolation.stripeEventMatchesEnvironment(project,`${prefix}_live_fixture`,true),false);
    assert.equal(isolation.stripeEventMatchesEnvironment('https://production.invalid',`${prefix}_live_fixture`,true),true);
  }
  assert.equal(isolation.stripeEventMatchesEnvironment(project,'unknown',false),false);
});
function renderer({to='synthetic@example.invalid',dry=false,allowed=true,key=true}={}) {
  let handler;const calls=[];
  const db={from(table){calls.push(table);const q={select(){return q;},eq(){return q;},maybeSingle(){return q;},insert(){return q;},then(resolve,reject){return Promise.resolve({data:table==='settings'?{value:JSON.stringify(allowed?['synthetic@example.invalid']:[])}:table==='sandbox_runtime_credentials'?(key?{secret:'fixture-key'}:null):table==='email_templates'?{subject:'Sandbox',body_html:'Hello'}:null,error:null}).then(resolve,reject);}};return q;}};
  load('supabase/functions/render-email-template/index.ts',{'https://esm.sh/@supabase/supabase-js@2.45.0':{createClient:()=>db}},{Deno:{serve(fn){handler=fn;},env:{get:name=>({SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'fixture-service'})[name]}},fetch:async()=>{calls.push('provider');return Response.json({id:'accepted'});},console:{log(){},error(){}}});
  return {calls,run:()=>handler(new Request(project,{method:'POST',headers:{Authorization:'Bearer fixture-service'},body:JSON.stringify({template_slug:'signup_verification',to,dry_run:dry})}))};
}
test('actual renderer blocks recipients before reading secrets, generating links or calling provider',async()=>{
  for(const to of ['other@example.invalid',['synthetic@example.invalid','other@example.invalid']]) {const r=renderer({to});assert.equal((await r.run()).status,403);assert.deepEqual(r.calls,['settings']);}
  const r=renderer({allowed:false});assert.equal((await r.run()).status,403);assert.deepEqual(r.calls,['settings']);
});
test('actual renderer uses named Vault credential only for approved real sends; previews need no key',async()=>{
  const sent=renderer();assert.equal((await sent.run()).status,200);assert.deepEqual(sent.calls,['settings','sandbox_runtime_credentials','email_templates','provider','email_send_log']);
  const missing=renderer({key:false});assert.equal((await missing.run()).status,500);assert.equal(missing.calls.includes('provider'),false);
  const preview=renderer({dry:true,key:false,allowed:false});assert.equal((await preview.run()).status,200);assert.deepEqual(preview.calls,['email_templates']);
});
test('sandbox payout handler uses only its named credential and rejects wrong modes before payout access',async()=>{
  for(const livemode of [false,true]) {
    let handler;const reads=[];
    const db={from(table){reads.push(table);return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{secret:'fixture-secret'},error:null})};}};
    class Stripe {constructor(){this.webhooks={constructEventAsync:async()=>({livemode,type:'unsupported.policy.probe'})};}}
    load('supabase/functions/stripe-bank-payout-webhook/index.ts',{'https://esm.sh/stripe@14.10.0?target=deno':Stripe,'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{serve(fn){handler=fn;},env:{get:name=>({SUPABASE_URL:project,STRIPE_SECRET_KEY:'sk_test_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'})[name]}},console:{error(){}}});
    const response=await handler(new Request(project,{method:'POST',headers:{'stripe-signature':'fixture'},body:'{}'}));assert.equal(response.status,livemode?400:200);assert.deepEqual(reads,['sandbox_runtime_credentials']);
  }
});
test('main webhook rejects a validly signed wrong-mode event before claiming or writing it',async()=>{
  let handler;const db={rpc(){throw Error('Unexpected event claim');},from(){throw Error('Unexpected data access');}};
  class Stripe {constructor(){this.webhooks={constructEventAsync:async()=>({id:'evt_fixture',livemode:true,type:'checkout.session.completed'})};}}
  load('supabase/functions/enhanced-stripe-webhook/index.ts',{'https://deno.land/std@0.168.0/http/server.ts':{serve(fn){handler=fn;}},'https://esm.sh/stripe@14.10.0?target=deno':Stripe,'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{env:{get:name=>({SUPABASE_URL:project,STRIPE_SECRET_KEY:'sk_test_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',STRIPE_WEBHOOK_SECRET:'fixture-secret'})[name]}},console:{log(){},error(){}}});
  const response=await handler(new Request(project,{method:'POST',headers:{'stripe-signature':'fixture'},body:'{}'}));assert.equal(response.status,400);assert.equal((await response.json()).error,'Stripe environment mismatch');
});

test('production payout signing-key rotation ignores a sandbox environment-secret override',async()=>{
  for(const livemode of [false,true]){
    let handler;const reads=[],verified=[];let records=0;
    const db={from(table){reads.push(table);assert.equal(table,'bank_payout_webhook_keys');return{select(){return this;},eq:async()=>({data:[{signing_secret:'previous-fixture',livemode},{signing_secret:'current-fixture',livemode}],error:null})};}};
    class Stripe{constructor(){this.webhooks={constructEventAsync:async(_body,_signature,secret)=>{verified.push(secret);if(secret!=='current-fixture')throw Error('Signature mismatch');return{livemode,type:'payout.paid',account:'acct_synthetic',id:'evt_synthetic',data:{object:{id:'po_synthetic'}}};}};}}
    load('supabase/functions/stripe-bank-payout-webhook/index.ts',{
      'https://esm.sh/stripe@14.10.0?target=deno':Stripe,
      'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db},
      '../_shared/bank-payouts.ts':{bankPayoutEventTypes:['payout.paid'],recordBankPayout:async()=>{records++;return{status:'paid'};}},
    },{Deno:{serve(fn){handler=fn;},env:{get:name=>({SUPABASE_URL:'https://production.example.invalid',STRIPE_SECRET_KEY:livemode?'sk_live_fixture':'sk_test_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',STRIPE_BANK_PAYOUT_WEBHOOK_SECRET:'sandbox-only-fixture'})[name]}},console:{error(){}}});
    const response=await handler(new Request('https://production.example.invalid',{method:'POST',headers:{'stripe-signature':'fixture'},body:'{}'}));
    assert.equal(response.status,200);assert.deepEqual(reads,['bank_payout_webhook_keys']);assert.deepEqual(verified,['previous-fixture','current-fixture']);assert.equal(records,1);
  }
});

test('missing sandbox payout credential fails closed without reading production rotation keys',async()=>{
  let handler;const reads=[];let verifies=0;
  const db={from(table){reads.push(table);assert.equal(table,'sandbox_runtime_credentials');return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})};}};
  class Stripe{constructor(){this.webhooks={constructEventAsync:async()=>{verifies++;throw Error('Must not verify without the sandbox credential');}};}}
  load('supabase/functions/stripe-bank-payout-webhook/index.ts',{'https://esm.sh/stripe@14.10.0?target=deno':Stripe,'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{serve(fn){handler=fn;},env:{get:name=>({SUPABASE_URL:project,STRIPE_SECRET_KEY:'sk_test_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'})[name]}},console:{error(){}}});
  const response=await handler(new Request(project,{method:'POST',headers:{'stripe-signature':'fixture'},body:'{}'}));assert.equal(response.status,500);assert.deepEqual(reads,['sandbox_runtime_credentials']);assert.equal(verifies,0);
});
