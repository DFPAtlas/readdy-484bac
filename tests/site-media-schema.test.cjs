const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {webcrypto}=require('node:crypto');
function harness(name,{active=true,role='super_admin',authenticated=true}={}){
 let handler;const reads=[],rpcs=[],clients=[];
 const createClient=(url,key,options)=>{
  const schema=options?.db?.schema??'public';clients.push(schema);
  const client={
   auth:{getUser:async()=>({data:{user:authenticated?{id:'fixture-admin'}:null},error:null})},
   schema:s=>{assert.equal(s,'app');return client;},
   rpc:async(fn)=>{rpcs.push({schema,fn});assert.equal(schema,'app');return {data:fn==='is_active_admin'?active:true,error:null};},
   from:table=>{
    reads.push({schema,table});assert.equal(schema,'app');
    const data=table==='admin_users'?{is_active:true,role}:table==='site_media_slots'?{slot_key:'homepage-hero',recommended_width:1600,recommended_height:900}:table==='site_media_publications'?[]:null;
    const q={select:()=>q,eq:()=>q,maybeSingle:()=>Promise.resolve({data,error:null}),then:(yes,no)=>Promise.resolve({data,error:null}).then(yes,no)};return q;
   },
  };return client;
 };
 const environment={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_ANON_KEY:'fixture-anon'};
 load('supabase/functions/'+name+'/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient},'npm:pngjs@7.0.0':{PNG:{}}},{Deno:{serve:fn=>{handler=fn;},env:{get:key=>environment[key]}},crypto:webcrypto});
 return {clients,reads,rpcs,call:()=>{
  const privateRead=name==='admin-read-site-media',publicRead=name==='public-site-media';
  const init={method:privateRead||publicRead?'GET':'POST',headers:{Authorization:'Bearer fixture-token',Origin:'https://quickguard.uk','Content-Type':name==='stage-site-media'?'image/png':'application/json'}};
  if(name==='publish-site-media')init.body=JSON.stringify({slot:'homepage-hero',version:null,expected:null});
  if(name==='stage-site-media')init.body='invalid PNG';
  return handler(new Request('https://fixture.invalid/'+name+(publicRead?'':'?slot=homepage-hero&version=00000000-0000-4000-8000-000000000001'),init));
 }};
}
for(const [name,status] of [['stage-site-media',422],['publish-site-media',200],['admin-read-site-media',404],['public-site-media',200]])test(name+' uses exposed app schema for every registry read and RPC',async()=>{
 const h=harness(name);assert.equal((await h.call()).status,status);assert.ok(h.reads.length>0);assert.ok(h.clients.every(s=>s==='app'));
});
for(const name of ['stage-site-media','publish-site-media','admin-read-site-media'])test(name+' still rejects invalid sessions, missing MFA and finance-only role before accessing media',async()=>{
 for(const [options,status] of [[{authenticated:false},401],[{active:false},403],[{role:'finance_admin'},403]]){
  const h=harness(name,options);assert.equal((await h.call()).status,status);assert.ok(h.reads.every(r=>r.table==='admin_users'));assert.ok(h.rpcs.every(r=>r.fn==='is_active_admin'));
 }
});
