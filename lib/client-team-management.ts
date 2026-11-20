import { CLIENT_FEATURE_KEYS } from './entitlements';

export type TeamScope = { userId: string; clientId: string };
export type TeamMember = { configId: string; userId: string; email: string | null; fullName: string | null; enabledFeatures: string[]; available: boolean };
export type TeamCandidate = { userId: string; email: string; fullName: string | null };
export type TeamData = { companyName: string; tier: string; allowedFeatures: string[]; members: TeamMember[]; revision: number };
export type TeamChange = { operationId: string; expectedRevision: number; action: 'add' | 'update' | 'remove'; memberId: string; configId: string; email?: string; enabledFeatures?: string[]; expectedFeatures?: string[] };
export class TeamRequestError extends Error {
  constructor(message: string, public uncertain = false) { super(message); this.name = 'TeamRequestError'; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validTeamEmail(value: string) { return value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function id(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function textOrNull(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
async function timed<T>(work: PromiseLike<T>, milliseconds: number, abort?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(work), new Promise<never>((_,reject) => {
      timer = setTimeout(() => { abort?.(); reject(new Error('Request timed out')); }, milliseconds);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function features(value: unknown, owner = false): string[] {
  if (!Array.isArray(value) || value.length > 64 || value.some(v => typeof v !== 'string' || !v || v.length > 100 || (owner && !(CLIENT_FEATURE_KEYS as readonly string[]).includes(v)))) throw new TeamRequestError('Team settings could not be confirmed. Reload your team.');
  return [...new Set(value)].sort();
}
async function actor(db: any, scope: TeamScope) {
  try {
    const { data, error }: any = await timed(db.auth.getUser(),10000);
    if (error || data?.user?.id !== scope.userId) throw new TeamRequestError('Your sign-in changed. Reload your team.');
  } catch { throw new TeamRequestError('Your sign-in could not be checked. Reload your team.'); }
}
async function request(db: any, scope: TeamScope, action: string, extra: Record<string, unknown> = {}) {
  if (!id(scope.userId) || !id(scope.clientId)) throw new TeamRequestError('Your company context is unavailable. Sign in again.');
  await actor(db, scope);
  const requestId = crypto.randomUUID();
  const writing = ['add','update','remove'].includes(action);
  let response: any;
  const unconfirmed = writing ? 'The request could not be confirmed. Retry the same change.' : 'Team data could not be loaded. Retry.';
  try {
    const controller = new AbortController();
    const query = db.schema('app').rpc('manage_my_client_team', { p_request: {
      ...extra, action, request_id: requestId, expected_user_id: scope.userId, expected_client_id: scope.clientId,
    } });
    response = await timed(typeof query.abortSignal === 'function' ? query.abortSignal(controller.signal) : query,20000,() => controller.abort());
  } catch { throw new TeamRequestError(unconfirmed, writing); }
  if (response?.error) {
    const definite = /^(22|23|40|42)|^P0001$|^57014$/.test(response.error.code || '');
    const safeMessages = ['An active owned Team Access plan is required','Account context changed. Reload your team','Company context changed. Reload your team','Team changed while loading. Retry','Team changed elsewhere. Reload before saving','Team settings changed elsewhere. Reload before saving','Team member context changed. Reload your team','Member account changed or is unavailable. Reload and search again','Account is not available to add','Your current plan cannot enable that feature','Stored feature settings need review','Team member changed. Reload before saving'];
    const message = safeMessages.includes(response.error.message) ? response.error.message : 'Team request was not accepted. Reload and try again.';
    throw new TeamRequestError(definite ? message : unconfirmed, writing && !definite);
  }
  try { await actor(db, scope); } catch { throw new TeamRequestError('Your sign-in changed while the request was running. Reload your team.', writing); }
  const data = response?.data;
  if (!data || data.request_id !== requestId || data.action !== action || data.owner_user_id !== scope.userId || data.client_id !== scope.clientId
      || !textOrNull(data.company_name) || !textOrNull(data.subscription_tier) || !Number.isSafeInteger(data.team_revision) || data.team_revision<0) throw new TeamRequestError('The returned team result could not be confirmed. Retry the same change.', writing);
  try { features(data.allowed_features, true); } catch { throw new TeamRequestError('The returned team result could not be confirmed. Retry the same change.', writing); }
  return data;
}
export async function loadClientTeam(db: any, scope: TeamScope): Promise<TeamData> {
  const members: TeamMember[] = [];
  let after: string | null = null, metadata = '';
  let result: TeamData | null = null;
  for (let page = 0; page < 50; page++) {
    const data = await request(db, scope, 'list', { after_id: after, ...(result ? { expected_revision: result.revision } : {}) });
    const allowed = features(data.allowed_features, true);
    const signature = JSON.stringify([data.company_name, data.subscription_tier, allowed, data.team_revision]);
    if (page && metadata !== signature) throw new TeamRequestError('Team details changed while loading. Retry.');
    metadata = signature;
    result = { companyName: data.company_name || 'Client', tier: data.subscription_tier || 'Free', allowedFeatures: allowed, members, revision: data.team_revision };
    if (!Array.isArray(data.members) || data.members.length > 200 || typeof data.has_more !== 'boolean') throw new TeamRequestError('The member list could not be confirmed. Retry.');
    for (const row of data.members) {
      if (!id(row.config_id) || !id(row.member_user_id) || row.member_user_id === scope.userId || row.owner_user_id !== scope.userId
          || !textOrNull(row.email) || !textOrNull(row.full_name) || typeof row.member_available !== 'boolean'
          || (after && row.config_id <= after) || members.some(m => m.configId === row.config_id || m.userId === row.member_user_id)) throw new TeamRequestError('The member list changed or could not be confirmed. Retry.');
      after = row.config_id;
      members.push({ configId: row.config_id, userId: row.member_user_id, email: row.email, fullName: row.full_name, enabledFeatures: features(row.enabled_features), available: row.member_available });
    }
    if (!data.has_more) {
      if (data.next_after_id !== null) throw new TeamRequestError('The member list cursor could not be confirmed. Retry.');
      return result;
    }
    if (!data.members.length || data.next_after_id !== after) throw new TeamRequestError('The member list is incomplete. Retry.');
  }
  throw new TeamRequestError('The team is too large to load safely. Contact support.');
}
export async function searchClientTeamCandidate(db: any, scope: TeamScope, email: string): Promise<TeamCandidate[]> {
  if (!validTeamEmail(email)) throw new TeamRequestError('Enter the full email address of an existing client.');
  const normal = email.trim().toLowerCase();
  const data = await request(db, scope, 'search', { email: normal });
  if (!Array.isArray(data.candidates) || data.candidates.length > 1) throw new TeamRequestError('Search results could not be confirmed. Retry.');
  return data.candidates.map((row: any) => {
    if (!id(row.member_user_id) || row.member_user_id === scope.userId || typeof row.email !== 'string' || row.email.trim().toLowerCase() !== normal || !textOrNull(row.full_name)) throw new TeamRequestError('Search results could not be confirmed. Retry.');
    return { userId: row.member_user_id, email: row.email, fullName: row.full_name };
  });
}
export function newTeamChange(action: TeamChange['action'], member: TeamCandidate | TeamMember, revision: number, enabledFeatures?: string[]): TeamChange {
  if (action === 'add') return { action, operationId: crypto.randomUUID(), expectedRevision: revision, memberId: member.userId, configId: crypto.randomUUID(), email: member.email || '' };
  if (!('configId' in member)) throw new TeamRequestError('Member context is unavailable. Reload.');
  return { action, operationId: crypto.randomUUID(), expectedRevision: revision, memberId: member.userId, configId: member.configId,
    ...(action === 'update' ? { expectedFeatures: [...member.enabledFeatures], enabledFeatures: [...(enabledFeatures || [])] } : {}) };
}
export async function applyClientTeamChange(db: any, scope: TeamScope, change: TeamChange): Promise<void> {
  if (!id(change.operationId) || !id(change.configId) || !id(change.memberId) || change.memberId === scope.userId || !Number.isSafeInteger(change.expectedRevision) || change.expectedRevision<0) throw new TeamRequestError('Invalid member change. Reload.');
  if (change.action === 'add' && !validTeamEmail(change.email || '')) throw new TeamRequestError('Search for the member again.');
  const data = await request(db, scope, change.action, { operation_id: change.operationId, expected_revision: change.expectedRevision, config_id: change.configId, member_user_id: change.memberId,
    ...(change.action === 'add' ? { email: change.email?.trim().toLowerCase() } : {}),
    ...(change.action === 'update' ? { enabled_features: features(change.enabledFeatures), expected_features: features(change.expectedFeatures) } : {}),
  });
  const outcomes = { add: ['added','already_present'], update: ['updated'], remove: ['removed','already_absent'] };
  if (data.operation_id !== change.operationId || data.committed !== true || data.member_user_id !== change.memberId || !id(data.config_id)
      || (data.config_id !== change.configId && !(change.action === 'add' && data.outcome === 'already_present'))
      || !outcomes[change.action].includes(data.outcome) || typeof data.replayed !== 'boolean' || data.operation_revision !== change.expectedRevision+1) throw new TeamRequestError('The change could not be confirmed. Retry the same change.', true);
}
