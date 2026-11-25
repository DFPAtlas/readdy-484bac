const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const actor='00000000-0000-4000-8000-000000000001';
const a='00000000-0000-4000-8000-000000000011';
const b='00000000-0000-4000-8000-000000000012';
const other='00000000-0000-4000-8000-000000000013';
async function fixture(){
 const db=new PGlite();
 try{
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA storage;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;
 CREATE POLICY deliberately_broad ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
 CREATE FUNCTION public.is_active_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('fixture.active_admin',true),'')='yes' AND coalesce(current_setting('fixture.aal',true),'')='aal2' $$;
 REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated,service_role;
 `);
 for(const name of fs.readdirSync('supabase/migrations').filter(x=>/^20261124190[0-7]00_site_media_.*\.sql$/.test(x)).sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.query("insert into public.site_media_versions(id,slot_key,object_path,width,height,byte_size,mime_type,sha256,created_by) values ($1,'homepage-hero',$2,1600,900,100,'image/png',repeat('a',64),$3),($4,'homepage-hero',$5,1600,900,100,'image/png',repeat('b',64),$3),($6,'homepage-logo',$7,600,200,100,'image/png',repeat('c',64),$3)",[a,'homepage-hero/'+a+'.png',actor,b,'homepage-hero/'+b+'.png',other,'homepage-logo/'+other+'.png']);
 await db.exec("insert into storage.objects values ('site-media-staging','draft.png'),('other-bucket','unrelated.png')");
 return db;
 }catch(e){await db.close();throw e;}
}
async function role(db,name,active='no',aal='aal1'){
 await db.exec('reset role');
 await db.query("select set_config('fixture.active_admin',$1,false),set_config('fixture.aal',$2,false)",[active,aal]);
 await db.exec('set role '+name);
}
async function publish(db,version,expected,slot='homepage-hero'){
 return (await db.query('select public.change_site_media_publication($1,$2,$3,$4) as ok',[slot,version,expected,actor])).rows[0].ok;
}
async function count(db,table){return (await db.query('select count(*)::int n from public.'+table)).rows[0].n;}
test('all 51 slots migrate; anonymous and ordinary sessions cannot read drafts or mutate publications; restrictive storage policy survives a broad policy',async()=>{
 const db=await fixture();try{
 assert.equal(await count(db,'site_media_slots'),51);
 assert.equal((await db.query("select public from storage.buckets where id='site-media-staging'")).rows[0].public,false);
 await role(db,'anon');
 await assert.rejects(count(db,'site_media_versions'),/permission denied/);
 await assert.rejects(publish(db,a,null),/permission denied/);
 assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await assert.rejects(db.exec("insert into storage.objects values ('site-media-staging','forged.png')"),/row-level security/);
 for(const [active,aal,visible] of [['no','aal2',0],['yes','aal1',0],['yes','aal2',3]]){
 await role(db,'authenticated',active,aal);
 assert.equal(await count(db,'site_media_versions'),visible);
 await assert.rejects(publish(db,a,null),/permission denied/);
 await assert.rejects(db.exec("delete from public.site_media_versions"),/permission denied/);
 assert.equal((await db.query("select * from storage.objects where bucket_id='site-media-staging'")).rows.length,0);
 }
 }finally{await db.close();}
});
test('publication is atomic, rejects cross-slot versions and stale writes, supports restore and reset with durable audit',async()=>{
 const db=await fixture();try{
 await role(db,'service_role');
 assert.equal(await publish(db,a,null),true);
 assert.equal(await publish(db,b,null),false);
 assert.equal(await publish(db,a,a),true);
 assert.equal(await count(db,'site_media_publication_events'),1);
 await assert.rejects(publish(db,other,a),/foreign key/);
 assert.equal(await count(db,'site_media_publication_events'),1);
 assert.equal(await publish(db,b,a),true);
 assert.equal(await publish(db,a,b),true);
 assert.equal(await publish(db,null,a),true);
 assert.equal(await count(db,'site_media_publications'),0);
 assert.equal(await count(db,'site_media_publication_events'),4);
 assert.equal(await count(db,'site_media_versions'),3);
 await db.exec('reset role; alter table public.site_media_publication_events add constraint fixture_block_audit check (false) not valid');
 await role(db,'service_role');
 await assert.rejects(publish(db,a,null),/fixture_block_audit/);
 assert.equal(await count(db,'site_media_publications'),0);
 }finally{await db.close();}
});
