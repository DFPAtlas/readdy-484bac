import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function harness({ approved = false, duplicate = false } = {}) {
  let handler; const sends = [];
  const guard = { id: 'guard-record', user_id: 'auth-user', full_name: 'TEST Applicant', email: 'test@example.invalid' };
  const db = { from: table => {
    let fields = '';
    const q = { select: value => { fields = value; return q; }, eq: () => q, gte: () => q, maybeSingle: async () => {
      if (table === 'email_send_log') return { data: duplicate ? { id: 'previous-email' } : null, error: null };
      assert.equal(table,'guards');
      if (fields.split(',').some(c => ['first_name','last_name'].includes(c.trim()))) return { data:null,error:{message:'Guard column does not exist'} };
      return { data:guard,error:null };
    } }; return q;
  } };
  const compiled = ts.transpileModule(fs.readFileSync('supabase/functions/send-guard-approval-email/index.ts','utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020 } }).outputText;
  new Function('exports','require','Deno','fetch',compiled)({}, name => name.includes('/http/server') ? { serve: next => { handler = next; } } : { createClient: () => db },
    { env:{ get: name => ({ SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only' })[name] } },
    async (url,options) => {
      const payload = JSON.parse(options.body); sends.push({url,...payload});
      // Mirrors the renderer's verified-identity requirement for dashboard links.
      if (!approved && payload.variables.dashboard_url) return new Response(JSON.stringify({error:'Unconfirmed identity'}),{status:500});
      return new Response(JSON.stringify({success:true,email_id:'provider-receipt'}));
    });
  return { sends, call: () => handler(new Request('https://test.supabase.co/functions/v1/send-guard-approval-email',{
    method:'POST',headers:{Authorization:'Bearer server-only','Content-Type':'application/json'},body:JSON.stringify({guardId:guard.id,approved,rejectionReason:'Synthetic missing documents'})
  })) };
}

test('rejection resolves the current guard schema from its ID and does not request a sign-in token for an unconfirmed applicant',async()=>{
  const h=harness(); const response=await h.call(); assert.equal(response.status,200);
  assert.equal((await response.json()).email_id,'provider-receipt'); assert.equal(h.sends.length,1);
  assert.equal(h.sends[0].to,'test@example.invalid'); assert.equal(h.sends[0].template_slug,'guard_rejection');
  assert.equal(h.sends[0].related_user_id,'auth-user'); assert.equal('dashboard_url' in h.sends[0].variables,false);
  assert.equal(h.sends[0].variables.rejection_reason,'Synthetic missing documents');
});

test('approval retains its dashboard sign-in request and decision emails retain duplicate protection',async()=>{
  const h=harness({approved:true}); assert.equal((await h.call()).status,200);
  assert.equal(h.sends[0].variables.dashboard_url,'https://quickguard.uk/guard/dashboard');
  for(const approved of [true,false]) { const d=harness({approved,duplicate:true}); const response=await d.call(); assert.equal((await response.json()).skipped,true); assert.equal(d.sends.length,0); }
});
