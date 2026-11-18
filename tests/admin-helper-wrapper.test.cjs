const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/20261118102747_delegate_public_admin_helper.sql', 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function fixture() {
  const db = new PGlite();
  const body = `SELECT EXISTS (SELECT 1 FROM app.admin_users WHERE user_id = auth.uid() AND is_active = true)
    AND (COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2');`;
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA app; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA app,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE TABLE app.admin_users(user_id uuid, is_active boolean);
    CREATE TABLE app.payment_events(user_id uuid, amount integer);
    INSERT INTO app.admin_users VALUES('${id(3)}',true),('${id(4)}',false);
    INSERT INTO app.payment_events VALUES('${id(1)}',10),('${id(2)}',20);
    CREATE FUNCTION app.is_active_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=app,pg_catalog AS $$ ${body} $$;
    CREATE FUNCTION public.is_active_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=app,pg_catalog AS $$ ${body} $$;
    REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated,service_role;
    GRANT SELECT ON app.admin_users TO authenticated;
    GRANT SELECT,UPDATE ON app.payment_events TO authenticated,service_role;
    ALTER TABLE app.admin_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app.payment_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY admin_read ON app.admin_users TO authenticated USING(public.is_active_admin());
    CREATE POLICY own_or_admin ON app.payment_events FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_active_admin());
    CREATE POLICY admin_update ON app.payment_events FOR UPDATE TO authenticated USING(public.is_active_admin()) WITH CHECK(public.is_active_admin());
    CREATE FUNCTION public.legacy_admin_caller() RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$ BEGIN RETURN public.is_active_admin(); END; $$;
  `);
  return db;
}

async function actor(db, user, aal = 'aal2', role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify(user ? { sub: id(user), aal, role } : {})]);
  await db.exec(`SET ROLE ${role}`);
}
async function state(db) {
  return (await db.query(`SELECT p.oid,p.proowner,p.proacl::text,p.prosecdef,
    (SELECT count(*)::int FROM pg_depend d WHERE d.refobjid=p.oid) AS dependencies
    FROM pg_proc p WHERE p.oid='public.is_active_admin()'::regprocedure`)).rows[0];
}

test('invoker delegate preserves caller identity, MFA decisions, policy dependencies, grants and owned payment reads', async () => {
  const db = await fixture();
  try {
    const before = await state(db);
    const cases = [[1,'aal2',false,1], [2,'aal2',false,1], [3,'aal1',false,0], [3,'aal2',true,2], [4,'aal2',false,0], [null,'aal2',false,0]];
    const exercise = async () => {
      for (const [user,aal,expected,visible] of cases) {
        await actor(db,user,aal);
        const result = (await db.query('SELECT public.is_active_admin() legacy,app.is_active_admin() canonical,public.legacy_admin_caller() routine')).rows[0];
        assert.deepEqual(result,{legacy:expected,canonical:expected,routine:expected});
        assert.equal((await db.query('SELECT count(*)::int AS n FROM app.payment_events')).rows[0].n,visible);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM app.admin_users')).rows[0].n,expected ? 2 : 0);
        assert.equal((await db.query('UPDATE app.payment_events SET amount=amount RETURNING user_id')).rows.length,expected ? 2 : 0);
      }
      await actor(db,null,'aal1','anon');
      await assert.rejects(db.query('SELECT public.is_active_admin()'),err=>err.code==='42501');
      await actor(db,null,'aal1','service_role');
      assert.equal((await db.query('SELECT public.is_active_admin() value')).rows[0].value,false);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM app.payment_events')).rows[0].n,2);
    };
    await exercise(); await db.exec('RESET ROLE; BEGIN'); await db.exec(migration); await db.exec('COMMIT');
    const after = await state(db);
    assert.deepEqual({...after,prosecdef:before.prosecdef},before);
    assert.equal(after.prosecdef,false);
    await exercise();
    await db.exec('RESET ROLE; BEGIN'); await db.exec(migration); await db.exec('COMMIT');
    assert.deepEqual(await state(db),after,'reapplication preserves the same function identity and dependencies');
  } finally { await db.close(); }
});

test('migration aborts if the canonical helper differs or cannot be called, without changing legacy privileges', async () => {
  const db = await fixture();
  try {
    const before = await state(db);
    await db.exec("ALTER FUNCTION app.is_active_admin() SECURITY INVOKER; BEGIN");
    await assert.rejects(db.exec(migration),/contract differs/); await db.exec('ROLLBACK');
    assert.deepEqual(await state(db),before);
    await db.exec('ALTER FUNCTION app.is_active_admin() SECURITY DEFINER; REVOKE ALL ON FUNCTION app.is_active_admin() FROM PUBLIC; BEGIN');
    await assert.rejects(db.exec(migration),/cannot execute/); await db.exec('ROLLBACK');
    assert.deepEqual(await state(db),before);
    await db.exec("GRANT EXECUTE ON FUNCTION app.is_active_admin() TO authenticated,service_role; CREATE OR REPLACE FUNCTION public.is_active_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS 'SELECT true;'; BEGIN");
    await assert.rejects(db.exec(migration),/bodies differ/); await db.exec('ROLLBACK');
    assert.equal((await state(db)).prosecdef,true);
  } finally { await db.close(); }
});
