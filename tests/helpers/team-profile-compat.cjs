const fs = require('node:fs');

// Exercise the deployed role resolver, rather than replacing it with a mock.
async function installTeamProfileCompatibility(db, { management = false } = {}) {
  const source = fs.readFileSync('supabase/migrations/20261120183707_quickguard_profile_role_compatibility.sql', 'utf8');
  await db.exec(source.slice(0, source.indexOf('create or replace function app.get_my_message_partners')));
  const migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_client_team_profile_role_compatibility.sql'));
  const sql = fs.readFileSync('supabase/migrations/' + migration, 'utf8');
  await db.exec(management ? sql : sql.slice(sql.indexOf('create or replace function app.get_my_team_features')));
}
module.exports = { installTeamProfileCompatibility };
