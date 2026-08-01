'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface PromoConfig {
  id: number;
  launch_date: string;
  tier1_cap: number;
  tier2_cap: number;
  tier3_cap: number;
  tier3_window_days: number;
  tier1_lifetime_fee: number;
  standard_fee: number;
  is_paused: boolean;
  client_tier1_cap: number;
  client_tier2_cap: number;
  client_tier3_cap: number;
  client_tier3_window_days: number;
  client_tier1_lifetime_discount: number;
  client_standard_service_fee: number;
}

interface TierStats {
  founding: number;
  early: number;
  launch: number;
  standard: number;
}

interface ClientTierStats {
  founding_client: number;
  early_client: number;
  launch_client: number;
  standard: number;
}

export default function PromoAdminClient() {
  const [config, setConfig] = useState<PromoConfig | null>(null);
  const [guardTierStats, setGuardTierStats] = useState<TierStats>({ founding: 0, early: 0, launch: 0, standard: 0 });
  const [clientTierStats, setClientTierStats] = useState<ClientTierStats>({ founding_client: 0, early_client: 0, launch_client: 0, standard: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editConfig, setEditConfig] = useState<PromoConfig | null>(null);
  const [guards, setGuards] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [tab, setTab] = useState<'guards' | 'clients'>('guards');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: cfg } = await supabase
      .from('promo_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (cfg) {
      setConfig(cfg);
      setEditConfig(cfg);
    }

    const { data: promoRpc } = await supabase.rpc('get_client_promo_stats');
    if (promoRpc?.counts) {
      setClientTierStats({
        founding_client: promoRpc.counts.founding ?? 0,
        early_client: promoRpc.counts.early ?? 0,
        launch_client: promoRpc.counts.launch ?? 0,
        standard: 0,
      });
    }

    const guardTiers = ['founding', 'early', 'launch', 'standard'];
    const gStats: any = {};
    for (const tier of guardTiers) {
      const { count } = await supabase
        .from('guards')
        .select('*', { count: 'exact', head: true })
        .eq('promo_tier', tier)
        .eq('verification_status', 'approved');
      gStats[tier] = count || 0;
    }
    setGuardTierStats(gStats);

    const cStats: any = {};
    for (const tier of ['founding_client', 'early_client', 'launch_client', 'standard']) {
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('client_promo_tier', tier);
      cStats[tier] = count || 0;
    }
    setClientTierStats(cStats);

    setLoading(false);
  }

  async function loadGuards(tier: string) {
    setGuardsLoading(true);
    setTab('guards');
    setFilterTier(tier);

    let query = supabase
      .from('guards')
      .select('id, full_name, email, signup_number, promo_tier, promo_starts_at, promo_ends_at, lifetime_fee_percentage, founding_badge, created_at, verified_at')
      .eq('verification_status', 'approved')
      .order('signup_number', { ascending: true });

    if (tier !== 'all') {
      query = query.eq('promo_tier', tier);
    }

    const { data } = await query.limit(200);
    setGuards(data || []);
    setGuardsLoading(false);
  }

  async function loadClients(tier: string) {
    setClientsLoading(true);
    setTab('clients');
    setFilterTier(tier);

    let query = supabase
      .from('clients')
      .select('id, company_name, contact_name, email, client_signup_number, client_promo_tier, client_promo_starts_at, client_promo_ends_at, client_lifetime_fee_discount, founding_client_badge, created_at')
      .not('client_signup_number', 'is', null)
      .order('client_signup_number', { ascending: true });

    if (tier !== 'all') {
      query = query.eq('client_promo_tier', tier);
    }

    const { data } = await query.limit(200);
    setClients(data || []);
    setClientsLoading(false);
  }

  async function saveConfig() {
    if (!editConfig) return;
    setSaving(true);

    const { error } = await supabase
      .from('promo_config')
      .update({
        launch_date: editConfig.launch_date,
        tier1_cap: editConfig.tier1_cap,
        tier2_cap: editConfig.tier2_cap,
        tier3_cap: editConfig.tier3_cap,
        tier3_window_days: editConfig.tier3_window_days,
        tier1_lifetime_fee: editConfig.tier1_lifetime_fee,
        standard_fee: editConfig.standard_fee,
        client_tier1_cap: editConfig.client_tier1_cap,
        client_tier2_cap: editConfig.client_tier2_cap,
        client_tier3_cap: editConfig.client_tier3_cap,
        client_tier3_window_days: editConfig.client_tier3_window_days,
        client_tier1_lifetime_discount: editConfig.client_tier1_lifetime_discount,
        client_standard_service_fee: editConfig.client_standard_service_fee,
        is_paused: editConfig.is_paused,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (!error) {
      setConfig(editConfig);
    }
    setSaving(false);
  }

  async function togglePause() {
    if (!config) return;
    const { error } = await supabase
      .from('promo_config')
      .update({ is_paused: !config.is_paused, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) {
      const next = { ...config, is_paused: !config.is_paused };
      setConfig(next);
      setEditConfig(next);
    }
  }

  const totalVerified = guardTierStats.founding + guardTierStats.early + guardTierStats.launch + guardTierStats.standard;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Promo Tier Management</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Founding, Early &amp; Launch promotions for guards &amp; clients</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-teal-500 dark:text-teal-400 text-sm font-medium hover:underline whitespace-nowrap"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-amber-500/20 p-6">
                <p className="text-sm text-amber-400 font-medium mb-1">Guard Founding</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {guardTierStats.founding}<span className="text-lg text-slate-400">/{config?.tier1_cap ?? 100}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-500/20 p-6">
                <p className="text-sm text-slate-300 font-medium mb-1">Guard Early</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {guardTierStats.early}<span className="text-lg text-slate-400">/{config?.tier2_cap ?? 500}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-teal-500/20 p-6">
                <p className="text-sm text-teal-400 font-medium mb-1">Guard Launch</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {guardTierStats.launch}<span className="text-lg text-slate-400">/{config?.tier3_cap ?? 2000}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-6">
                <p className="text-sm text-slate-500 font-medium mb-1">Total Verified Guards</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalVerified}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-amber-500/20 p-6">
                <p className="text-sm text-amber-400 font-medium mb-1">Client Founding</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {clientTierStats.founding_client}<span className="text-lg text-slate-400">/{config?.client_tier1_cap ?? 50}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-500/20 p-6">
                <p className="text-sm text-slate-300 font-medium mb-1">Client Early</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {clientTierStats.early_client}<span className="text-lg text-slate-400">/{config?.client_tier2_cap ?? 250}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-teal-500/20 p-6">
                <p className="text-sm text-teal-400 font-medium mb-1">Client Launch</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {clientTierStats.launch_client}<span className="text-lg text-slate-400">/{config?.client_tier3_cap ?? 1000}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-6">
                <p className="text-sm text-slate-500 font-medium mb-1">Client Standard</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{clientTierStats.standard}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Promo Configuration</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePause}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      config?.is_paused
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25'
                    }`}
                  >
                    {config?.is_paused ? 'Resume Promo' : 'Pause Promo'}
                  </button>
                  <button
                    onClick={saveConfig}
                    disabled={saving || !editConfig}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {editConfig && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Launch Date</label>
                    <input
                      type="datetime-local"
                      value={editConfig.launch_date.slice(0, 16)}
                      onChange={e => setEditConfig({ ...editConfig, launch_date: new Date(e.target.value).toISOString() })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Guard Tier 1 Cap</label>
                    <input
                      type="number"
                      value={editConfig.tier1_cap}
                      onChange={e => setEditConfig({ ...editConfig, tier1_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Guard Tier 2 Cap</label>
                    <input
                      type="number"
                      value={editConfig.tier2_cap}
                      onChange={e => setEditConfig({ ...editConfig, tier2_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Guard Tier 3 Cap</label>
                    <input
                      type="number"
                      value={editConfig.tier3_cap}
                      onChange={e => setEditConfig({ ...editConfig, tier3_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Guard Tier 3 Window (days)</label>
                    <input
                      type="number"
                      value={editConfig.tier3_window_days}
                      onChange={e => setEditConfig({ ...editConfig, tier3_window_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Guard Tier 1 Lifetime Fee %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editConfig.tier1_lifetime_fee}
                      onChange={e => setEditConfig({ ...editConfig, tier1_lifetime_fee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Tier 1 Cap</label>
                    <input
                      type="number"
                      value={editConfig.client_tier1_cap}
                      onChange={e => setEditConfig({ ...editConfig, client_tier1_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Tier 2 Cap</label>
                    <input
                      type="number"
                      value={editConfig.client_tier2_cap}
                      onChange={e => setEditConfig({ ...editConfig, client_tier2_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Tier 3 Cap</label>
                    <input
                      type="number"
                      value={editConfig.client_tier3_cap}
                      onChange={e => setEditConfig({ ...editConfig, client_tier3_cap: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Tier 3 Window (days)</label>
                    <input
                      type="number"
                      value={editConfig.client_tier3_window_days}
                      onChange={e => setEditConfig({ ...editConfig, client_tier3_window_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Tier 1 Lifetime Discount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editConfig.client_tier1_lifetime_discount}
                      onChange={e => setEditConfig({ ...editConfig, client_tier1_lifetime_discount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Client Standard Service Fee %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editConfig.client_standard_service_fee}
                      onChange={e => setEditConfig({ ...editConfig, client_standard_service_fee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => loadGuards('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === 'guards' ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-[#162036] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2642]'
                }`}
              >
                Guards by Tier
              </button>
              <button
                onClick={() => loadClients('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === 'clients' ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-[#162036] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2642]'
                }`}
              >
                Clients by Tier
              </button>
            </div>

            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {tab === 'guards' ? 'Guards by Tier' : 'Clients by Tier'}
                </h2>
                <div className="flex items-center gap-2">
                  {(tab === 'guards'
                    ? ['all', 'founding', 'early', 'launch', 'standard']
                    : ['all', 'founding_client', 'early_client', 'launch_client', 'standard']
                  ).map(t => (
                    <button
                      key={t}
                      onClick={() => tab === 'guards' ? loadGuards(t) : loadClients(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        filterTier === t
                          ? 'bg-teal-500 text-white'
                          : 'bg-slate-100 dark:bg-[#162036] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2642]'
                      }`}
                    >
                      {t === 'all' ? 'All' : t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'guards' && guards.length === 0 && !guardsLoading && (
                <div className="text-center py-12">
                  <p className="text-slate-400">Click a tier filter above to view guards</p>
                </div>
              )}

              {tab === 'clients' && clients.length === 0 && !clientsLoading && (
                <div className="text-center py-12">
                  <p className="text-slate-400">Click a tier filter above to view clients</p>
                </div>
              )}

              {(guardsLoading || clientsLoading) && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {tab === 'guards' && guards.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">#</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Name</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Tier</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Free Until</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Lifetime Fee</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guards.map(g => (
                        <tr key={g.id} className="border-b border-slate-100 dark:border-[#1e2d4d]/50 hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors">
                          <td className="py-3 px-2 text-slate-700 dark:text-slate-300 font-mono">
                            {g.signup_number ? String(g.signup_number).padStart(3, '0') : '-'}
                          </td>
                          <td className="py-3 px-2 text-slate-900 dark:text-white font-medium">{g.full_name}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              g.promo_tier === 'founding' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                              g.promo_tier === 'early' ? 'bg-slate-500/15 text-slate-300 border-slate-500/25' :
                              g.promo_tier === 'launch' ? 'bg-teal-500/15 text-teal-400 border-teal-500/25' :
                              'bg-slate-100 dark:bg-[#162036] text-slate-500 border-slate-200 dark:border-[#1e2d4d]'
                            }`}>
                              {g.promo_tier === 'founding' && <i className="ri-shield-star-line text-xs"></i>}
                              {g.promo_tier === 'early' && <i className="ri-star-line text-xs"></i>}
                              {g.promo_tier === 'launch' && <i className="ri-rocket-line text-xs"></i>}
                              {g.promo_tier?.charAt(0).toUpperCase() + g.promo_tier?.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {g.promo_ends_at ? new Date(g.promo_ends_at).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {g.lifetime_fee_percentage ? `${g.lifetime_fee_percentage}%` : 'Standard'}
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {g.verified_at ? new Date(g.verified_at).toLocaleDateString('en-GB') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'clients' && clients.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">#</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Company</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Tier</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Zero-fee Until</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Lifetime Discount</th>
                        <th className="text-left py-3 px-2 text-slate-500 font-medium">Badge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-[#1e2d4d]/50 hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors">
                          <td className="py-3 px-2 text-slate-700 dark:text-slate-300 font-mono">
                            {c.client_signup_number ? String(c.client_signup_number).padStart(3, '0') : '-'}
                          </td>
                          <td className="py-3 px-2 text-slate-900 dark:text-white font-medium">
                            {c.company_name || c.contact_name || 'Private Client'}
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              c.client_promo_tier === 'founding_client' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                              c.client_promo_tier === 'early_client' ? 'bg-slate-500/15 text-slate-300 border-slate-500/25' :
                              c.client_promo_tier === 'launch_client' ? 'bg-teal-500/15 text-teal-400 border-teal-500/25' :
                              'bg-slate-100 dark:bg-[#162036] text-slate-500 border-slate-200 dark:border-[#1e2d4d]'
                            }`}>
                              {c.client_promo_tier === 'founding_client' && <i className="ri-shield-star-line text-xs"></i>}
                              {c.client_promo_tier === 'early_client' && <i className="ri-star-line text-xs"></i>}
                              {c.client_promo_tier === 'launch_client' && <i className="ri-rocket-line text-xs"></i>}
                              {c.client_promo_tier?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {c.client_promo_ends_at ? new Date(c.client_promo_ends_at).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {c.client_lifetime_fee_discount ? `${Math.round(c.client_lifetime_fee_discount * 100)}%` : 'Standard'}
                          </td>
                          <td className="py-3 px-2">
                            {c.founding_client_badge ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-amber-500/15 text-amber-400 border-amber-400/25">
                                <i className="ri-shield-star-line text-xs"></i> Active
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}