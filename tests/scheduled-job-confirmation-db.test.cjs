const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./helpers/enterprise-module.cjs');

test('scheduled confirmation migration renders through the actual preview handler and preserves administrator templates on replay', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema app; create table app.email_templates (
      name varchar not null, template_slug varchar not null unique, subject text not null,
      body_html text not null, description text, category varchar, variables jsonb, is_active boolean
    ); insert into app.email_templates(name,template_slug,subject,body_html) values
      ('Live confirmation','job_posted','Existing live subject','Existing live body');`);
    const migration = fs.readFileSync('supabase/migrations/20261126093000_scheduled_job_confirmation.sql', 'utf8');
    await db.exec(migration);
    const template = (await db.query("select * from app.email_templates where template_slug='job_scheduled'")).rows[0];
    const variables = Object.fromEntries(template.variables.map(key => [key, `Synthetic ${key}`]));
    variables.publish_at = 'Tuesday, 1 December 2099 at 12:00 GMT';
    let handler; let providerCalls = 0;
    const fakeDb = { from(table) {
      assert.equal(table, 'email_templates');
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: template }; } };
    } };
    load('supabase/functions/render-email-template/index.ts', {
      'https://esm.sh/@supabase/supabase-js@2.45.0': { createClient: () => fakeDb },
      '../_shared/environment-isolation.ts': { isQuickGuardSandbox: () => true, sandboxRecipientAllowed: () => false, activationOrigin: () => 'https://example.invalid' },
    }, {
      Deno: { serve(fn) { handler = fn; }, env: { get: key => ({ SUPABASE_URL: 'https://sandbox.example.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture' })[key] } },
      fetch: async () => { providerCalls++; throw Error('Preview must not send'); },
    });
    const response = await handler(new Request('https://sandbox.example.test/renderer', {
      method: 'POST', headers: { Authorization: 'Bearer fixture' },
      body: JSON.stringify({ template_slug: 'job_scheduled', to: 'synthetic@example.invalid', variables, dry_run: true }),
    }));
    assert.equal(response.status, 200); const preview = await response.json();
    assert.match(preview.subject, /saved for scheduled publication/);
    assert.match(preview.body_html, /not yet visible to guards/);
    assert.match(preview.body_html, /matching guards have not been notified/);
    assert.ok(preview.body_html.includes(variables.publish_at));
    assert.doesNotMatch(preview.body_html, /{{|now live/); assert.equal(providerCalls, 0);
    await db.exec("update app.email_templates set subject='Admin scheduled subject',body_html='Admin scheduled body',is_active=false where template_slug='job_scheduled'");
    await db.exec(migration);
    assert.deepEqual((await db.query('select template_slug,subject,body_html,is_active from app.email_templates order by template_slug')).rows, [
      { template_slug: 'job_posted', subject: 'Existing live subject', body_html: 'Existing live body', is_active: null },
      { template_slug: 'job_scheduled', subject: 'Admin scheduled subject', body_html: 'Admin scheduled body', is_active: false },
    ]);
  } finally { await db.close(); }
});
