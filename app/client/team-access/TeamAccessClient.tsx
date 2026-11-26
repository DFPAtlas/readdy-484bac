'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/lib/ClientAuthContext';
import PortalSidebar from '@/components/PortalSidebar';
import { loadClientTeam, searchClientTeamCandidate, applyClientTeamChange, newTeamChange, validTeamEmail, TeamRequestError, type TeamData, type TeamCandidate, type TeamChange } from '@/lib/client-team-management';

const FEATURE_LABELS: Record<string,string> = {
  'client.post_job':'Post Jobs', 'client.view_guard_profiles':'View Guard Profiles', 'client.advanced_matching':'Advanced Matching',
  'client.priority_support':'Priority Support', 'client.job_templates':'Job Templates', 'client.analytics_dashboard':'Analytics Dashboard',
  'client.direct_contact':'Direct Contact', 'client.unlimited_jobs':'Unlimited Jobs', 'client.bulk_posting':'Bulk Posting',
  'client.multi_site':'Multi-Site', 'client.team_access':'Team Access', 'client.custom_contracts':'Custom Contracts',
  'client.api_access':'API Access', 'client.escrow_payments':'Card Payments', 'client.job_history':'Job History', 'client.job_tracker':'Job Tracker',
};
const buttonClass = 'px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be confirmed. Retry.';

