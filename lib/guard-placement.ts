export interface GuardPlacement { id: string; profile_boost: boolean; priority_profile: boolean; }
export function compareGuardPlacement(a: Partial<GuardPlacement> & { id: string; rating?: number | null }, b: Partial<GuardPlacement> & { id: string; rating?: number | null }): number {
  return Number(b.profile_boost === true) - Number(a.profile_boost === true)
    || Number(b.priority_profile === true) - Number(a.priority_profile === true)
    || (b.rating || 0) - (a.rating || 0) || a.id.localeCompare(b.id);
}
export async function loadGuardPlacement(db: { rpc: (name: string, params: { p_guard_ids: string[] }) => PromiseLike<{ data: unknown; error: unknown }> }, ids: string[]): Promise<Map<string, GuardPlacement>> {
  const placements = new Map<string, GuardPlacement>();
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const { data, error } = await db.rpc('get_guard_placement', { p_guard_ids: batch });
    if (error || !Array.isArray(data)) throw new Error('Guard placement unavailable. Please refresh.');
    for (const row of data) {
      if (typeof row?.id !== 'string' || !batch.includes(row.id) || typeof row.profile_boost !== 'boolean' || typeof row.priority_profile !== 'boolean') throw new Error('Invalid guard placement.');
      placements.set(row.id, row);
    }
  }
  return placements;
}
