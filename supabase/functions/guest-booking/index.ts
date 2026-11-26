import { createClient,type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { availabilityInput,enquiryInput,receiptToken,record } from '../_shared/guest-booking-policy.ts';

import type { GuestBookingDatabase } from '../_shared/guest-booking-database.ts';
type Database=SupabaseClient<GuestBookingDatabase,'app'>;
class RequestProblem extends Error {constructor(message:string,public status=400){super(message);}}
async function boundedBody(req:Request):Promise<unknown>{
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new RequestProblem('Use JSON.',415);
 const reader=req.body?.getReader();if(!reader)throw new RequestProblem('Missing request.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new RequestProblem('Request too large.',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RequestProblem('Invalid JSON.');}
}
async function digest(secret:string,value:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export function createGuestBookingHandler({db,secret,fetcher=fetch,adminCheck=async()=>false}:{db:Database;secret:string;fetcher?:typeof fetch;adminCheck?:(token:string)=>Promise<boolean>}){
 return async(req:Request)=>{
  const origin=req.headers.get('origin');const allowed=!origin||['https://quickguard.uk','https://www.quickguard.uk','https://readdy.ai'].includes(origin)||/^https:\/\/[a-z0-9-]+\.readdy\.ai$/.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&allowed)headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='POST,OPTIONS';
  const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed)return reply(403,{error:'Origin not allowed.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Use POST.'});
  try{
   if(!secret)throw new Error('Missing limiter secret');
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0,128)||'unknown';
   const limit=await db.rpc('guest_booking_rate_limit',{p_bucket:await digest(secret,'rate:'+ip)});
   if(limit.error)throw new Error('Limiter unavailable');
   if(limit.data!==true){headers['Retry-After']='60';return reply(429,{error:'Too many requests. Please try again in a minute.'});}
   let body:Record<string,unknown>;try{body=record(await boundedBody(req));}catch(e){if(e instanceof RequestProblem)throw e;throw new RequestProblem('Invalid request.');}if(body.website)throw new RequestProblem('Unable to process this request.');
   const purge=await db.rpc('purge_expired_guest_enquiries');if(purge.error)throw new Error('Retention unavailable');
   if(body.action==='availability'){
    let input;try{input=availabilityInput(body);}catch(e){throw new RequestProblem(e instanceof Error?e.message:'Invalid booking.');}
    const response=await fetcher('https://api.postcodes.io/postcodes/'+encodeURIComponent(input.postcode),{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(response.status===404)throw new RequestProblem('Postcode not found. Check the full UK postcode.');
    if(!response.ok)throw new Error('Postcode lookup unavailable');
    const geo=record(await response.json());const point=record(geo.result);
    if(typeof point.latitude!=='number'||typeof point.longitude!=='number'||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))throw new Error('Postcode coordinates unavailable');
    const result=await db.rpc('guest_booking_match_count',{p_lat:point.latitude,p_lng:point.longitude,p_date:input.date,p_days:input.days,p_from:input.from,p_to:input.to,p_licence:input.licence,p_venue:input.venue,p_rate:input.rate});
    if(result.error){if(result.error.message==='Invalid availability request')throw new RequestProblem('Check your dates, times and job details. Shifts must start in the future and within 90 days.');throw new Error('Availability unavailable');}
    if(typeof result.data!=='number'||!Number.isSafeInteger(result.data)||result.data<0)throw new Error('Invalid count');
    return reply(200,{count:result.data,checkedAt:new Date().toISOString(),scope:input.scope,daysChecked:input.days});
   }
   if(body.action==='admin_remove_enquiry'){
    const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!bearer)return reply(401,{error:'Please sign in.'});
    const auth=await db.auth.getUser(bearer);if(auth.error||!auth.data.user)return reply(401,{error:'Please sign in.'});
    if(!(await adminCheck(bearer)))return reply(403,{error:'An active administrator with MFA is required.'});
    if(typeof body.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.id))throw new RequestProblem('Invalid enquiry.');
    const row=await db.from('guest_booking_enquiries').select('receipt_hash').eq('id',body.id).maybeSingle();
    if(row.error)throw new Error('Enquiry lookup unavailable');if(!row.data)return reply(404,{error:'Enquiry not found. Refresh the list.'});
    const change=await db.rpc('guest_booking_enquiry_change',{p_hash:row.data.receipt_hash,p_action:'withdraw'});if(change.error)throw new Error('Removal unavailable');
    return reply(200,{removed:true});
   }
   if(!['save_enquiry','withdraw_enquiry','complete_enquiry'].includes(String(body.action)))throw new RequestProblem('Invalid action.');
   let token;try{token=receiptToken(body.receipt);}catch{throw new RequestProblem('Invalid enquiry receipt.');}
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('enquiry:'+token))),byte=>byte.toString(16).padStart(2,'0')).join('');
   if(body.action==='withdraw_enquiry'){
    const result=await db.rpc('guest_booking_enquiry_change',{p_hash:hash,p_action:'withdraw'});if(result.error)throw new Error('Withdrawal unavailable');
    return reply(200,{removed:true});
   }
   if(body.action==='complete_enquiry'){
    const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!bearer)return reply(401,{error:'Please sign in.'});
    const auth=await db.auth.getUser(bearer);if(auth.error||!auth.data.user)return reply(401,{error:'Please sign in.'});
    const {data:client,error:clientError}=await db.from('clients').select('id,is_active').eq('user_id',auth.data.user.id).maybeSingle();
    if(clientError||!client||client.is_active!==true)return reply(403,{error:'An active client account is required.'});
    if(typeof body.jobId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.jobId))throw new RequestProblem('Invalid booking.');
    const job=await db.from('jobs').select('id,submission_id,is_draft,status').eq('id',body.jobId).eq('client_id',client.id).maybeSingle();
    if(job.error||!job.data||job.data.is_draft||job.data.status==='draft')return reply(404,{error:'Booking not found.'});
    const result=await db.rpc('guest_booking_enquiry_change',{p_hash:hash,p_action:'complete',p_submission:job.data.submission_id||''});if(result.error)throw new Error('Conversion unavailable');
    if(record(result.data).removed!==true)return reply(409,{error:'The saved enquiry does not match this booking.'});
    return reply(200,{removed:true});
   }
   let enquiry;try{enquiry=enquiryInput(body);}catch(e){throw new RequestProblem(e instanceof Error?e.message:'Invalid enquiry.');}
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date());
   if(enquiry.start_date<today||Date.parse(enquiry.start_date)>Date.now()+180*86400000)throw new RequestProblem('Check the enquiry date.');
   const result=await db.rpc('guest_booking_enquiry_change',{p_hash:hash,p_action:'save',p_data:enquiry});
   if(result.error)throw new Error('Enquiry save unavailable');
   const receipt=record(result.data);
   if(receipt.status==='withdrawn')return reply(410,{error:'This enquiry was removed. Start a new enquiry to opt in again.'});
   if(receipt.status==='conflict')return reply(409,{error:'Start a new enquiry to change the contact details.'});
   if(receipt.saved!==true||typeof receipt.expiresAt!=='string')throw new Error('Missing enquiry receipt');
   return reply(200,{saved:true,expiresAt:receipt.expiresAt});
  }catch(e){if(e instanceof RequestProblem)return reply(e.status,{error:e.message});return reply(503,{error:'This service is temporarily unavailable. Please retry.'});}
 };
}
Deno.serve(async(req:Request)=>{
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response(JSON.stringify({error:'Service unavailable.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return createGuestBookingHandler({db:createClient<GuestBookingDatabase,'app'>(url,key,{db:{schema:'app'},auth:{persistSession:false,autoRefreshToken:false}}),secret:key,adminCheck:async(token:string)=>{const actor=createClient<GuestBookingDatabase,'app'>(url,key,{db:{schema:'app'},global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});const result=await actor.rpc('is_active_admin');return !result.error&&result.data===true;}})(req);
});
