import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.39.3';

type Status = 'ok' | 'warn' | 'fail';
type Agent = 'payments' | 'sia' | 'jobs';
interface Check {key:string;label:string;status:Status;detail:string;}
const labels:Record<Agent,string>={payments:'Payments',sia:'SIA Badges',jobs:'Jobs'};
const origins=['https://quickguard.uk','https://www.quickguard.uk'];

// Read-only diagnostics: never execute workers, change verification or release money.
export async function handleAgentHealth(req:Request):Promise<Response> {
  const origin=req.headers.get('Origin');
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0],
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return reply(500,{error:'Monitor configuration unavailable'});
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token)return reply(401,{error:'Unauthorized'});
  const db=createClient(url,key,{db:{schema:'app'}});
  try {
    if(token!==key){
      const {data:{user},error}=await db.auth.getUser(token);
      if(error||!user)return reply(401,{error:'Unauthorized'});
      const {data:admin,error:adminError}=await db.from('admin_users').select('id,is_active').eq('user_id',user.id).maybeSingle();
      if(adminError||!admin?.is_active)return reply(403,{error:'Active admin access required'});
    }
    let body:any;
    try {body=await req.json();} catch {return reply(400,{error:'Invalid JSON body'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'Invalid request'});
    if(body.site&&body.site!=='quickguard.uk')return reply(400,{error:'Unsupported site'});
    const agent=body.agent??'all';
    if(agent!=='all'&&!Object.prototype.hasOwnProperty.call(labels,agent))return reply(400,{error:'Unknown agent'});
    const agents:Agent[]=agent==='all'?['payments','sia','jobs']:[agent];
    const now=new Date(),day=now.toISOString().slice(0,10);
    const since=new Date(now.getTime()-86400000).toISOString();
    const stale=new Date(now.getTime()-3600000).toISOString();
    const nextMonth=new Date(now.getTime()+30*86400000).toISOString().slice(0,10);
    async function count(key:string,label:string,query:any,severity:Status):Promise<Check>{
      try {
        const {count,error}=await query;
        if(error||typeof count!=='number')return {key,label,status:'fail',detail:'The monitor could not read this check.'};
        return {key,label,status:count>0?severity:'ok',detail:`${count} records need attention.`};
      }catch{return {key,label,status:'fail',detail:'The monitor could not read this check.'};}
    }
    async function heartbeat(agent:Agent):Promise<Check>{
      const key='worker_heartbeat',label='Worker heartbeat';
      try {
        const {data,error}=await db.from('agent_state_snapshots').select('health,created_at').eq('site','quickguard.uk').eq('agent_id',agent).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(error)return {key,label,status:'fail',detail:'Worker heartbeat storage could not be read.'};
        if(!data)return {key,label,status:'warn',detail:'No heartbeat received for this agent. Data checks do not prove the worker is running.'};
        const time=Date.parse(data.created_at);
        if(!Number.isFinite(time)||time>now.getTime()+300000||time<now.getTime()-3600000)return {key,label,status:'warn',detail:'No current worker heartbeat within the last hour.'};
        const health=String(data.health).toLowerCase();
        if(['healthy','ok'].includes(health))return {key,label,status:'ok',detail:'The worker reported a healthy heartbeat within the last hour.'};
        if(['fail','failed','unhealthy','critical','down'].includes(health))return {key,label,status:'fail',detail:'The latest worker heartbeat reports a failure.'};
        return {key,label,status:'warn',detail:'The latest worker heartbeat needs attention.'};
      }catch{return {key,label,status:'fail',detail:'Worker heartbeat storage could not be read.'};}
    }
    const results=await Promise.all(agents.map(async agent=>{
      let checks:Check[];
      if(agent==='payments')checks=await Promise.all([
        count('reconciliation','Financial reconciliation',db.from('financial_operations').select('id',{count:'exact',head:true}).eq('state','reconciliation_required'),'fail'),
        count('failed_charges','Failed charges in 24 hours',db.from('transactions').select('id',{count:'exact',head:true}).eq('status','failed').gte('created_at',since),'warn'),
        count('failed_payouts','Failed payouts',db.from('guard_payouts').select('id',{count:'exact',head:true}).eq('status','failed'),'fail'),
        heartbeat(agent),
      ]);
      else if(agent==='sia')checks=await Promise.all([
        count('stalled_checks','SIA checks waiting over an hour',db.from('sia_checks').select('id',{count:'exact',head:true}).in('status',['pending','processing']).lt('created_at',stale),'fail'),
        count('expired_licences','Expired verified licences',db.from('guards').select('id',{count:'exact',head:true}).eq('is_active',true).eq('sia_verified',true).lt('sia_expiry_date',day),'fail'),
        count('expiring_licences','Licences expiring within 30 days',db.from('guards').select('id',{count:'exact',head:true}).eq('is_active',true).eq('sia_verified',true).gte('sia_expiry_date',day).lte('sia_expiry_date',nextMonth),'warn'),
        heartbeat(agent),
      ]);
      else checks=await Promise.all([
        count('stuck_payment','Jobs awaiting payment over 24 hours',db.from('jobs').select('id',{count:'exact',head:true}).eq('status','awaiting_payment').eq('is_deleted',false).lt('updated_at',since),'warn'),
        count('expired_adverts','Open adverts with past end dates',db.from('jobs').select('id',{count:'exact',head:true}).eq('status','open').eq('is_deleted',false).lt('end_date',day),'warn'),
        heartbeat(agent),
      ]);
      const status:Status=checks.some(c=>c.status==='fail')?'fail':checks.some(c=>c.status==='warn')?'warn':'ok';
      return {agent,label:labels[agent],status,summary:status==='ok'?'All monitored checks passed.':`${checks.filter(c=>c.status!=='ok').length} monitored checks need attention.`,checks};
    }));
    const status:Status=results.some(r=>r.status==='fail')?'fail':results.some(r=>r.status==='warn')?'warn':'ok';
    return reply(200,{site:'quickguard.uk',status,health:status==='ok'?'healthy':status==='warn'?'degraded':'unhealthy',checked_at:now.toISOString(),results});
  }catch{return reply(500,{error:'Agent health monitor unavailable. Please try again.'});}
}
