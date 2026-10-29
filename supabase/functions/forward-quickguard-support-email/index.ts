import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const json=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
const enc=new TextEncoder();
async function hmac(secret:string,message:string){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(message))),v=>v.toString(16).padStart(2,"0")).join("");
}
serve(async req=>{
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const authorization=req.headers.get("authorization")||"";
 if(!service||authorization!== "Bearer "+service)return json(401,{error:"Service authentication required"});
 // Feature flag stays OFF until isolated UAT and receiver deployment.
 if(Deno.env.get("QG_DFP_EMAIL_FORWARDING_ENABLED")!=="true")return json(503,{error:"Forwarder disabled"});
 const secret=Deno.env.get("DFP_UNVERIFIED_EMAIL_SHARED_SECRET")||"";
 const endpoint=Deno.env.get("DFP_UNVERIFIED_EMAIL_ENDPOINT")||"";
 if(secret.length<32||!endpoint.startsWith("https://"))return json(503,{error:"Forwarder not configured"});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,service,{db:{schema:"app"},auth:{persistSession:false}});
 const {error:enqueueError}=await db.rpc("enqueue_pending_support_email_dfp");
 if(enqueueError)return json(503,{error:"Enqueue failed"});
 const {data:due,error:listError}=await db.from("support_email_dfp_outbox")
  .select("id,inbound_email_id,attempt_count").in("status",["pending","failed"])
  .lte("next_attempt_at",new Date().toISOString()).order("next_attempt_at").limit(5);
 if(listError)return json(503,{error:"Outbox unavailable"});
 let delivered=0,failed=0;
 for(const item of due||[]){
  const until=new Date(Date.now()+120000).toISOString();
  const {data:claimed,error:claimError}=await db.from("support_email_dfp_outbox")
    .update({status:"processing",lease_until:until,attempt_count:item.attempt_count+1})
    .eq("id",item.id).in("status",["pending","failed"]).select("id").maybeSingle();
  if(claimError||!claimed)continue;
  const {data:email}=await db.from("support_inbound_emails").select("resend_email_id,sender_email,recipient_email,subject,body_text,received_at").eq("id",item.inbound_email_id).maybeSingle();
  if(!email)continue;
  const raw=JSON.stringify({siteSlug:"quickguard",providerEmailId:email.resend_email_id,from:email.sender_email,to:email.recipient_email,
    subject:email.subject,text:email.body_text,receivedAt:email.received_at});
  const timestamp=new Date().toISOString();
  try{
   const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-dfp-timestamp":timestamp,
    "x-dfp-signature":await hmac(secret,timestamp+"\n"+raw)},body:raw,signal:AbortSignal.timeout(10000)});
   if(response.ok){
    await db.from("support_email_dfp_outbox").update({status:"delivered",delivered_at:new Date().toISOString(),lease_until:null,last_error:null}).eq("id",item.id);
    delivered++;continue;
   }
   throw new Error("HTTP "+response.status);
  }catch(error){
   const attempt=item.attempt_count+1;
   await db.from("support_email_dfp_outbox").update({status:"failed",lease_until:null,
     last_error:error instanceof Error?error.message.slice(0,120):"Delivery failed",
     next_attempt_at:new Date(Date.now()+Math.min(3600,Math.pow(2,Math.min(attempt,10))*30)*1000).toISOString()}).eq("id",item.id);
   failed++;
  }
 }
 return json(200,{processed:delivered+failed,delivered,failed});
});
