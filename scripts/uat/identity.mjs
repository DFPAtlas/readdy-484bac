export function assertOwnedUatUser(user, persona, runId) {
  if (!user?.id || user.app_metadata?.uat_run_id !== runId
      || user.app_metadata?.uat_persona !== persona.key
      || typeof user.email !== 'string' || user.email.toLowerCase() !== persona.email.toLowerCase()) {
    throw new Error(`Refusing to reuse an account without matching protected UAT provenance: ${persona.key}`);
  }
}

// Auth triggers can create guard shells for client personas too. Mark only rows
// owned by this already-verified synthetic Auth identity; never create a shell.
export async function markUatGuardProfiles(supabase, user, persona, runId) {
  assertOwnedUatUser(user, persona, runId);
  const { data, error } = await supabase.from('guards').update({ is_test_account: true })
    .eq('user_id', user.id).select('id, is_test_account');
  if (error || !Array.isArray(data) || (persona.kind === 'guard' && data.length !== 1)
      || data.some(row => !row.id || row.is_test_account !== true)) {
    throw new Error(`Test-account classification was not confirmed: ${persona.key}`);
  }
}
