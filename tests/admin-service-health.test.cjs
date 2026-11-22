const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./helpers/enterprise-module.cjs');
const { nodes } = require('./helpers/guard-ui-fixture.cjs');
const { stripeHealth, emailConfiguration } = load('supabase/functions/_shared/admin-service-health.ts');

test('Stripe distinguishes credential/scope/rate failures from outages without exposing provider errors', async () => {
  for (const [code, status] of [[200,'healthy'],[401,'invalid_credentials'],[403,'access_denied'],[429,'rate_limited'],[503,'unhealthy'],[404,'unknown']]) {
    const result = await stripeHealth('fixture-secret', async (url, options) => {
      assert.equal(url, 'https://api.stripe.com/v1/balance'); assert.equal(options.method, undefined);
      assert.equal(options.headers.Authorization, 'Bearer fixture-secret'); return new Response('private provider detail', { status: code });
    });
    assert.equal(result.status, status); assert.doesNotMatch(JSON.stringify(result), /fixture-secret|private provider/);
  }
  assert.equal((await stripeHealth(undefined, () => { throw Error('Unexpected probe'); })).status, 'not_configured');
  assert.equal((await stripeHealth('fixture', async () => { throw Error('private network error'); })).status, 'unknown');
});

test('Resend configuration is recognised independently of SMTP and is never labelled a delivery verification', () => {
  assert.deepEqual(emailConfiguration(key => key === 'RESEND_API_KEY' ? 'fixture' : undefined), { status: 'configured', provider: 'Resend API' });
  assert.equal(emailConfiguration(key => ['SMTP_HOST','SMTP_USER','SMTP_PASS'].includes(key) ? 'fixture' : undefined).provider, 'SMTP');
  assert.equal(emailConfiguration(() => undefined).status, 'not_configured');
  assert.equal(emailConfiguration(key => key === 'SMTP_HOST' ? 'fixture' : undefined).status, 'not_configured');
});

test('admin metrics use exact rolling-window counts, preserve unknown verification and remain service-only', async () => {
  const db = new PGlite(); try {
    await db.exec(`create schema app; create role anon; create role authenticated; create role service_role;
      create table app.processed_stripe_events(processed_at timestamptz,event_type text,metadata jsonb);
      create table app.guard_payouts(status text,net_amount numeric);
      create table app.disputes(status text);
      create table app.transactions(refunded_at timestamptz,refund_amount numeric);
      create table app.email_queue(status text);
      create table app.email_send_log(status text,created_at timestamptz);
      create table app.email_provider_daily_usage(usage_date date,sent_count integer);
      insert into app.processed_stripe_events values(now(),'payment.failed','{}'),(now(),'invoice.paid','{"error":"fixture"}'),(now()-interval '2 days','payment.failed','{}');
      insert into app.guard_payouts values('failed',80),('paid_out',10),('pending',40),('held',80);
      insert into app.disputes values('open'),('under_review'),('resolved');
      insert into app.transactions values(now(),10),(now()-interval '8 days',10);
      insert into app.email_queue values('pending'),('sent');
      insert into app.email_send_log values('sent',now()),('failed',now()),('failed',now()-interval '2 days');
      insert into app.email_provider_daily_usage values((now() at time zone 'UTC')::date,4);
      grant usage on schema app to service_role; grant select on all tables in schema app to service_role;`);
    const migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_admin_service_metrics.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/' + migration, 'utf8'));
    for (const role of ['anon','authenticated']) {
      await db.exec('set role ' + role); await assert.rejects(db.query('select app.get_admin_service_metrics()'), /permission denied/); await db.exec('reset role');
    }
    await db.exec('set role service_role'); const data = (await db.query('select app.get_admin_service_metrics() data')).rows[0].data;
    assert.equal(data.stripe.failedEvents24h, 2); assert.equal(data.stripe.failedPayouts, 1);
    assert.equal(data.stripe.pendingPayouts, 2); assert.equal(data.pendingPayoutAmount, 120);
    assert.equal(data.stripe.openDisputes, 2); assert.equal(data.stripe.refunds, 1); assert.equal(data.stripe.pendingEvents, null);
    assert.equal(data.email.sentToday, 1); assert.equal(data.email.failedEmails24h, 1); assert.equal(data.email.dailySendCount, 4);
    assert.equal(data.email.spfValid, null); assert.equal(data.email.dkimValid, null); assert.equal(data.email.bounceRate, null);
  } finally { await db.close(); }
});

test('security panel displays Resend configuration and unknown DNS evidence without a false all-operational claim', () => {
  const Panel = load('app/admin/security/PaymentEmailSecurityPanel.tsx').default;
  const tree = Panel({ paymentEmailData: {
    stripe: { webhookStatus:'Recent activity recorded',webhookVerification:'Not independently checked',failedEvents24h:0,pendingEvents:null,pendingPayouts:0,failedPayouts:1,openDisputes:1,refunds:0,webhookLatency:'—',latestWebhook:null,signingSecret:'Configured',apiHealth:{status:'access_denied'} },
    email: { provider:'Resend API',configured:true,smtpConnected:false,queuePending:0,failedEmails24h:0,sentToday:0,bounceRate:null,spfValid:null,dkimValid:null,dailySendCount:0 },
  } });
  const metrics = nodes(tree).filter(n => n.props?.metric).map(n => n.props.metric);
  assert.equal(metrics.find(m => m.label === 'Resend API').value, 'Configured');
  assert.equal(metrics.find(m => m.label === 'SPF Record').value, 'Not checked');
  assert.equal(metrics.find(m => m.label === 'Failed Payouts').value, 1);
  assert.equal(metrics.find(m => m.label === 'Pending Events').value, 'Not checked');
});
