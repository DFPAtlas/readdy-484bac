import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='GET')return reply(405,{error:'Method not allowed'});
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return reply(503,{error:'Unavailable'});
    const db=createClient(url,key,{db:{schema:'app'},auth:{persistSession:false,autoRefreshToken:false}});
    const query=new URL(req.url).searchParams;
    const slot=query.get('slot');
    const requestedVersion=query.get('v');
    if(!slot){
      const {data,error}=await db.from('site_media_publications').select('slot_key,version_id');
      if(error)return reply(503,{error:'Unavailable'});
      return reply(200,{publications:data??[]});
    }
    if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slot))return reply(400,{error:'Invalid slot'});
    const {data:p,error}=await db.from('site_media_publications').select('version_id').eq('slot_key',slot).maybeSingle();
    if(error)return reply(503,{error:'Unavailable'});
    if(!p)return reply(404,{error:'No replacement'});
    if(requestedVersion!==null && requestedVersion!==p.version_id)return reply(404,{error:'Version not published'});
    const {data:v,error:ve}=await db.from('site_media_versions').select('object_path,mime_type,byte_size,sha256').eq('slot_key',slot).eq('id',p.version_id).maybeSingle();
    if(ve||!v||v.mime_type!=='image/png'||v.object_path!==slot+'/'+p.version_id+'.png')return reply(503,{error:'Unavailable'});
    const {data:blob,error:be}=await db.storage.from('site-media-staging').download(v.object_path);
    if(be||!blob||blob.size!==v.byte_size||blob.size>10485760)return reply(503,{error:'Unavailable'});
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==v.sha256)return reply(503,{error:'Unavailable'});
    // Recheck the pointer after storage retrieval; never serve a stale selection knowingly.
    const {data:current,error:ce}=await db.from('site_media_publications').select('version_id').eq('slot_key',slot).maybeSingle();
    if(ce||current?.version_id!==p.version_id)return reply(409,{error:'Selection changed'});
    return new Response(blob,{headers:{...headers,'Content-Type':'image/png','Content-Disposition':'inline'}});
  }catch{return reply(503,{error:'Unavailable'});}
});
