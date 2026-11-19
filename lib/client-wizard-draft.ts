/** Restore only recognised form fields; never restore identity or submission state. */
export function restoreWizardDraft<T extends Record<string, any>>(defaults: T, raw: unknown): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This saved wizard draft is unavailable or invalid.');
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (raw as Record<string, unknown>)[key as string];
    if (Array.isArray(defaults[key])) {
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) result[key] = [...value] as T[keyof T];
    } else if (typeof value === typeof defaults[key]) result[key] = value as T[keyof T];
  }
  return result;
}

export async function loadOwnedWizardDraft(db: any, clientId: string, draftId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) throw new Error('Invalid saved wizard draft.');
  const { data, error } = await db.schema('app').from('job_drafts').select('id, form_data')
    .eq('client_id', clientId).eq('id', draftId).maybeSingle();
  if (error || !data) throw new Error('This saved wizard draft could not be loaded. Open Saved Wizard Drafts to try again.');
  return data;
}
