'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import DecisionBanner from '../launch-readiness/DecisionBanner';
import CheckCard from '../launch-readiness/CheckCard';
import MapsPreview from '../launch-readiness/MapsPreview';
import ApprovalPanel from '../launch-readiness/ApprovalPanel';
import RetirementRegister from '../launch-readiness/RetirementRegister';
import type { Decision, LaunchCheck, SavedDecision, RetirementRecord, RetirementApproval, RetirementDecision } from '../launch-readiness/types';

async function extractEdgeError(error: any): Promise<string> {
  const ctx = error?.context;
  if (ctx) {
    if (typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) return parsed.error;
        if (parsed?.message) return parsed.message;
        if (typeof parsed === 'string' && parsed) return parsed;
      } catch { /* ignore */ }
    }
    if (ctx?.error) return ctx.error;
    if (ctx?.message) return ctx.message;
    if (typeof ctx === 'string' && ctx) return ctx;
  }
  return typeof error?.message === 'string' ? error.message : 'Edge function request failed';
}

function makeMapsKeyCheck(): LaunchCheck {
  const configured = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return {
    id: 'maps_embed_key',
    category: 'critical',
    label: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured',
    status: configured ? 'pass' : 'fail',
    method: 'auto',
    notes: configured ? 'Maps Embed API key is configured.' : 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.',
    instruction: null,
    lastChecked: new Date().toISOString(),
    verifiedBy: '',
    evidence: '',
  };
}

function normalize(c: any): LaunchCheck {
  return {
    id: c.id,
    category: c.category,
    label: c.label,
    status: c.status,
    method: c.method,
    notes: c.notes || '',
    instruction: c.instruction || null,
    lastChecked: c.lastChecked || new Date().toISOString(),
    verifiedBy: c.verifiedBy || '',
    evidence: c.evidence || '',
    signedOffBy: c.signedOffBy || '',
    signedOffAt: c.signedOffAt || null,
  };
}

function buildChecks(edgeChecks: any[]): LaunchCheck[] {
  const normalized = (edgeChecks || []).map(normalize);
  const mapsKey = makeMapsKeyCheck();
  const idx = normalized.findIndex((c) => c.id === 'maps_embed_preview');
  if (idx >= 0) normalized.splice(idx, 0, mapsKey);
  else normalized.push(mapsKey);
  return normalized;
}

function computeDecision(checks: LaunchCheck[]): Decision {
  const critical = checks.filter((c) => c.category === 'critical');
  if (critical.some((c) => c.status === 'fail' || c.status === 'not_verified')) return 'NO-GO';
  if (checks.some((c) => c.status === 'warning')) return 'CONDITIONAL GO';
  return 'GO';
}