export default function TeamAccessClient() {
  const router = useRouter();
  const { userId, clientId, isLoaded, companyName, subscriptionTier } = useClientAuth();
  const scopeKey = `${userId || ''}:${clientId || ''}`;
  const [data, setData] = useState<{ key: string; value: TeamData } | null>(null);
  const [status, setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TeamChange | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<TeamCandidate[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [authVersion, setAuthVersion] = useState(0);
  const mounted = useRef(false), epoch = useRef(0), reads = useRef(0), searches = useRef(0);
  const activeKey = useRef(scopeKey), busyRef = useRef<string | null>(null), pendingRef = useRef<TeamChange | null>(null);
  const authId = useRef<string | null | undefined>(undefined);
  if (activeKey.current !== scopeKey) { activeKey.current = scopeKey; epoch.current++; }
  const current = useCallback((generation: number) => mounted.current && epoch.current === generation && activeKey.current === scopeKey, [scopeKey]);
  const retire = useCallback(() => { mounted.current = false; epoch.current++; reads.current++; searches.current++; }, []);
  const shown = data?.key === scopeKey ? data.value : null;

  const load = useCallback(async () => {
    if (!userId || !clientId || !mounted.current) return false;
    const generation = epoch.current, read = ++reads.current;
    searches.current++; setCandidates([]); setSearchStatus('idle'); setSearchError(null);
    setStatus('loading'); setListError(null);
    try {
      const value = await loadClientTeam(supabase, { userId, clientId });
      if (!current(generation) || read !== reads.current) return false;
      setData({ key: scopeKey, value }); setStatus('ready'); setReloadRequired(false);
      if (!pendingRef.current) setActionError(null);
      return true;
    } catch (error) {
      if (current(generation) && read === reads.current) { setListError(errorText(error)); setStatus('error'); }
      return false;
    }
  }, [userId, clientId, current, scopeKey]);

  useEffect(() => {
    mounted.current = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id || null;
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && nextId !== (authId.current === undefined ? userId : authId.current))) {
        authId.current = nextId; epoch.current++; reads.current++; searches.current++;
        busyRef.current = null; pendingRef.current = null;
        setData(null); setBusy(false); setPending(null); setShowAdd(false); setQuery(''); setCandidates([]); setRemoveId(null); setSuccess(null); setActionError(null);
        setAuthVersion(v => v + 1);
      } else if (event === 'SIGNED_IN') authId.current = nextId;
    });
    return () => { retire(); listener.subscription.unsubscribe(); };
  }, [userId, retire]);

  useEffect(() => {
    epoch.current++; reads.current++; searches.current++;
    busyRef.current = null; pendingRef.current = null;
    setData(null); setPending(null); setBusy(false); setShowAdd(false); setQuery(''); setCandidates([]); setSearchStatus('idle'); setSearchError(null);
    setRemoveId(null); setActionError(null); setSuccess(null); setReloadRequired(false); setListError(null); setStatus('loading');
    if (!isLoaded) return;
    if (!userId) { router.push('/client/login'); return; }
    if (!clientId) { setListError('Your company profile is unavailable. Sign in again.'); setStatus('error'); return; }
    void load();
  }, [isLoaded, userId, clientId, authVersion, router, load]);

  const locked = busy || !!pending;
  const canChange = status === 'ready' && !!shown && !reloadRequired && !locked;
  const closeAdd = () => {
    if (busyRef.current || pendingRef.current) return;
    searches.current++; setShowAdd(false); setQuery(''); setCandidates([]); setSearchStatus('idle'); setSearchError(null);
  };
  const search = async () => {
    if (!canChange || !userId || !clientId || !validTeamEmail(query)) return;
    const generation = epoch.current, read = ++searches.current, email = query.trim();
    setCandidates([]); setSearchError(null); setSearchStatus('loading');
    try {
      const rows = await searchClientTeamCandidate(supabase, { userId, clientId }, email);
      if (current(generation) && read === searches.current) { setCandidates(rows); setSearchStatus('ready'); }
    } catch (error) {
      if (current(generation) && read === searches.current) { setSearchError(errorText(error)); setSearchStatus('error'); }
    }
  };
  const change = async (operation: TeamChange, retry = false) => {
    if (!userId || !clientId || busyRef.current || (!retry && (pendingRef.current || !canChange))) return;
    if (retry && pendingRef.current?.operationId !== operation.operationId) return;
    const generation = epoch.current, wasUncertain = !!pendingRef.current;
    busyRef.current = operation.operationId; pendingRef.current = operation;
    setBusy(true); setPending(operation); setActionError(null); setSuccess(null);
    try {
      await applyClientTeamChange(supabase, { userId, clientId }, operation);
      if (!current(generation)) return;
      pendingRef.current = null; setPending(null); setActionError(null); setSuccess('Change confirmed. Refreshing your team…');
      searches.current++; setShowAdd(false); setQuery(''); setCandidates([]); setSearchStatus('idle'); setRemoveId(null);
      const refreshed = await load();
      if (current(generation)) setSuccess(refreshed ? 'Change confirmed. Your current team is shown below.' : 'Change confirmed. Reload your team before making another change.');
    } catch (error) {
      if (!current(generation)) return;
      const uncertain = wasUncertain || !(error instanceof TeamRequestError) || error.uncertain;
      setActionError(errorText(error));
      if (!uncertain) { pendingRef.current = null; setPending(null); setReloadRequired(true); }
    } finally {
      if (busyRef.current === operation.operationId) { busyRef.current = null; if (current(generation)) setBusy(false); }
    }
  };
  const actionAlert = actionError && <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200 space-y-3">
    <p>{actionError}</p>
    {pending ? <><p>The outcome is not confirmed. Retry this same change before making another change.</p><button className={buttonClass} disabled={busy} onClick={() => void change(pending,true)}>{busy ? 'Checking change…' : 'Retry change'}</button></>
      : <p>Reload your team before trying another change.</p>}
  </div>;

  if (!isLoaded || (authId.current !== undefined && authId.current !== userId)) return <div className="min-h-screen bg-[#0B1933] flex items-center justify-center text-slate-300">Checking account…</div>;
  return <>
    <div aria-hidden={showAdd || undefined} className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar role="client" displayName={shown?.companyName || companyName || 'Client'} subtitle={shown?.tier || subscriptionTier || 'Free'} initials={(shown?.companyName || companyName || 'Client').slice(0,2).toUpperCase()} />
      <main className="flex-1 p-6 lg:p-8 text-slate-200"><div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">Team Access</h1><p className="text-sm text-slate-400 mt-1">Manage existing client accounts and their feature access.</p></div>
          <div className="flex gap-2"><button className={buttonClass} disabled={locked || status === 'loading'} onClick={() => void load()}>Reload team</button>
          <button className={buttonClass} disabled={!canChange} onClick={() => { setShowAdd(true); setSuccess(null); }}>Add Team Member</button></div></header>
        {listError && <div role="alert" className="p-4 rounded-xl border border-red-500/30 bg-red-500/10"><p>{listError}</p><button className={`${buttonClass} mt-3`} disabled={locked} onClick={() => void load()}>Retry loading team</button></div>}
        {actionAlert}
        {success && <p role="status" className="text-teal-300">{success}</p>}
        {reloadRequired && <p className="text-amber-200">Your displayed settings may be out of date. Reload before making changes.</p>}
        {status === 'loading' && <p role="status">{shown ? 'Refreshing team…' : 'Loading team…'}</p>}
        {status === 'ready' && shown?.members.length === 0 && <section className="bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl p-10 text-center"><h2 className="text-lg font-semibold">No team members yet</h2><p className="text-slate-400 mt-2">Add an existing client account by its full email address.</p></section>}
        {shown?.members.map(member => {
          const name = member.fullName || member.email || 'Account unavailable';
          const keys = [...new Set([...shown.allowedFeatures,...member.enabledFeatures])].sort();
          return <section key={member.configId} className="bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl overflow-hidden">
            <div className="p-5 flex justify-between gap-4"><div><h2 className="font-semibold text-white">{name}</h2><p className="text-sm text-slate-400">{member.email || 'Email unavailable'}</p><p className="text-xs text-slate-400 mt-1">{member.enabledFeatures.length} saved features{!member.available ? ' · Account unavailable for feature changes' : ''}</p></div>
              <button className={buttonClass} disabled={!canChange} onClick={() => setRemoveId(removeId === member.configId ? null : member.configId)}>Remove member</button></div>
            {removeId === member.configId && <div className="p-4 bg-red-500/10 flex flex-wrap justify-between gap-3"><p>Remove {name} from your team?</p><div className="flex gap-2"><button className={buttonClass} disabled={locked} onClick={() => setRemoveId(null)}>Cancel removal</button><button className={buttonClass} disabled={!canChange} onClick={() => void change(newTeamChange('remove',member,shown.revision))}>Confirm removal</button></div></div>}
            <div className="p-5 border-t border-[#1a2b4a] grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{keys.map(key => {
              const enabled = member.enabledFeatures.includes(key), allowed = shown.allowedFeatures.includes(key);
              const label = Object.prototype.hasOwnProperty.call(FEATURE_LABELS,key) ? FEATURE_LABELS[key] : key;
              return <div key={key} className="p-3 bg-[#0a1525] rounded-xl flex justify-between items-center gap-3"><span className="text-sm">{label}{!allowed && <small className="block text-amber-300">Not on current plan</small>}</span>
                <button type="button" role="switch" aria-label={`${label} for ${name}`} aria-checked={enabled} disabled={!canChange || !member.available || (!enabled && !allowed)}
                  onClick={() => void change(newTeamChange('update',member,shown.revision,enabled ? member.enabledFeatures.filter(k => k !== key) : [...member.enabledFeatures,key]))}
                  className={`rounded-full w-12 py-1 text-xs disabled:opacity-40 ${enabled ? 'bg-teal-600' : 'bg-slate-700'}`}>{enabled ? 'On' : 'Off'}</button></div>;
            })}</div>
          </section>;
        })}
      </div></main>
    </div>
    {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') closeAdd(); }}>
      <div className="absolute inset-0 bg-black/70" onClick={closeAdd} />
      <div role="dialog" aria-modal="true" aria-labelledby="team-add-heading" className="relative bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl w-full max-w-lg p-6 text-slate-200 space-y-4">
        <div className="flex justify-between"><h2 id="team-add-heading" className="text-lg font-semibold">Add Team Member</h2><button aria-label="Close add member" disabled={locked} onClick={closeAdd}>Close</button></div>
        <p className="text-sm text-slate-400">Enter the full, verified email address of an existing client account. New members start with no delegated features.</p>
        <form onSubmit={e => { e.preventDefault(); void search(); }} className="space-y-3"><label className="block text-sm" htmlFor="team-email">Client email</label>
          <input id="team-email" type="email" required maxLength={254} autoFocus value={query} disabled={locked} placeholder="name@company.com" onChange={e => { searches.current++; setQuery(e.target.value); setCandidates([]); setSearchStatus('idle'); setSearchError(null); }} className="w-full p-3 rounded-lg bg-[#0a1525] border border-[#1a2b4a]" />
          <button type="submit" className={buttonClass} disabled={!canChange || !validTeamEmail(query) || searchStatus === 'loading'}>{searchStatus === 'loading' ? 'Searching…' : 'Search'}</button></form>
        {searchError && <div role="alert"><p className="text-red-200">{searchError}</p><button className={`${buttonClass} mt-2`} disabled={!canChange || !validTeamEmail(query)} onClick={() => void search()}>Retry search</button></div>}
        {searchStatus === 'ready' && candidates.length === 0 && <p>No eligible client account matches that full email address.</p>}
        {candidates.map(candidate => <div key={candidate.userId} className="rounded-xl bg-[#0a1525] p-4 flex justify-between gap-3"><div><p>{candidate.fullName || 'Name unavailable'}</p><p className="text-sm text-slate-400">{candidate.email}</p></div><button className={buttonClass} disabled={!canChange} onClick={() => shown && void change(newTeamChange('add',candidate,shown.revision))}>Add member</button></div>)}
        {actionAlert}
        {busy && <p role="status">Saving and confirming change…</p>}
      </div>
    </div>}
  </>;
}
