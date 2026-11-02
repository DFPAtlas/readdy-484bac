import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { listAccountStorageFiles, removeAccountStorageFiles, assertAccountStorageReferences } from '../admin-delete-user/storage-cleanup.ts';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
serve(async (req: Request) => {
 if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
 const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' }, auth: { persistSession: false } });
 const { data: valid, error: tokenError } = await db.rpc('validate_retention_worker_token', { p_token: req.headers.get('x-qg-retention-worker-token') || '' });
 if (tokenError || valid !== true) return json(401, { error: 'Unauthorized' });
 const summary = { completed: 0, failed: 0, closingRetried: 0 };
 try {
  const { data: closing, error: closingError } = await db.from('account_closures').select('id,user_id').eq('status', 'closing').limit(10);
  if (closingError) throw closingError;
  for (const row of closing || []) {
   const { error } = await db.auth.admin.updateUserById(row.user_id, { ban_duration: '876600h' });
   if (error) { summary.failed++; continue; }
   const { error: finishError } = await db.rpc('confirm_account_closure', { p_id: row.id });
   if (finishError) summary.failed++; else summary.closingRetried++;
  }
  const { data: tasks, error: claimError } = await db.rpc('claim_account_retention_tasks', { p_limit: 10 });
  if (claimError) throw claimError;
  for (const task of tasks || []) {
   try {
    const check = async () => {
     const { data, error } = await db.rpc('check_account_retention_claim', { p_id: task.id, p_token: task.lease_token });
     if (error || data !== true) throw new Error('Retention hold or invalid lease');
    };
    await check();
    const buckets = task.leased_stage === 'profile' ? ['avatars', 'guard-profiles'] : task.leased_stage === 'documents' ? ['sia-licences', 'guard-documents', 'ID-images'] : [];
    if (buckets.length) {
     const roots = [task.user_id, task.profile_id];
     const { data: profile, error: profileError } = await db.from(task.profile_type === 'guard' ? 'guards' : 'clients').select('*').eq('id', task.profile_id).maybeSingle();
     if (profileError || !profile) throw new Error('Cannot verify profile document ownership');
     assertAccountStorageReferences(profile, roots, task.leased_stage);
     const files = await listAccountStorageFiles(db, buckets, roots);
     await check();
     await removeAccountStorageFiles(db, files, async () => { await check(); }, check);
     if ((await listAccountStorageFiles(db, buckets, roots)).length) throw new Error('Storage files remain; retry required');
    }
    if (task.leased_stage === 'profile') {
     await check();
     const { data: authAccount, error: authReadError } = await db.auth.admin.getUserById(task.user_id);
     if (authReadError) throw authReadError;
     const clearedMetadata = Object.fromEntries(Object.keys(authAccount.user?.user_metadata || {}).map(key => [key, null]));
     const { error } = await db.auth.admin.updateUserById(task.user_id, { email: `closed-${task.user_id}@deleted.quickguard.invalid`, email_confirm: true, phone: '', user_metadata: clearedMetadata, ban_duration: '876600h' });
     if (error) throw error;
    }
    await check();
    const { error } = await db.rpc('finish_account_retention_task', { p_id: task.id, p_token: task.lease_token, p_error: null });
    if (error) throw error;
    summary.completed++;
   } catch (error: any) {
    summary.failed++;
    const { error: recordError } = await db.rpc('finish_account_retention_task', { p_id: task.id, p_token: task.lease_token, p_error: String(error.message || 'Purge failed').slice(0,300) });
    if (recordError) console.error('Retention failure could not be recorded', task.id);
   }
  }
  return json(summary.failed ? 207 : 200, { success: summary.failed === 0, ...summary });
 } catch (error: any) { return json(500, { error: error.message || 'Retention worker failed', ...summary }); }
});
