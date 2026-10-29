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
 const authorization=req.headers.get("x-qg-worker-token")||"";
 const workerToken=Deno.env.get("QG_DFP_WORKER_TOKEN")||"";
 if(!workerToken||workerToken.length<32||authorization!==workerToken)return json(401,{error:"Service authentication required"});
 // Feature flag stays OFF until isolated UAT and receiver deployment.
 if(Deno.env.get("QG_DFP_EMAIL_FORWARDING_ENABLED")!=="true")return json(503,{error:"Forwarder disabled"});
 const secret=Deno.env.get("DFP_UNVERIFIED_EMAIL_SHARED_SECRET")||"";
 const endpoint=Deno.env.get("DFP_UNVERIFIED_EMAIL_ENDPOINT")||"";
 if(secret.length<32||!endpoint.startsWith("https://"))return json(503,{error:"Forwarder not configured"});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,service,{db:{schema:"app"},auth:{persistSession:false}});
 const {error:enqueueError}=await db.rpc("enqueue_pending_support_email_dfp");
 if(enqueueError)return json(503,{error:"Enqueue failed"});
 const {data:due,error:listError}=await db.rpc("claim_due_support_email_dfp",{p_limit:5});
 if(listError)return json(503,{error:"Outbox unavailable"});
 let delivered=0,failed=0;
 for(const item of due||[]){
  const {data:email}=await db.from("support_inbound_emails").select("resend_email_id,sender_email,recipient_email,subject,body_text,received_at").eq("id",item.inbound_email_id).maybeSingle();
  if(!email){await db.rpc("finish_support_email_dfp",{p_id:item.id,p_token:item.lease_token,p_success:false,p_error:"Staged email missing"});failed++;continue;}
  const raw=JSON.stringify({siteSlug:"quickguard",providerEmailId:email.resend_email_id,from:email.sender_email,to:email.recipient_email,
    subject:email.subject,text:email.body_text,receivedAt:email.received_at});
  const timestamp=new Date().toISOString();
  try{
   const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-dfp-timestamp":timestamp,
    "x-dfp-signature":await hmac(secret,timestamp+"\n"+raw)},body:raw,signal:AbortSignal.timeout(10000)});
   if(response.ok){
    const ack=await response.json().catch(()=>null);
    if(ack?.accepted!==true||ack?.providerEmailId!==email.resend_email_id)throw new Error("Invalid DFP acknowledgement");
    const {data:finished,error:finishError}=await db.rpc("finish_support_email_dfp",{p_id:item.id,p_token:item.lease_token,p_success:true});
    if(finishError||finished!==true)throw new Error("Lease acknowledgement failed");
    delivered++;continue;
   }
   throw new Error("HTTP "+response.status);
  }catch(error){
   await db.rpc("finish_support_email_dfp",{p_id:item.id,p_token:item.lease_token,p_success:false,
     p_error:error instanceof Error?error.message.slice(0,120):"Delivery failed"});
   failed++;
  }
 }
 return json(200,{processed:delivered+failed,delivered,failed});
});
