'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';

interface Plan {
  slug: string;
  name: string;
  audience: string;
  monthly_price_pence: number;
}

interface FeeRule {
  id: string;
  plan_slug: string;
  platform_fee_percent: number;
  platform_fee_fixed_pence: number;
  stripe_fee_payer: string;
  payout_delay_days: number;
  dispute_window_hours: number;
  auto_release_hours: number;
  max_active_jobs: number;
  invoice_access: boolean;
  finance_export_access: boolean;
  show_vat_estimate: boolean;
  stripe_fee_estimate_percent: number;
  updated_at: string;
}

const stripeFeePayerOptions = [
  { value: 'client', label: 'Client Pays', desc: 'Stripe fee added to client total' },
  { value: 'guard', label: 'Guard Pays', desc: 'Stripe fee deducted from guard payout' },
  { value: 'quickguard', label: 'QuickGuard Pays', desc: 'Stripe fee absorbed from platform fee' },
  { value: 'split', label: 'Split', desc: 'Stripe fee split between client and guard' },
];

const DEFAULT_RULE: Omit<FeeRule, 'id' | 'plan_slug' | 'updated_at'> = {
  platform_fee_percent: 15,
  platform_fee_fixed_pence: 0,
  stripe_fee_payer: 'client',
  payout_delay_days: 3,
  dispute_window_hours: 48,
  auto_release_hours: 72,
  max_active_jobs: 5,
  invoice_access: true,
  finance_export_access: false,
  show_vat_estimate: true,
  stripe_fee_estimate_percent: 1.5,
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function validateFeeRule(rule: Partial<FeeRule>): string[] {
  const errors: string[] = [];
  const percent = rule.platform_fee_percent ?? DEFAULT_RULE.platform_fee_percent;
  const fixed = rule.platform_fee_fixed_pence ?? DEFAULT_RULE.platform_fee_fixed_pence;
  const delay = rule.payout_delay_days ?? DEFAULT_RULE.payout_delay_days;
  const dispute = rule.dispute_window_hours ?? DEFAULT_RULE.dispute_window_hours;
  const autoRelease = rule.auto_release_hours ?? DEFAULT_RULE.auto_release_hours;
  const maxJobs = rule.max_active_jobs ?? DEFAULT_RULE.max_active_jobs;
  const stripeEstimate = rule.stripe_fee_estimate_percent ?? DEFAULT_RULE.stripe_fee_estimate_percent;

  if (percent < 0 || percent > 100) errors.push('Platform fee must be 0–100%');
  if (fixed < 0) errors.push('Fixed fee cannot be negative');
  if (delay < 0 || delay > 90) errors.push('Payout delay must be 0–90 days');
  if (dispute < 0 || dispute > 720) errors.push('Dispute window must be 0–720 hours');
  if (autoRelease < 0 || autoRelease > 720) errors.push('Auto-release must be 0–720 hours');
  if (maxJobs < 1 || maxJobs > 500) errors.push('Max active jobs must be 1–500');
  if (stripeEstimate < 0 || stripeEstimate > 10) errors.push('Stripe fee estimate must be 0–10%');

  return errors;
}

export default function PlanFeeRulesPage() {
  const admin = useAdminAuth();
  const canEdit = admin.role === 'super_admin' || admin.role === 'finance_admin';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [feeRules, setFeeRules] = useState<Record<string, FeeRule>>({});
  const [savedRules, setSavedRules] = useState<Record<string, FeeRule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'client' | 'guard'>('client');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: plansData } = await supabase
        .from('plans')
        .select('slug, name, audience, monthly_price_pence')
        .eq('active', true)
        .order('monthly_price_pence', { ascending: true });

      setPlans(plansData || []);

      const { data: rulesData } = await supabase.from('plan_fee_rules').select('*');
      const rulesMap: Record<string, FeeRule> = {};
      (rulesData || []).forEach((r: FeeRule) => {
        rulesMap[r.plan_slug] = r;
      });
      setFeeRules(rulesMap);
      setSavedRules(JSON.parse(JSON.stringify(rulesMap)));
    } catch {
      setToast({ message: 'Failed to load plans', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unsavedPlans = useMemo(() => {
    return plans.filter(p => {
      const current = feeRules[p.slug];
      const saved = savedRules[p.slug];
      if (!current && !saved) return false;
      if (!current || !saved) return true;
      return (
        current.platform_fee_percent !== saved.platform_fee_percent ||
        current.platform_fee_fixed_pence !== saved.platform_fee_fixed_pence ||
        current.stripe_fee_payer !== saved.stripe_fee_payer ||
        current.payout_delay_days !== saved.payout_delay_days ||
        current.dispute_window_hours !== saved.dispute_window_hours ||
        current.auto_release_hours !== saved.auto_release_hours ||
        current.max_active_jobs !== saved.max_active_jobs ||
        current.invoice_access !== saved.invoice_access ||
        current.finance_export_access !== saved.finance_export_access ||
        current.show_vat_estimate !== saved.show_vat_estimate ||
        current.stripe_fee_estimate_percent !== saved.stripe_fee_estimate_percent
      );
    });
  }, [plans, feeRules, savedRules]);

  const handleRefresh = () => {
    if (unsavedPlans.length > 0) {
      const names = unsavedPlans.map(p => p.name).join(', ');
      if (!window.confirm(`You have unsaved changes for: ${names}. Refresh will discard them. Continue?`)) {
        return;
      }
    }
    fetchData();
  };

  const updateRule = (planSlug: string, field: keyof FeeRule, value: any) => {
    if (!canEdit) return;
    setFeeRules(prev => {
      const existing = prev[planSlug] || {
        id: '', plan_slug: planSlug, ...DEFAULT_RULE, updated_at: '',
      };
      let clamped = value;
      if (field === 'platform_fee_percent') clamped = clampNumber(parseFloat(value) || 0, 0, 100);
      if (field === 'platform_fee_fixed_pence') clamped = Math.max(0, parseInt(value) || 0);
      if (field === 'stripe_fee_estimate_percent') clamped = clampNumber(parseFloat(value) || 0, 0, 10);
      if (field === 'payout_delay_days') clamped = clampNumber(parseInt(value) || 0, 0, 90);
      if (field === 'dispute_window_hours') clamped = clampNumber(parseInt(value) || 0, 0, 720);
      if (field === 'auto_release_hours') clamped = clampNumber(parseInt(value) || 0, 0, 720);
      if (field === 'max_active_jobs') clamped = clampNumber(parseInt(value) || 1, 1, 500);
      return { ...prev, [planSlug]: { ...existing, [field]: clamped } };
    });
  };

  const saveRule = async (planSlug: string) => {
    if (!canEdit) return;
    setSaving(planSlug);
    try {
      const rule = feeRules[planSlug];
      if (!rule) return;

      const errors = validateFeeRule(rule);
      if (errors.length > 0) {
        setToast({ message: errors.join('. '), type: 'error' });
        setSaving(null);
        return;
      }

      const payload = {
        plan_slug: planSlug,
        platform_fee_percent: rule.platform_fee_percent ?? DEFAULT_RULE.platform_fee_percent,
        platform_fee_fixed_pence: rule.platform_fee_fixed_pence ?? DEFAULT_RULE.platform_fee_fixed_pence,
        stripe_fee_payer: rule.stripe_fee_payer ?? DEFAULT_RULE.stripe_fee_payer,
        payout_delay_days: rule.payout_delay_days ?? DEFAULT_RULE.payout_delay_days,
        dispute_window_hours: rule.dispute_window_hours ?? DEFAULT_RULE.dispute_window_hours,
        auto_release_hours: rule.auto_release_hours ?? DEFAULT_RULE.auto_release_hours,
        max_active_jobs: rule.max_active_jobs ?? DEFAULT_RULE.max_active_jobs,
        invoice_access: rule.invoice_access ?? DEFAULT_RULE.invoice_access,
        finance_export_access: rule.finance_export_access ?? DEFAULT_RULE.finance_export_access,
        show_vat_estimate: rule.show_vat_estimate ?? DEFAULT_RULE.show_vat_estimate,
        stripe_fee_estimate_percent: rule.stripe_fee_estimate_percent ?? DEFAULT_RULE.stripe_fee_estimate_percent,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from('plan_fee_rules')
        .select('id')
        .eq('plan_slug', planSlug)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase.from('plan_fee_rules').update(payload).eq('id', existing.id);
        if (updateErr) {
          setToast({ message: `Failed to save: ${updateErr.message} (${updateErr.code})`, type: 'error' });
          setSaving(null);
          return;
        }
      } else {
        const { error: insertErr } = await supabase.from('plan_fee_rules').insert({ ...payload, created_at: new Date().toISOString() });
        if (insertErr) {
          setToast({ message: `Failed to save: ${insertErr.message} (${insertErr.code})`, type: 'error' });
          setSaving(null);
          return;
        }
      }

      setSavedRules(prev => ({ ...prev, [planSlug]: { ...rule, ...payload } }));
      setToast({ message: `Saved ${plans.find(p => p.slug === planSlug)?.name || planSlug}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: `Failed to save: ${err?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const filteredPlans = plans.filter(p => p.audience === activeTab);

  const examplePlan = selectedPlanSlug ? filteredPlans.find(p => p.slug === selectedPlanSlug) : filteredPlans[0];
  const exampleRule = examplePlan ? (feeRules[examplePlan.slug] || { ...DEFAULT_RULE, plan_slug: examplePlan.slug } as FeeRule) : null;

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1e2d4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-500/20">
                <i className="ri-settings-3-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Plan & Fee Rules</h1>
                <p className="text-xs text-slate-400">Configure fees per subscription plan</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-[#162544] transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh{unsavedPlans.length > 0 ? ` (${unsavedPlans.length} unsaved)` : ''}
              </button>
              <Link
                href="/admin/platform-finances"
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-bar-chart-line text-sm"></i>
                </div>
                Finances
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-amber-500/20 rounded-lg flex-shrink-0">
            <i className="ri-government-line text-amber-400"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-300">Tax & Legal Notice</p>
            <p className="text-sm text-amber-400/80 mt-1">
              QuickGuard is a marketplace platform, not an employer. Guards and clients are responsible for their own tax, VAT, National Insurance, and legal reporting. Only platform fees count as QuickGuard revenue. Do not describe held job money as QuickGuard revenue.
            </p>
          </div>
        </div>

        {!canEdit && !loading && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-500/20 rounded-lg flex-shrink-0">
              <i className="ri-eye-line text-blue-400"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-300">View Only</p>
              <p className="text-sm text-blue-400/80 mt-1">
                You are signed in as <strong>{admin.role || 'admin'}</strong>. Only <strong>super_admin</strong> and <strong>finance_admin</strong> roles can edit fee rules. All fields are read-only.
              </p>
            </div>
          </div>
        )}

        {unsavedPlans.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-yellow-500/20 rounded-lg flex-shrink-0">
              <i className="ri-alert-line text-yellow-400"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Unsaved Changes</p>
              <p className="text-sm text-yellow-400/80 mt-1">
                {unsavedPlans.map(p => p.name).join(', ')} — changes are not yet saved. Click <strong>Save Changes</strong> on each plan or refresh to discard.
              </p>
            </div>
          </div>
        )}

        <div className="inline-flex bg-[#111d35] border border-[#1e2d4a] rounded-xl p-1">
          <button
            onClick={() => setActiveTab('client')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'client'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="ri-building-line mr-1.5"></i>
            Client Plans
          </button>
          <button
            onClick={() => setActiveTab('guard')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'guard'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="ri-shield-user-line mr-1.5"></i>
            Guard Plans
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <i className="ri-loader-4-line text-4xl text-teal-400 animate-spin"></i>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPlans.map((plan) => {
              const rule = feeRules[plan.slug] || {
                id: '', plan_slug: plan.slug, ...DEFAULT_RULE, updated_at: '',
              };
              const isSaving = saving === plan.slug;

              return (
                <div key={plan.slug} className={`bg-[#111d35] border ${isSaving ? 'border-teal-500/50' : 'border-[#1e2d4a]'} rounded-2xl overflow-hidden transition-colors`}>
                  <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between bg-[#0d1b33]">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 'client' ? 'bg-teal-500/15 text-teal-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        <i className={`${activeTab === 'client' ? 'ri-building-line' : 'ri-shield-user-line'} text-xl`}></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{plan.name}</h3>
                        <p className="text-sm text-slate-400">£{(plan.monthly_price_pence / 100).toFixed(2)}/month</p>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => saveRule(plan.slug)}
                        disabled={isSaving}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                          isSaving
                            ? 'bg-[#162544] text-slate-500 cursor-wait'
                            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm'
                        }`}
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    )}
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Platform Fee (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rule.platform_fee_percent}
                          onChange={(e) => updateRule(plan.slug, 'platform_fee_percent', parseFloat(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">% of guard fees</span>
                      </div>
                      <p className="text-xs text-slate-500">This is QuickGuard's revenue. Only this portion counts as platform income.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Fixed Fee (pence)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={rule.platform_fee_fixed_pence}
                          onChange={(e) => updateRule(plan.slug, 'platform_fee_fixed_pence', parseInt(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">pence per job</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Stripe Fee Payer</label>
                      <div className="grid grid-cols-2 gap-2">
                        {stripeFeePayerOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateRule(plan.slug, 'stripe_fee_payer', opt.value)}
                            disabled={!canEdit || isSaving}
                            className={`p-2.5 rounded-lg text-xs font-medium text-left transition-all border cursor-pointer ${
                              !canEdit || isSaving ? 'pointer-events-none opacity-50' : ''
                            } ${
                              rule.stripe_fee_payer === opt.value
                                ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                                : 'bg-[#0a1628] border-[#1e2d4a] text-slate-400 hover:border-[#2a3f5f]'
                            }`}
                          >
                            <div className="font-semibold">{opt.label}</div>
                            <div className="text-slate-500 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Stripe Fee Estimate (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          value={rule.stripe_fee_estimate_percent}
                          onChange={(e) => updateRule(plan.slug, 'stripe_fee_estimate_percent', parseFloat(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">% + £0.20 fixed</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Payout Delay (days)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={90}
                          value={rule.payout_delay_days}
                          onChange={(e) => updateRule(plan.slug, 'payout_delay_days', parseInt(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">days after completion</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Auto Release (hours)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={720}
                          value={rule.auto_release_hours}
                          onChange={(e) => updateRule(plan.slug, 'auto_release_hours', parseInt(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">hours after completion</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Dispute Window (hours)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={720}
                          value={rule.dispute_window_hours}
                          onChange={(e) => updateRule(plan.slug, 'dispute_window_hours', parseInt(e.target.value) || 0)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">hours to raise dispute</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300">Max Active Jobs</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={rule.max_active_jobs}
                          onChange={(e) => updateRule(plan.slug, 'max_active_jobs', parseInt(e.target.value) || 1)}
                          disabled={!canEdit || isSaving}
                          className={`w-24 px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent ${(!canEdit || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-sm text-slate-500">concurrent jobs</span>
                      </div>
                    </div>

                    <div className="space-y-3 md:col-span-2 lg:col-span-3">
                      <div className="flex items-center gap-4">
                        <label className={`flex items-center gap-3 ${!canEdit || isSaving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={rule.invoice_access}
                            onChange={(e) => updateRule(plan.slug, 'invoice_access', e.target.checked)}
                            disabled={!canEdit || isSaving}
                            className="w-5 h-5 accent-teal-500"
                          />
                          <span className="text-sm text-slate-300">Invoice Access</span>
                        </label>
                        <label className={`flex items-center gap-3 ${!canEdit || isSaving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={rule.finance_export_access}
                            onChange={(e) => updateRule(plan.slug, 'finance_export_access', e.target.checked)}
                            disabled={!canEdit || isSaving}
                            className="w-5 h-5 accent-teal-500"
                          />
                          <span className="text-sm text-slate-300">Finance Export</span>
                        </label>
                        <label className={`flex items-center gap-3 ${!canEdit || isSaving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={rule.show_vat_estimate}
                            onChange={(e) => updateRule(plan.slug, 'show_vat_estimate', e.target.checked)}
                            disabled={!canEdit || isSaving}
                            className="w-5 h-5 accent-teal-500"
                          />
                          <span className="text-sm text-slate-300">Show VAT Estimate</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {exampleRule && (
          <div className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="ri-calculator-line text-teal-400"></i>
                How Fee Breakdown Works
              </h3>
              {filteredPlans.length > 1 && (
                <select
                  value={selectedPlanSlug || filteredPlans[0]?.slug || ''}
                  onChange={(e) => setSelectedPlanSlug(e.target.value || null)}
                  className="px-3 py-1.5 bg-[#0a1628] border border-[#1e2d4a] rounded-lg text-sm text-slate-300 pr-8"
                >
                  {filteredPlans.map(p => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
                  <span className="text-slate-400">Guard Fees</span>
                  <span className="font-semibold text-white">£100.00</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
                  <span className="text-slate-400">
                    Platform Fee ({exampleRule.platform_fee_percent}%)
                  </span>
                  <span className="font-semibold text-white">
                    £{((100 * exampleRule.platform_fee_percent) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
                  <span className="text-slate-400">
                    Stripe Fee ({exampleRule.stripe_fee_estimate_percent}% + £0.20)
                  </span>
                  <span className="font-semibold text-white">
                    £{((100 * exampleRule.stripe_fee_estimate_percent) / 100 + 0.20).toFixed(2)}
                  </span>
                </div>
                {exampleRule.platform_fee_fixed_pence > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1e2d4a]">
                    <span className="text-slate-400">Fixed Fee</span>
                    <span className="font-semibold text-white">£{(exampleRule.platform_fee_fixed_pence / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-3 border-t-2 border-teal-500/50">
                  <span className="font-bold text-white">QuickGuard Net Revenue</span>
                  <span className="font-bold text-teal-400">
                    £{(
                      (100 * exampleRule.platform_fee_percent) / 100 +
                      exampleRule.platform_fee_fixed_pence / 100
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-[#0a1628] rounded-xl p-4 text-sm text-slate-400 space-y-2">
                <p>
                  <strong className="text-white">Client Pays:</strong> £100 + £{((100 * exampleRule.platform_fee_percent) / 100).toFixed(2)} + £{((100 * exampleRule.stripe_fee_estimate_percent) / 100 + 0.20).toFixed(2)}
                  {exampleRule.platform_fee_fixed_pence > 0 ? ` + £${(exampleRule.platform_fee_fixed_pence / 100).toFixed(2)}` : ''} = <strong className="text-white">
                    £{(
                      100 +
                      (100 * exampleRule.platform_fee_percent) / 100 +
                      (100 * exampleRule.stripe_fee_estimate_percent) / 100 + 0.20 +
                      exampleRule.platform_fee_fixed_pence / 100
                    ).toFixed(2)}
                  </strong>
                </p>
                <p>
                  <strong className="text-white">Guard Receives:</strong> £{exampleRule.stripe_fee_payer === 'guard' ? (
                    100 - (100 * exampleRule.stripe_fee_estimate_percent) / 100 - 0.20
                  ).toFixed(2) : '100.00'}
                </p>
                <p>
                  <strong className="text-white">QuickGuard Keeps:</strong> £{(
                    (100 * exampleRule.platform_fee_percent) / 100 +
                    exampleRule.platform_fee_fixed_pence / 100
                  ).toFixed(2)} (platform fee only)
                </p>
                <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-[#1e2d4a]">
                  {exampleRule.stripe_fee_payer === 'guard' ? (
                    'Stripe fee is deducted from the guard payout. QuickGuard is never responsible for client or guard tax.'
                  ) : exampleRule.stripe_fee_payer === 'quickguard' ? (
                    'Stripe fee is absorbed from the platform fee. QuickGuard is never responsible for client or guard tax.'
                  ) : exampleRule.stripe_fee_payer === 'split' ? (
                    'Stripe fee is split between client and guard. QuickGuard is never responsible for client or guard tax.'
                  ) : (
                    'Stripe fee is added to the client total. QuickGuard is never responsible for client or guard tax.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className={`fixed top-6 right-6 max-w-md px-5 py-3 rounded-xl shadow-lg z-50 flex items-start gap-3 animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-lg`}></i>
          </div>
          <div>
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="flex-shrink-0 ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            <i className="ri-close-line text-xs"></i>
          </button>
        </div>
      )}
    </div>
  );
}