export default function LiveTestChecklistPage() {
  const admin = useAdminAuth();
  const [checks, setChecks] = useState<LaunchCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [signingOffId, setSigningOffId] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [history, setHistory] = useState<SavedDecision[]>([]);
  const [savedDecision, setSavedDecision] = useState<Decision | null>(null);
  const [savedBy, setSavedBy] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [retirementRegister, setRetirementRegister] = useState<RetirementRecord[]>([]);
  const [retirementApprovals, setRetirementApprovals] = useState<RetirementApproval[]>([]);
  const [approvingRetirement, setApprovingRetirement] = useState(false);

  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillDryRun, setBackfillDryRun] = useState(true);

  const adminName = admin.name || admin.email || '';
  const canApprove = admin.role === 'super_admin' || admin.role === 'admin';
  const canApproveRetirement = admin.role === 'super_admin';

  const runBackfill = useCallback(async () => {
    setBackfillLoading(true);
    setBackfillError(null);
    setBackfillResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-geocoding', {
        body: { dry_run: backfillDryRun },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Backfill failed');
      if (data?.error) throw new Error(data.error);
      setBackfillResult(data);
    } catch (err: any) {
      setBackfillError(err?.message || 'Backfill failed');
    } finally {
      setBackfillLoading(false);
    }
  }, [backfillDryRun]);

  const runVerification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'run' },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Verification failed');
      const fresh = buildChecks(data.checks || []);
      if (Array.isArray(data.retirement_register)) {
        setRetirementRegister(data.retirement_register);
      }
      setChecks((prev) =>
        fresh.map((f) => {
          if (f.method === 'manual') {
            const p = prev.find((x) => x.id === f.id);
            if (p && p.verifiedBy) {
              return { ...f, status: p.status, verifiedBy: p.verifiedBy, evidence: p.evidence };
            }
          }
          return f;
        })
      );
      setLastRunAt(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to run verification');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'history' },
      });
      if (data?.decisions) {
        setHistory(data.decisions);
        const latest = data.decisions[0];
        if (latest) {
          setSavedDecision(latest.decision);
          setSavedBy(latest.approved_by || latest.approved_by_email);
          setSavedAt(latest.created_at);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const loadRetirementHistory = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'retirement_history' },
      });
      if (data?.approvals) {
        setRetirementApprovals(data.approvals);
      }
    } catch { /* ignore */ }
  }, []);

  const approveRetirement = useCallback(async (slug: string, decision: RetirementDecision) => {
    setApprovingRetirement(true);
    try {
      const { data, error } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'approve_retirement', function_slug: slug, decision },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Approval failed');
      if (data?.error) throw new Error(data.error);
      loadRetirementHistory();
    } catch (err: any) {
      setError(err?.message || 'Approval failed');
    } finally {
      setApprovingRetirement(false);
    }
  }, [loadRetirementHistory]);

  useEffect(() => {
    runVerification();
    loadHistory();
    loadRetirementHistory();
  }, [runVerification, loadHistory, loadRetirementHistory]);

  const recheck = useCallback(async (id: string) => {
    if (id === 'maps_embed_key') {
      const fresh = makeMapsKeyCheck();
      setChecks((prev) => prev.map((c) => (c.id === id ? fresh : c)));
      return;
    }
    setRecheckingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'recheck', checkId: id },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Recheck failed');
      const fresh = (data.checks || []).map(normalize);
      setChecks((prev) => prev.map((c) => fresh.find((f) => f.id === c.id) || c));
    } catch (err: any) {
      setError(err?.message || 'Recheck failed');
    } finally {
      setRecheckingId(null);
    }
  }, []);

  const updateCheck = useCallback((id: string, patch: Partial<LaunchCheck>) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const signOff = useCallback(async (id: string) => {
    const check = checks.find((c) => c.id === id);
    if (!check) return;
    setSigningOffId(id);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('launch-readiness', {
        body: {
          action: 'sign_off_check',
          check_id: id,
          status: check.status,
          verified_by: check.verifiedBy,
          evidence: check.evidence,
        },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Sign-off failed');
      if (data?.error) throw new Error(data.error);
      setChecks((prev) => prev.map((c) => c.id === id ? {
        ...c,
        signedOffBy: adminName,
        signedOffAt: new Date().toISOString(),
      } : c));
    } catch (err: any) {
      setError(err?.message || 'Sign-off failed');
    } finally {
      setSigningOffId(null);
    }
  }, [checks, adminName]);

  const saveDecision = useCallback(async (notes: string, confirmed: boolean) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const decision = computeDecision(checks);
      const { data, error } = await supabase.functions.invoke('launch-readiness', {
        body: { action: 'save_decision', decision, notes, results: checks, confirmed },
      });
      if (error) throw new Error((await extractEdgeError(error)) || 'Failed to save decision');
      if (data?.error) throw new Error(data.error);
      setSaveSuccess(true);
      setSavedDecision(decision);
      setSavedBy(adminName || 'Administrator');
      setSavedAt(new Date().toISOString());
      loadHistory();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  }, [checks, adminName, loadHistory]);

  const decision = useMemo(() => computeDecision(checks), [checks]);
  const criticalChecks = useMemo(() => checks.filter((c) => c.category === 'critical'), [checks]);
  const warningChecks = useMemo(() => checks.filter((c) => c.category === 'warning'), [checks]);

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const notVerifiedCount = checks.filter((c) => c.status === 'not_verified').length;

  const displayDecision = savedDecision && savedAt ? savedDecision : decision;
  const approved = !!savedDecision && !!savedAt;

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-rocket-2-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Launch Readiness</h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {lastRunAt ? `Last verified ${lastRunAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet verified'}
                </p>
              </div>
            </div>
            <button
              onClick={runVerification}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-900/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
                <i className="ri-play-circle-line text-sm"></i>
              </div>
              Run launch verification
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-shield-keyhole-line"></i>
          </div>
          All automated checks are read-only. No API keys or secrets are ever displayed in the browser.
        </div>

        {error && (
          <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Verification error</h3>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
            </div>
            <button onClick={runVerification} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer flex-shrink-0 whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        <DecisionBanner
          decision={displayDecision}
          approved={approved}
          approvedBy={savedBy}
          approvedAt={savedAt}
          passCount={passCount}
          failCount={failCount}
          warningCount={warningCount}
          notVerifiedCount={notVerifiedCount}
          loading={loading && checks.length === 0}
        />

        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-base font-bold text-white">Launch-critical checks</h2>
            <span className="text-xs font-bold text-slate-500 bg-[#111d35] border border-[#1a2b4a] px-2.5 py-1 rounded-full">
              {criticalChecks.length}
            </span>
          </div>
          {loading && checks.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-2xl p-6 border border-[#1a2b4a] animate-pulse h-24"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {criticalChecks.map((check) => (
                <CheckCard
                  key={check.id}
                  check={check}
                  adminName={adminName}
                  rechecking={recheckingId === check.id}
                  onRecheck={recheck}
                  onUpdate={updateCheck}
                  onSignOff={signOff}
                  signingOff={signingOffId === check.id}
                />
              ))}
              <MapsPreview />
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-base font-bold text-white">Non-blocking checks</h2>
            <span className="text-xs font-bold text-slate-500 bg-[#111d35] border border-[#1a2b4a] px-2.5 py-1 rounded-full">
              {warningChecks.length}
            </span>
          </div>
          <div className="space-y-3">
            {warningChecks.map((check) => (
              <CheckCard
                key={check.id}
                check={check}
                adminName={adminName}
                rechecking={recheckingId === check.id}
                onRecheck={recheck}
                onUpdate={updateCheck}
                onSignOff={signOff}
                signingOff={signingOffId === check.id}
              />
            ))}
          </div>
        </section>

        <RetirementRegister
          register={retirementRegister}
          approvals={retirementApprovals}
          canApprove={canApproveRetirement}
          approving={approvingRetirement}
          onApprove={approveRetirement}
        />

        <ApprovalPanel
          decision={decision}
          adminName={adminName}
          canApprove={canApprove}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          history={history}
          onSave={saveDecision}
        />

        <section className="rounded-2xl border border-[#1a2b4a] bg-[#111d35] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <i className="ri-map-pin-line text-xl"></i>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Geocoding backfill</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Geocode postcodes for existing guards and jobs so distance matching works.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBackfillDryRun((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  backfillDryRun
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {backfillDryRun ? 'Dry run' : 'Live write'}
              </button>
              <button
                onClick={runBackfill}
                disabled={backfillLoading}
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-900/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <div className={`w-4 h-4 flex items-center justify-center ${backfillLoading ? 'animate-spin' : ''}`}>
                  <i className="ri-play-circle-line text-sm"></i>
                </div>
                {backfillDryRun ? 'Preview backfill' : 'Run backfill'}
              </button>
            </div>
          </div>

          {backfillError && (
            <div className="rounded-xl border-l-[4px] border-l-red-500 p-4 bg-red-500/5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
                <i className="ri-error-warning-line text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">Backfill failed</h3>
                <p className="text-sm text-slate-400 mt-1">{backfillError}</p>
              </div>
            </div>
          )}

          {backfillResult?.success && backfillResult?.summary && (
            <div className="rounded-xl border-l-[4px] border-l-teal-500 p-4 bg-teal-500/5 space-y-3">
              <div className="flex items-center gap-2">
                <i className="ri-check-double-line text-teal-400"></i>
                <span className="text-sm font-bold text-white">
                  {backfillResult.summary.dry_run ? 'Preview complete' : 'Backfill complete'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#0B1933] border border-[#1a2b4a] p-3">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Guards</p>
                  <p className="text-sm text-slate-300 mt-1">
                    Found <span className="font-bold text-white">{backfillResult.summary.guards?.found ?? 0}</span> &middot;{' '}
                    Geocoded <span className="font-bold text-teal-400">{backfillResult.summary.guards?.geocoded ?? 0}</span> &middot;{' '}
                    Failed <span className="font-bold text-red-400">{backfillResult.summary.guards?.failed ?? 0}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-[#0B1933] border border-[#1a2b4a] p-3">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Jobs</p>
                  <p className="text-sm text-slate-300 mt-1">
                    Found <span className="font-bold text-white">{backfillResult.summary.jobs?.found ?? 0}</span> &middot;{' '}
                    Geocoded <span className="font-bold text-teal-400">{backfillResult.summary.jobs?.geocoded ?? 0}</span> &middot;{' '}
                    Failed <span className="font-bold text-red-400">{backfillResult.summary.jobs?.failed ?? 0}</span>
                  </p>
                </div>
              </div>
              {backfillResult.summary.dry_run && (
                <p className="text-xs text-amber-400">
                  <i className="ri-information-line mr-1"></i>
                  This was a preview — no data was written. Toggle "Dry run" off and click again to write coordinates.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}