import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  // Local browser UAT is permitted only on this isolated sandbox project.
  const sandbox = Deno.env.get('SUPABASE_URL') === 'https://alfwwggavmyerjyqumuo.supabase.co';
  const allowed = origin === 'https://quickguard.uk' || (sandbox && origin === 'http://localhost:3000');
  return { ...{ 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }, ...(allowed && origin ? {'Access-Control-Allow-Origin':origin} : {}) };
};

const uuid = (v:unknown): v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (status:number, body:unknown) => new Response(JSON.stringify(body), {status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return reply(405,{error:'Method not allowed'});
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url||!key||!anon)return reply(503,{error:'Service unavailable'});
    const jwt=req.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
    if(!jwt)return reply(401,{error:'Authentication required'});
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await db.auth.getUser(jwt);
    if(authError||!user)return reply(401,{error:'Invalid session'});
    const caller=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:active,error:activeError}=await caller.rpc('is_active_admin');
    if(activeError||active!==true)return reply(403,{error:'Active administrator with MFA required'});
    const {data:admin,error:roleError}=await db.schema('app').from('admin_users').select('role,is_active').eq('user_id',user.id).maybeSingle();
    if(roleError||!admin?.is_active||!['admin','super_admin'].includes(admin.role))return reply(403,{error:'Content management permission required'});
    const body=await req.json().catch(()=>null);
    if(!body||typeof body.slot!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(body.slot)||!(body.version===null||uuid(body.version))||!(body.expected===null||uuid(body.expected)))return reply(400,{error:'Invalid publication request'});
    const {data:slot,error:slotError}=await db.from('site_media_slots').select('slot_key').eq('slot_key',body.slot).maybeSingle();
    if(slotError)return reply(503,{error:'Registry unavailable'});
    if(!slot)return reply(404,{error:'Unknown slot'});
    if(body.version!==null && ['brand-symbol-light','brand-symbol-dark'].includes(body.slot))return reply(409,{error:'Public image integration not enabled for this slot'});
    if(body.version!==null){
      const {data:v,error}=await db.from('site_media_versions').select('object_path,sha256,byte_size,mime_type').eq('slot_key',body.slot).eq('id',body.version).maybeSingle();
      if(error)return reply(503,{error:'Registry unavailable'});
      if(!v)return reply(404,{error:'Version not found'});
      if(v.mime_type!=='image/png'||v.object_path!==body.slot+'/'+body.version+'.png')return reply(422,{error:'Invalid stored image reference'});
      const {data:blob,error:downloadError}=await db.storage.from('site-media-staging').download(v.object_path);
      if(downloadError||!blob||blob.size!==v.byte_size||blob.size>10485760)return reply(422,{error:'Stored image unavailable or invalid'});
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==v.sha256||v.mime_type!=='image/png')return reply(422,{error:'Image integrity check failed'});
    }
    const {data:changed,error}=await db.rpc('change_site_media_publication',{p_slot:body.slot,p_version:body.version,p_expected:body.expected,p_actor:user.id});
    if(error)return reply(503,{error:'Publication failed'});
    if(changed!==true)return reply(409,{error:'Publication changed. Refresh and retry.'});
    return reply(200,{slot:body.slot,version:body.version});
  }catch{return reply(500,{error:'Publication failed'});}
});
