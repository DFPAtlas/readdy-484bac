export type AgentKey = 'payments' | 'sia' | 'jobs';
export type AgentStatus = 'ok' | 'warn' | 'fail';
interface AgentCheck { key: string; label: string; status: AgentStatus; detail: string; }
export interface AgentResult { agent: AgentKey; label: string; status: AgentStatus; summary: string; checks: AgentCheck[]; }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function status(value: unknown): value is AgentStatus {
  return value === 'ok' || value === 'warn' || value === 'fail';
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseAgentResult(value: unknown, agent: AgentKey, now = Date.now()): AgentResult {
  const invalid = () => new Error('The agent monitor returned an invalid or outdated result. Please retry.');
  if (!record(value) || (value.error !== undefined && value.error !== null) || value.site !== 'quickguard.uk' || !status(value.status)
    || typeof value.checked_at !== 'string' || !Array.isArray(value.results) || value.results.length !== 1) throw invalid();
  const checked = Date.parse(value.checked_at);
  if (!Number.isFinite(checked) || checked < now - 5 * 60_000 || checked > now + 5 * 60_000) throw invalid();
  const result: unknown = value.results[0];
  if (!record(result) || result.agent !== agent || !status(result.status) || result.status !== value.status
    || !text(result.label) || !text(result.summary) || !Array.isArray(result.checks) || result.checks.length === 0) throw invalid();
  const checks: AgentCheck[] = [];
  const keys = new Set<string>();
  for (const check of result.checks) {
    if (!record(check) || !text(check.key) || keys.has(check.key) || !text(check.label) || !status(check.status) || !text(check.detail)) throw invalid();
    keys.add(check.key);
    checks.push({ key: check.key, label: check.label, status: check.status, detail: check.detail });
  }
  const aggregate = checks.some(check => check.status === 'fail') ? 'fail' : checks.some(check => check.status === 'warn') ? 'warn' : 'ok';
  const health = aggregate === 'ok' ? 'healthy' : aggregate === 'warn' ? 'degraded' : 'unhealthy';
  if (result.status !== aggregate || value.health !== health) throw invalid();
  return { agent, label: result.label, status: result.status, summary: result.summary, checks };
}
