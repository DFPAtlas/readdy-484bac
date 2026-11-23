import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function pushHarness(payload) {
 const writes=[],registered=[],states=[];
 const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>({toJSON:()=>payload})}};
 const navigator={serviceWorker:{register:async url=>{registered.push(url);return registration},ready:Promise.resolve(registration)}};
 const supabase={functions:{invoke:async()=>({data:{publicKey:'AQID'},error:null})},auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},from:()=>({upsert:async row=>{writes.push(row);return {error:null}}})};
 const hooks={useState:()=>[{supported:true},v=>states.push(v({supported:true}))],useEffect:()=>{},useCallback:fn=>fn,useRef:value=>({current:value})};
 const mod={exports:{}};
 new Function('module','exports','require','navigator','Notification','window','atob',compile('hooks/usePushNotifications.ts'))(mod,mod.exports,name=>name==='react'?hooks:{supabase},navigator,{requestPermission:async()=> 'granted'},{},v=>Buffer.from(v,'base64').toString('binary'));
 return {api:mod.exports.usePushNotifications('guard'),writes,registered,states};
}
test('push uses a hosted worker and only saves complete encryption material',async()=>{
 const good=pushHarness({endpoint:'https://push.example/1',keys:{p256dh:'public-key',auth:'auth-key'}});
 await good.api.subscribe();
 assert.deepEqual(good.registered,['/push-sw.js']);
 assert.equal(good.writes.length,1);assert.equal(good.writes[0].p256dh,'public-key');
 for(const payload of [{},{endpoint:'https://push.example/1'},{endpoint:'https://push.example/1',keys:{auth:'auth-key'}}]){
  const h=pushHarness(payload);await h.api.subscribe();assert.equal(h.writes.length,0);assert.match(h.states.at(-1).error,/missing/);
 }
});
test('notification clicks cannot open another origin or a script URL',async()=>{
 const events={},opened=[];const origin='https://quickguard.uk';
 vm.runInNewContext(fs.readFileSync('public/push-sw.js','utf8'),{URL,self:{location:{origin},addEventListener:(name,fn)=>events[name]=fn,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}});
 for(const url of ['/guard/dashboard','https://evil.example/x','javascript:alert(1)']){
  let pending;events.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>pending=p});await pending;
 }
 assert.deepEqual(opened,[origin+'/guard/dashboard',origin+'/',origin+'/']);
});
test('configured consent fields do not duplicate the canonical guard consent control',()=>{
 let index=0;
 const initial=[{},'',false,null,false,false,[{id:'terms',field_key:'terms_accepted',field_type:'checkbox',is_enabled:true,is_required:true,field_label:'Terms duplicate'},{id:'email',field_key:'email',field_type:'email',is_enabled:true,field_label:'Email'}],false,null,'none',''];
 const mocks={react:{...React,useState:v=>[initial[index++]??v,()=>{}],useEffect:()=>{}},'next/navigation':{useRouter:()=>({})},'next/link':{default:({children,...props})=>React.createElement('a',props,children)}};
 const mod={exports:{}};
 new Function('module','exports','require',compile('app/guard/register/page.tsx'))(mod,mod.exports,name=>name in mocks?mocks[name]:name.startsWith('@/')||name.startsWith('./')?{default:()=>null}:require(name));
 const html=renderToStaticMarkup(React.createElement(mod.exports.default));
 assert.equal((html.match(/id="terms"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="terms_accepted"/);
 assert.doesNotMatch(html,/SIA Approved|HMRC Compliant|500\+|4\.9\/5/);
});

const guardReviewAdminId = 'admin-user-id';
const guardReviewAdminToken = 'header.' + Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url') + '.signature';

function guardAdminHarness({ updateError = null, updated = true, status = 'pending', emailResponse = () => new Response(JSON.stringify({ success: true, email_id: 'message-id' }), { status: 200 }) } = {}) {
  let handler;
  const writes = [];
  const emails = [];
  const guard = {
    id: 'guard-id',
    user_id: null,
    email: 'guard@example.invalid',
    verification_status: status,
    verified_by: status === 'suspended' ? guardReviewAdminId : null,
  };
  const db = {
    auth: {
      getUser: async token => {
        assert.equal(token, guardReviewAdminToken);
        return { data: { user: { id: guardReviewAdminId } }, error: null };
      },
    },
    from: table => {
      if (table === 'admin_users') {
        return {
          select: () => ({
            eq: (column, value) => {
              assert.equal(column, 'user_id');
              assert.equal(value, guardReviewAdminId);
              return { maybeSingle: async () => ({ data: { is_active: true }, error: null }) };
            },
          }),
        };
      }
      if (table === 'notifications') return { insert: async () => ({ error: null }) };
      assert.equal(table, 'guards');
      let mutation = false;
      const query = {
        select: () => query,
        eq: () => query,
        update: changes => {
          mutation = true;
          writes.push(changes);
          return query;
        },
        maybeSingle: async () => mutation
          ? { data: updated ? { id: guard.id } : null, error: updateError }
          : { data: guard, error: null },
      };
      return query;
    },
  };
  const mod = { exports: {} };
  const deno = {
    env: { get: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' })[key] },
    serve: fn => { handler = fn; },
  };
  new Function('module', 'exports', 'require', 'Deno', 'fetch', compile('supabase/functions/admin-verify-guard/index.ts'))(
    mod, mod.exports, () => ({ createClient: () => db }), deno, async (url, options) => {
      emails.push({ url, ...options });
      return emailResponse();
    },
  );
  return {
    writes,
    emails,
    call: (action, token = 'service-secret', body = {}) => handler(new Request('https://worker.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guardId: guard.id, action, rejectionReason: 'Synthetic test reason', ...body }),
    })),
  };
}

test('guard administration never reports success after rejected or unconfirmed database writes', async () => {
  for (const action of ['manual_sia_verify', 'approve', 'reject', 'suspend', 'restore']) {
    for (const opts of [{ updateError: { message: 'write failed' } }, { updated: false }]) {
      const h = guardAdminHarness({ ...opts, status: action === 'restore' ? 'suspended' : 'pending' });
      const response = await h.call(action, action === 'approve' ? guardReviewAdminToken : undefined);
      assert.equal(h.writes.length, 1, action);
      assert.equal(response.status, 500, action);
      assert.equal((await response.json()).error, 'Internal server error');
      assert.equal(h.emails.length, 0);
    }
  }
  const success = guardAdminHarness();
  assert.equal((await success.call('manual_sia_verify')).status, 200);
});

test('guard rejection persists before requesting the rejection template with bounded, trusted section labels', async () => {
  const h = guardAdminHarness();
  const response = await h.call('reject', guardReviewAdminToken, {
    rejectionReason: '  Test documents could not be verified  ',
    unconfirmedSections: ['Documents', '<img src=x onerror=alert(1)>', 'Documents'],
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notification_status, 'accepted');
  assert.equal(h.writes[0].verification_status, 'rejected');
  assert.equal(h.writes[0].rejection_reason, 'Test documents could not be verified');
  assert.equal(h.writes[0].dashboard_access, false);
  assert.equal(h.emails.length, 1);
  assert.equal(h.emails[0].url, 'https://test.supabase.co/functions/v1/send-guard-approval-email');
  assert.deepEqual(JSON.parse(h.emails[0].body), {
    guardId: 'guard-id', approved: false, rejectionReason: 'Test documents could not be verified', unconfirmedSections: ['Documents'],
  });
  assert.ok(h.emails[0].signal instanceof AbortSignal);
});

test('guard rejection reports email failures without undoing or repeating the decision', async () => {
  for (const emailResponse of [
    () => new Response(JSON.stringify({ error: 'Provider failed' }), { status: 502 }),
    () => { throw new Error('Network failed'); },
    () => new Response('not json'),
    () => new Response(JSON.stringify({ success: true })),
    () => new Response(JSON.stringify({ success: false, email_id: 'invalid' })),
  ]) {
    const h = guardAdminHarness({ emailResponse });
    const response = await h.call('reject', guardReviewAdminToken);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.notification_status, 'failed');
    assert.equal(h.writes.length, 1);
    assert.equal(h.emails.length, 1);
  }
  const duplicate = guardAdminHarness({ emailResponse: () => new Response(JSON.stringify({ success: true, skipped: true })) });
  assert.equal((await (await duplicate.call('reject')).json()).notification_status, 'already_sent');
  const rejected = guardAdminHarness({ status: 'rejected' });
  assert.equal((await rejected.call('reject')).status, 400);
  assert.equal(rejected.writes.length, 0);
  assert.equal(rejected.emails.length, 0);
});

test('guard rejection rejects blank, oversized or non-text reasons before any write or email', async () => {
  for (const rejectionReason of ['', '  ', null, 42, 'x'.repeat(501)]) {
    const h = guardAdminHarness();
    assert.equal((await h.call('reject', guardReviewAdminToken, { rejectionReason })).status, 400);
    assert.equal(h.writes.length, 0);
    assert.equal(h.emails.length, 0);
  }
});

test('guard approval requires and records a human admin reviewer', async () => {
  const h = guardAdminHarness();
  assert.equal((await h.call('approve')).status, 403);
  assert.equal(h.writes.length, 0);

  const response = await h.call('approve', guardReviewAdminToken);
  assert.equal(response.status, 200);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].verification_status, 'approved');
  assert.equal(h.writes[0].verified_by, guardReviewAdminId);
});

