import { supabase } from './supabase';
export interface ContractVersion { id: string; title: string; terms: string; content_sha256: string; created_at: string; }
export interface ContractSettings { client_id: string; allowed: boolean; default_template_id: string | null; templates: ContractVersion[]; }
export interface JobContract { title: string; terms: string; content_sha256: string; attached_at: string; accepted_at: string | null; }
export interface ContractAcceptance { guard_id: string; guard_name: string; accepted_at: string; }
export interface JobContractDetail { job_id: string; contract: JobContract | null; can_accept: boolean; acceptances: ContractAcceptance[]; }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nullable = (value: unknown): value is string | null => value === null || text(value);
async function call(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
  const before = await supabase.auth.getUser();
  if (before.error || before.data.user?.id !== userId) throw new Error('Your account changed. Reload this page.');
  const result = await supabase.schema('app').rpc(name, args);
  const after = await supabase.auth.getUser();
  if (after.error || after.data.user?.id !== userId) throw new Error('Your account changed. Reload this page.');
  if (result.error) throw new Error('Contract request could not be confirmed. Reload or retry the same request.');
  return result.data;
}
export function parseContractSettings(raw: unknown, clientId: string): ContractSettings {
  if (!record(raw) || raw.client_id !== clientId || typeof raw.allowed !== 'boolean' || !nullable(raw.default_template_id) || !Array.isArray(raw.templates)) throw new Error('Contract settings could not be confirmed.');
  const templates = raw.templates.map((item: unknown): ContractVersion => {
    if (!record(item) || !text(item.id) || !text(item.title) || !text(item.terms) || !text(item.content_sha256) || !/^[a-f0-9]{64}$/.test(item.content_sha256) || !text(item.created_at)) throw new Error('Contract version could not be confirmed.');
    return { id: item.id, title: item.title, terms: item.terms, content_sha256: item.content_sha256, created_at: item.created_at };
  });
  return { client_id: clientId, allowed: raw.allowed, default_template_id: raw.default_template_id, templates };
}
export async function readContractSettings(userId: string, clientId: string) { return parseContractSettings(await call('get_my_contract_settings', {}, userId), clientId); }
export async function saveContractVersion(userId: string, clientId: string, intent: { id: string; title: string; terms: string; expected: string | null }) {
  const raw = await call('save_my_contract_template', { p_id: intent.id, p_title: intent.title, p_terms: intent.terms, p_expected_default: intent.expected }, userId);
  if (!record(raw) || raw.saved_id !== intent.id) throw new Error('Saved version could not be confirmed. Retry the same request.');
  return parseContractSettings(raw, clientId);
}
export async function setDefaultContract(userId: string, clientId: string, id: string | null, expected: string | null) { return parseContractSettings(await call('set_my_default_contract', { p_template_id: id, p_expected_default: expected }, userId), clientId); }
function jobDetail(raw: unknown, jobId: string): JobContractDetail {
  if (!record(raw) || raw.job_id !== jobId) throw new Error('Job contract could not be confirmed.');
  if (raw.contract === null) return { job_id: jobId, contract: null, can_accept: false, acceptances: [] };
  const c = raw.contract;
  if (!record(c) || !text(c.title) || !text(c.terms) || !text(c.content_sha256) || !/^[a-f0-9]{64}$/.test(c.content_sha256) || !text(c.attached_at) || !nullable(c.accepted_at) || typeof raw.can_accept !== 'boolean') throw new Error('Job contract could not be confirmed.');
  if (!Array.isArray(raw.acceptances)) throw new Error('Acceptance records could not be confirmed.');
  const acceptances = raw.acceptances.map((value: unknown): ContractAcceptance => {
    if (!record(value) || !text(value.guard_id) || !text(value.guard_name) || !text(value.accepted_at)) throw new Error('Acceptance record could not be confirmed.');
    return { guard_id: value.guard_id, guard_name: value.guard_name, accepted_at: value.accepted_at };
  });
  return { job_id: jobId, can_accept: raw.can_accept, acceptances, contract: { title: c.title, terms: c.terms, content_sha256: c.content_sha256, attached_at: c.attached_at, accepted_at: c.accepted_at } };
}
export async function readJobContract(userId: string, jobId: string) { return jobDetail(await call('get_job_contract', { p_job_id: jobId }, userId), jobId); }
export async function acceptJobContract(userId: string, jobId: string, sha: string) {
  const detail = jobDetail(await call('accept_job_contract', { p_job_id: jobId, p_expected_sha256: sha }, userId), jobId);
  if (detail.contract?.content_sha256 !== sha || !detail.contract.accepted_at) throw new Error('Acceptance could not be confirmed. Reload before retrying.');
  return detail;
}
