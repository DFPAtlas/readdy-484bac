import { createClient } from '@supabase/supabase-js';
import { DEFAULT_RUN_ID } from './personas.mjs';

const EXPECTED_PROJECT = 'vnywjfpkepjgclkbcmsj';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = process.env.QG_UAT_RUN_ID || DEFAULT_RUN_ID;
const confirmed = process.env.QG_UAT_CONFIRM_CLEANUP === runId;

if (!url || !url.includes(EXPECTED_PROJECT)) throw new Error(`Refusing to clean a project other than QuickGuard ${EXPECTED_PROJECT}`);
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
if (!confirmed) throw new Error(`Set QG_UAT_CONFIRM_CLEANUP=${runId} to confirm cleanup`);

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const targets = [];
for (let page = 1; page <= 20; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  targets.push(...data.users.filter((user) => user.app_metadata?.uat_run_id === runId));
  if (data.users.length < 100) break;
}

for (const user of targets) {
  const { error } = await supabase.auth.admin.deleteUser(user.id, false);
  if (error) throw new Error(`Failed to delete ${user.id}: ${error.message}`);
}

console.log(JSON.stringify({ runId, deletedUsers: targets.map((user) => ({ id: user.id, email: user.email })) }, null, 2));

