import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const headers={'Access-Control-Allow-Origin':'https://quickguard.uk','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
const reply=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='GET')return reply(405,'Method not allowed');
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url||!key||!anon)return reply(503,'Unavailable');
    const jwt=req.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
    if(!jwt)return reply(401,'Authentication required');
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await db.auth.getUser(jwt);
    if(authError||!user)return reply(401,'Invalid session');
    const caller=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:active,error:activeError}=await caller.rpc('is_active_admin');
    if(activeError||active!==true)return reply(403,'Active administrator with MFA required');
    const {data:admin,error:roleError}=await db.schema('app').from('admin_users').select('role,is_active').eq('user_id',user.id).maybeSingle();
    if(roleError||!admin?.is_active||!['admin','super_admin'].includes(admin.role))return reply(403,'Content management permission required');
    const query=new URL(req.url).searchParams,slot=query.get('slot')??'',version=query.get('version')??'';
    if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slot)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(version))return reply(400,'Invalid image reference');
    const {data:v,error}=await db.from('site_media_versions').select('object_path,byte_size,mime_type,sha256').eq('slot_key',slot).eq('id',version).maybeSingle();
    if(error)return reply(503,'Registry unavailable');
    if(!v)return reply(404,'Version not found');
    if(v.mime_type!=='image/png'||v.object_path!==slot+'/'+version+'.png')return reply(422,'Invalid stored image reference');
    const {data:blob,error:be}=await db.storage.from('site-media-staging').download(v.object_path);
    if(be||!blob||blob.size!==v.byte_size||blob.size>10485760)return reply(503,'Image unavailable');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==v.sha256)return reply(422,'Image integrity check failed');
    return new Response(blob,{headers:{...headers,'Content-Type':'image/png','Content-Disposition':'attachment; filename="'+slot+'-'+version+'.png"'}});
  }catch{return reply(503,'Image unavailable');}
});
