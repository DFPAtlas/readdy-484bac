/** Normalize a to-one embed from untyped Supabase queries. */
export function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function requiredRelation<T>(value: T | T[] | null | undefined): T {
  const row = oneRelation(value);
  if (row === null) throw new Error('Required related record is unavailable');
  return row;
}
