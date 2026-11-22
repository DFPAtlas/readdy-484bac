export interface InfrastructureSnapshot {
  tables: { schema_name: string; table_name: string; rls_enabled: boolean; public_access: boolean }[];
  policies: { schema_name: string; table_name: string; policy_count: number }[];
  indexes: { schema_name: string; table_name: string; index_count: number }[];
}
export interface InfrastructureBucket { id: string; name: string; public: boolean; created_at: string; }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function identity(value: unknown): value is Record<string, unknown> {
  return record(value) && typeof value.schema_name === 'string' && typeof value.table_name === 'string';
}
export function isInfrastructureBuckets(value: unknown): value is InfrastructureBucket[] {
  return Array.isArray(value) && value.every(b => record(b) && typeof b.id === 'string' && typeof b.name === 'string'
    && typeof b.public === 'boolean' && typeof b.created_at === 'string');
}
export function isInfrastructureSnapshot(value: unknown): value is InfrastructureSnapshot {
  return record(value) && Array.isArray(value.tables) && Array.isArray(value.policies) && Array.isArray(value.indexes)
    && value.tables.some(t => record(t) && t.schema_name === 'app')
    && value.tables.every(t => identity(t) && typeof t.rls_enabled === 'boolean' && typeof t.public_access === 'boolean')
    && value.policies.every(p => identity(p) && Number.isSafeInteger(p.policy_count) && Number(p.policy_count) >= 0)
    && value.indexes.every(i => identity(i) && Number.isSafeInteger(i.index_count) && Number(i.index_count) >= 0);
}