test('guard approval reports confirmed email acceptance only after its saved decision', async () => {
  const h = guardAdminHarness();
  const response = await h.call('approve', guardReviewAdminToken);
  const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.notification_status, 'accepted');
  assert.equal(result.guard_id, 'guard-id'); assert.equal(result.status, 'approved');
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].verified_by, guardReviewAdminId);
  const emails = h.emails.filter(e => e.url.endsWith('/send-guard-approval-email'));
  assert.equal(emails.length, 1); assert.equal(JSON.parse(emails[0].body).approved, true);
  assert.equal(JSON.parse(emails[0].body).guardId, 'guard-id'); assert.ok(emails[0].signal instanceof AbortSignal);
});
test('failed, rejected, malformed or unacknowledged approval email leaves the approval saved and visible as unconfirmed', async () => {
  for (const emailResponse of [
    () => new Response(JSON.stringify({ success: true, email_id: 'message-id' }), { status: 502 }),
    () => { throw Error('Network unavailable'); }, () => new Response('not json'),
    () => new Response(JSON.stringify({ success: true })),
    () => new Response(JSON.stringify({ success: false, email_id: 'invalid' })),
    () => new Response(JSON.stringify({ success: true, email_id: ' ' })),
  ]) {
    const h = guardAdminHarness({ emailResponse }); const response = await h.call('approve', guardReviewAdminToken);
    const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.success, true);
    assert.equal(result.status, 'approved'); assert.equal(result.notification_status, 'failed');
    assert.equal(h.writes.length, 1); assert.equal(h.writes[0].verification_status, 'approved');
    assert.equal(h.emails.filter(e => e.url.endsWith('/send-guard-approval-email')).length, 1);
  }
  const duplicate = guardAdminHarness({ emailResponse: () => new Response(JSON.stringify({ success: true, skipped: true })) });
  assert.equal((await (await duplicate.call('approve', guardReviewAdminToken)).json()).notification_status, 'already_sent');
});
test('already recorded approval does not claim an email was checked or request approval side effects again', async () => {
  for (const status of ['approved', 'verified']) {
    const h = guardAdminHarness({ status }); const result = await (await h.call('approve', guardReviewAdminToken)).json();
    assert.equal(result.already_approved, true); assert.equal(result.notification_status, 'not_requested');
    assert.equal(h.emails.length, 0); assert.ok(h.writes.every(w => !('verification_status' in w)));
  }
  const service = guardAdminHarness(); assert.equal((await service.call('approve')).status, 403);
  assert.equal(service.writes.length, 0); assert.equal(service.emails.length, 0);
});
