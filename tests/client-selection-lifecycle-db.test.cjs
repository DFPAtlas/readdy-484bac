const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { setupSql, migrationSql, CLIENT_USER, JOB, GUARD, OTHER_GUARD, OTHER_USER } = require('./helpers/journey-fixture.cjs');

async function setup() {
  const db = new PGlite();
  await db.exec(setupSql());
  await db.exec(`alter table app.jobs add column is_draft boolean default false;
    alter table app.guards add column verified_by uuid default '${CLIENT_USER}';
    create function app.guard_has_current_sia(boolean,text,date,date) returns boolean language sql as $$select coalesce($1 and nullif($2,'') is not null and $3 >= $4,false)$$;
    update app.jobs set start_date=current_date+1,end_date=current_date+2;
    insert into app.job_applications(job_id,guard_id,status) values('${JOB}','${GUARD}','pending'),('${JOB}','${OTHER_GUARD}','pending');`);
  await db.exec(migrationSql('20261005230000_scheduled_hours_pricing.sql'));
  const old = migrationSql('20261114174659_require_recorded_guard_admin_approval.sql');
  const start = old.indexOf('CREATE OR REPLACE FUNCTION app.select_job_guards(');
  const end = old.indexOf('$function$;', start) + '$function$;'.length;
  await db.exec(old.slice(start, end));
  const fix = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_client_selection_lifecycle.sql'));
  assert.ok(fix, 'Selection lifecycle migration is required');
  await db.exec(migrationSql(fix));
  await db.exec(`grant execute on function app.select_job_guards(uuid,jsonb) to authenticated;`);
  return db;
}
async function select(db, ids = [GUARD], user = CLIENT_USER) {
  await db.query("select set_config('test.uid',$1,false)", [user]);
  await db.exec('set role authenticated');
  try { return (await db.query('select app.select_job_guards($1,$2::jsonb) as result', [JOB, JSON.stringify(ids.map(guard_id => ({ guard_id, agreed_hourly_rate:1,agreed_hours:1,gross_guard_amount:1 })))] )).rows[0].result; }
  finally { await db.exec('reset role'); }
}
async function snapshot(db) {
  return (await db.query(`select jsonb_build_object('job',(select to_jsonb(j) from app.jobs j where id='${JOB}'),'applications',(select jsonb_agg(to_jsonb(a) order by id) from app.job_applications a),'assignments',(select jsonb_agg(to_jsonb(a) order by id) from app.job_assignments a)) as state`)).rows[0].state;
}

test('selection rejects non-recruiting jobs and inactive applications atomically', async t => {
  const db = await setup();
  try {
    for (const status of ['draft','cancelled','closed','completed','confirmed','in_progress']) await t.test(status + ' job cannot be reopened by selection',async()=>{
      await db.query('update app.jobs set status=$1', [status]);
      const before=await snapshot(db);
      await assert.rejects(select(db), /job_not_selectable/);
      assert.deepEqual(await snapshot(db), before);
    });
    await t.test('draft flag fails closed even when status says open',async()=>{
      await db.exec("update app.jobs set status='open',is_draft=true");
      const before=await snapshot(db);
      await assert.rejects(select(db),/job_not_selectable/);
      assert.deepEqual(await snapshot(db),before);
      await db.exec('update app.jobs set is_draft=false');
    });
    for (const status of ['withdrawn','rejected','declined','completed',null]) await t.test(String(status)+' application cannot be selected',async()=>{
      await db.query('update app.job_applications set status=$1 where guard_id=$2',[status,GUARD]);
      const before=await snapshot(db);
      await assert.rejects(select(db),/application_not_selectable/);
      assert.deepEqual(await snapshot(db),before);
    });
    await t.test('second invalid applicant rolls back the first selection',async()=>{
      await db.query("update app.job_applications set status=case when guard_id=$1 then 'pending' else 'withdrawn' end",[GUARD]);
      await db.exec('update app.jobs set number_of_guards=2');
      const before=await snapshot(db);
      await assert.rejects(select(db,[GUARD,OTHER_GUARD]),/application_not_selectable/);
      assert.deepEqual(await snapshot(db),before);
    });
  } finally {await db.close();}
});

test('valid selection and retry remain provisional with authoritative pricing and ownership',async t=>{
  const db=await setup();
  try {
    await t.test('foreign client is rejected without writes',async()=>{
      await db.query('insert into app.clients(id,user_id) values(gen_random_uuid(),$1)',[OTHER_USER]);
      const before=await snapshot(db);
      await assert.rejects(select(db,[GUARD],OTHER_USER),/job_not_owned/);
      assert.deepEqual(await snapshot(db),before);
    });
    for(const status of ['open','pending','awaiting_guard_selection','awaiting_payment']) await t.test(status+' can select and retry',async()=>{
      await db.exec('delete from app.job_assignments');
      await db.query('update app.jobs set status=$1',[status]);
      await db.exec("update app.job_applications set status='pending'");
      const r=await select(db); assert.equal(r.success,true);
      const row=(await db.query('select status,payment_status,agreed_hours::float as hours,gross_guard_amount::float as gross from app.job_assignments')).rows[0];
      assert.deepEqual(row,{status:'awaiting_payment',payment_status:'pending',hours:16,gross:320});
      const id=(await db.query('select id from app.job_assignments')).rows[0].id;
      assert.equal((await select(db)).success,true);
      const rows=(await db.query('select id from app.job_assignments')).rows;
      assert.deepEqual(rows,[{id}]);
    });
    await t.test('funded job is still rejected',async()=>{
      await db.exec("update app.jobs set payment_status='funded'");
      await assert.rejects(select(db),/job_already_paid/);
    });
  }finally{await db.close();}
});
