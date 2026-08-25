'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function GuardRewardsPage() {
  const [tab, setTab] = useState<'overview' | 'invite' | 'referrals' | 'tokens' | 'redemptions'>('overview');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState({ clicks: 0, started: 0, verified: 0, pendingTokens: 0, approvedTokens: 0, usedTokens: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [inviteForm, setInviteForm] = useState({ recipient_name: '', recipient_email: '', recipient_role: 'guard', message_optional: '' });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [preAccountData, setPreAccountData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const codeRes = await supabase.from('qg_referral_codes').select('code,status').eq('owner_user_id', user.id).maybeSingle();
      if (codeRes.data) {
        setReferralCode(codeRes.data.code);
      } else {
        const { data: nameRes } = await supabase.from('guards').select('full_name').eq('user_id', user.id).maybeSingle();
        const namePart = nameRes?.full_name ? nameRes.full_name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 12) : '';
        const newCode = namePart ? `QG-${namePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : `QG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const { data: insertData } = await supabase.from('qg_referral_codes').insert({ owner_user_id: user.id, owner_role: 'guard', code: newCode, status: 'active' }).select('code').single();
        if (insertData) setReferralCode(insertData.code);
        else setReferralCode(newCode);
      }

      const refsRes = await supabase.from('qg_referrals').select('*').eq('referrer_user_id', user.id).order('created_at', { ascending: false });
      if (refsRes.data) {
        setReferrals(refsRes.data);
        const clicks = refsRes.data.filter((r: any) => r.status === 'clicked' || r.status === 'profile_started' || r.status === 'account_created' || r.status === 'verified' || r.status === 'approved').length;
        const started = refsRes.data.filter((r: any) => r.status === 'profile_started' || r.status === 'account_created' || r.status === 'verified' || r.status === 'approved').length;
        const verified = refsRes.data.filter((r: any) => r.status === 'verified' || r.status === 'approved').length;
        const pendTok = refsRes.data.filter((r: any) => r.status === 'verified').reduce((s: number, r: any) => s + (r.pending_tokens || 0), 0);
        const appTok = refsRes.data.filter((r: any) => r.status === 'approved').reduce((s: number, r: any) => s + (r.approved_tokens || 0), 0);
        setStats({ clicks, started, verified, pendingTokens: pendTok, approvedTokens: appTok, usedTokens: 0 });
      }

      const ledRes = await supabase.from('qg_token_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (ledRes.data) setLedger(ledRes.data);

      const redRes = await supabase.from('qg_token_redemptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
      if (redRes.data) {
        setRedemptions(redRes.data);
        const used = redRes.data.filter((r: any) => r.status === 'confirmed').reduce((s: number, r: any) => s + (r.tokens_used || 0), 0);
        setStats(prev => ({ ...prev, usedTokens: used }));
      }

      const invRes = await supabase.from('qg_launch_invites').select('*').eq('sender_user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (invRes.data) setInvites(invRes.data);

      const { data: balData, error: balErr } = await supabase.rpc('get_qg_token_balance', { user_uuid: user.id });
      if (!balErr && balData !== null) setBalance(balData);

      try {
        const { data: dashData } = await supabase.rpc('get_my_qg_token_dashboard', { user_uuid: user.id });
        if (dashData) setPreAccountData(dashData);
      } catch (_) {}

      const today = new Date().toISOString().slice(0, 10);
      const { data: rateData } = await supabase.from('qg_invite_rate_limits').select('invite_count').eq('user_id', user.id).eq('date', today).maybeSingle();
      const maxDay = 25;
      setDailyRemaining(maxDay - (rateData?.invite_count || 0));
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyLink = () => {
    const link = `${window.location.origin}/qg-launch-rewards?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareEmail = () => {
    const link = `${window.location.origin}/qg-launch-rewards?ref=${referralCode}`;
    const subject = encodeURIComponent('Join QuickGuard — QG Launch Rewards');
    const body = encodeURIComponent(`Hey! QuickGuard is opening early access and I thought you'd be interested. Create a verified guard or client profile using my referral link and we both earn QG Tokens (discount credits).\n\n${link}\n\n100 QG Tokens = £10 QuickGuard credit.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareWhatsApp = () => {
    const link = `${window.location.origin}/qg-launch-rewards?ref=${referralCode}`;
    const text = encodeURIComponent(`Join QuickGuard — QG Launch Rewards! Create a verified profile and earn QG Tokens towards discounts.\n\n${link}`);
    window.open(`https://wa.me/?text=${text}`);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSending(true);
    setInviteMsg('');
    setInviteErr('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setInviteErr('Not authenticated'); setInviteSending(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-qg-launch-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();
      if (!res.ok) { setInviteErr(data.error || 'Failed to send invite'); setInviteSending(false); return; }

      setInviteMsg(`Invite sent! ${data.daily_remaining} remaining today.`);
      setInviteForm({ recipient_name: '', recipient_email: '', recipient_role: 'guard', message_optional: '' });
      setDailyRemaining(data.daily_remaining);
      loadData();
    } catch (e: any) {
      setInviteErr(e.message);
    }
    setInviteSending(false);
  };

  const poundsValue = ((balance / 100) * 10).toFixed(2);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'invite', label: 'Invite', icon: 'ri-mail-send-line' },
    { key: 'referrals', label: 'Referrals', icon: 'ri-user-shared-line' },
    { key: 'tokens', label: 'Tokens', icon: 'ri-coins-line' },
    { key: 'redemptions', label: 'Redemptions', icon: 'ri-coupon-line' },
  ];

  const inviteStatusColors: Record<string, string> = {
    sent: 'bg-blue-500/10 text-blue-400',
    opened: 'bg-purple-500/10 text-purple-400',
    clicked: 'bg-teal-500/10 text-teal-400',
    signed_up: 'bg-amber-500/10 text-amber-400',
    verified: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    bounced: 'bg-red-500/10 text-red-400',
    queued: 'bg-slate-500/10 text-slate-400',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">QG Rewards</h1>
            <p className="text-slate-400 text-sm mt-1">Your referral programme dashboard</p>
          </div>
          <Link href="/guard/dashboard" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm whitespace-nowrap cursor-pointer">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
            Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-8 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Your QG Token Balance</p>
              <p className="text-5xl font-bold text-white">{balance.toLocaleString()}</p>
              <p className="text-teal-400 text-sm mt-2">≈ £{poundsValue} QuickGuard credit</p>
            </div>
            <Link href="/guard/payment-centre" className="px-6 py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer">
              Use on Subscription
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-8 bg-[#111d35] rounded-xl p-1 border border-[#1a2b4a]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${tab === t.key ? 'bg-teal-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className={t.icon}></i></div>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: 'Clicks', value: stats.clicks, icon: 'ri-cursor-line' },
                { label: 'Profiles Started', value: stats.started, icon: 'ri-user-add-line' },
                { label: 'Verified', value: stats.verified, icon: 'ri-verified-badge-line' },
                { label: 'Pending Tokens', value: stats.pendingTokens, icon: 'ri-hourglass-line' },
                { label: 'Approved Tokens', value: stats.approvedTokens, icon: 'ri-check-double-line' },
                { label: 'Used Tokens', value: stats.usedTokens, icon: 'ri-discount-percent-line' },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10 mb-3">
                    <i className={`${stat.icon} text-teal-400 text-sm`}></i>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Pre-Account Token Banner */}
            {preAccountData?.pre_account_tokens_linked && (
              <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-6 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/20 flex-shrink-0">
                    <i className="ri-link text-teal-400 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm mb-1">Good news — we found QG Tokens linked to your email address and added them to your QuickGuard rewards account.</h3>
                    <div className="flex flex-wrap gap-3 mt-3">
                      <div className="bg-[#0B1933] rounded-lg px-3 py-2 border border-[#1a2b4a]">
                        <p className="text-slate-400 text-[10px]">Pre-account Tokens</p>
                        <p className="text-teal-400 font-bold text-sm">{preAccountData.pre_account_pending_tokens?.toLocaleString() || 0}</p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg px-3 py-2 border border-[#1a2b4a]">
                        <p className="text-slate-400 text-[10px]">Status</p>
                        <p className="text-amber-400 font-medium text-xs capitalize">{preAccountData.pre_account_status?.replace(/_/g, ' ') || '—'}</p>
                      </div>
                      {preAccountData.pre_account_status === 'linked' && (
                        <p className="flex items-center gap-1 text-amber-400 text-xs self-end pb-2">
                          <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-information-line"></i></div>
                          These tokens will become usable after your QuickGuard account is verified.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {referralCode && (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 mb-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Your Referral Link</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="flex-1 bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-4 py-3 text-teal-400 text-sm font-mono break-all min-w-0">
                    {`quickguard.uk/qg-launch-rewards?ref=${referralCode}`}
                  </code>
                  <div className="flex gap-2">
                    <button onClick={copyLink} className="px-4 py-3 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-sm`}></i></div>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={shareEmail} className="w-11 h-11 flex items-center justify-center bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer" title="Share by email">
                      <i className="ri-mail-line text-base"></i>
                    </button>
                    <button onClick={shareWhatsApp} className="w-11 h-11 flex items-center justify-center bg-green-700 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer" title="Share on WhatsApp">
                      <i className="ri-whatsapp-line text-base"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center py-4">
              <button onClick={() => setTab('invite')} className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer">
                Invite Trusted Guards or Businesses
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-user-add-line"></i></div>
              </button>
            </div>

            {/* Terms Summary */}
            <div className="mt-12 bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-information-line text-teal-400"></i></div>
                Important Programme Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
                  <span>QG Tokens activate after verified account creation</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
                  <span>Tokens are discount credits only — no cash value</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
                  <span>Single-level referrals only</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
                  <span>Tokens cannot be withdrawn or transferred</span>
                </div>
              </div>
              <Link href="/qg-launch-rewards/terms" className="inline-block mt-3 text-teal-400 hover:text-teal-300 text-xs font-medium transition-colors cursor-pointer">
                Full programme terms →
              </Link>
            </div>
          </div>
        )}

        {/* Invite Tab */}
        {tab === 'invite' && (
          <div>
            <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-1">Invite by Email</h3>
              <p className="text-slate-400 text-sm mb-6">Invite trusted guards or businesses. You earn QG Tokens only when your referral creates a verified QuickGuard account.</p>

              {dailyRemaining !== null && (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-6 ${dailyRemaining > 5 ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : dailyRemaining > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-send-plane-line"></i></div>
                  {dailyRemaining} invite{dailyRemaining !== 1 ? 's' : ''} remaining today
                </div>
              )}

              {inviteMsg && <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400 text-sm">{inviteMsg}</div>}
              {inviteErr && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{inviteErr}</div>}

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Recipient Name</label>
                    <input
                      type="text"
                      value={inviteForm.recipient_name}
                      onChange={(e) => setInviteForm(p => ({ ...p, recipient_name: e.target.value }))}
                      placeholder="John Smith"
                      className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Recipient Email *</label>
                    <input
                      type="email"
                      required
                      value={inviteForm.recipient_email}
                      onChange={(e) => setInviteForm(p => ({ ...p, recipient_email: e.target.value }))}
                      placeholder="john@example.com"
                      className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Recipient Type</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setInviteForm(p => ({ ...p, recipient_role: 'guard' }))}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${inviteForm.recipient_role === 'guard' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#0B1933] border border-[#1a2b4a] text-slate-400 hover:text-white'}`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center mx-auto mb-1"><i className="ri-shield-user-line"></i></div>
                        Guard
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteForm(p => ({ ...p, recipient_role: 'client' }))}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${inviteForm.recipient_role === 'client' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#0B1933] border border-[#1a2b4a] text-slate-400 hover:text-white'}`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center mx-auto mb-1"><i className="ri-building-line"></i></div>
                        Client
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Optional Note</label>
                    <input
                      type="text"
                      value={inviteForm.message_optional}
                      onChange={(e) => setInviteForm(p => ({ ...p, message_optional: e.target.value }))}
                      placeholder="Hey, thought you'd be interested..."
                      className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500"
                      maxLength={300}
                    />
                  </div>
                </div>
                <button type="submit" disabled={inviteSending || dailyRemaining === 0} className="px-6 py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer disabled:opacity-50">
                  {inviteSending ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
            </div>

            {/* Recent Invites */}
            {invites.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Recent Invites</h3>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1a2b4a] text-slate-400">
                          <th className="text-left px-4 py-3 font-medium">Recipient</th>
                          <th className="text-left px-4 py-3 font-medium">Role</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-right px-4 py-3 font-medium">Sent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {invites.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-300 truncate max-w-[200px]">{inv.recipient_name || inv.recipient_email}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.recipient_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : inv.recipient_role === 'client' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                {inv.recipient_role || 'unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inviteStatusColors[inv.status] || 'bg-slate-500/10 text-slate-400'}`}>
                                {inv.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Referrals Tab */}
        {tab === 'referrals' && (
          <div>
            {referrals.length === 0 ? (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-12 text-center">
                <div className="w-12 h-12 flex items-center justify-center mx-auto rounded-full bg-teal-500/10 mb-4"><i className="ri-user-shared-line text-teal-400 text-xl"></i></div>
                <p className="text-slate-400">No referrals yet. Share your referral link or send an invite to get started.</p>
                <button onClick={() => setTab('invite')} className="mt-4 px-6 py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer">
                  Send Invite
                </button>
              </div>
            ) : (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2b4a] text-slate-400">
                        <th className="text-left px-5 py-3 font-medium">Email</th>
                        <th className="text-left px-5 py-3 font-medium">Role</th>
                        <th className="text-left px-5 py-3 font-medium">Status</th>
                        <th className="text-right px-5 py-3 font-medium">Tokens</th>
                        <th className="text-right px-5 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {referrals.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-800/30">
                          <td className="px-5 py-3 text-slate-300 truncate max-w-[200px]">{r.referred_email || '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.referred_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {r.referred_role || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              r.status === 'approved' ? 'bg-teal-500/10 text-teal-400' :
                              r.status === 'verified' ? 'bg-amber-500/10 text-amber-400' :
                              r.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                              'bg-slate-500/10 text-slate-400'
                            }`}>
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-teal-400 font-bold">{r.approved_tokens || r.pending_tokens || 0}</td>
                          <td className="px-5 py-3 text-right text-slate-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tokens Tab */}
        {tab === 'tokens' && (
          <div>
            {ledger.length === 0 ? (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-12 text-center">
                <div className="w-12 h-12 flex items-center justify-center mx-auto rounded-full bg-teal-500/10 mb-4"><i className="ri-coins-line text-teal-400 text-xl"></i></div>
                <p className="text-slate-400">No token activity yet. Earn tokens by referring verified guards and clients.</p>
              </div>
            ) : (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2b4a] text-slate-400">
                        <th className="text-left px-5 py-3 font-medium">Event</th>
                        <th className="text-right px-5 py-3 font-medium">Tokens</th>
                        <th className="text-left px-5 py-3 font-medium">Status</th>
                        <th className="text-right px-5 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {ledger.map((l: any) => (
                        <tr key={l.id}>
                          <td className="px-5 py-3"><span className="text-slate-300 capitalize">{l.event_type.replace(/_/g, ' ')}</span></td>
                          <td className={`px-5 py-3 text-right font-bold ${l.tokens > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                            {l.tokens > 0 ? '+' : ''}{l.tokens}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${l.status === 'approved' ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-500/10 text-slate-400'}`}>{l.status}</span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500 text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Redemptions Tab */}
        {tab === 'redemptions' && (
          <div>
            {redemptions.length === 0 ? (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-12 text-center">
                <div className="w-12 h-12 flex items-center justify-center mx-auto rounded-full bg-teal-500/10 mb-4"><i className="ri-coupon-line text-teal-400 text-xl"></i></div>
                <p className="text-slate-400">No redemptions yet. Use your tokens when subscribing or paying for QuickGuard services.</p>
                <Link href="/guard/payment-centre" className="mt-4 inline-block px-6 py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer">
                  Use Tokens Now
                </Link>
              </div>
            ) : (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2b4a] text-slate-400">
                        <th className="text-right px-4 py-3 font-medium">Tokens</th>
                        <th className="text-right px-4 py-3 font-medium">Credit</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Plan</th>
                        <th className="text-right px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {redemptions.map((r: any) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 text-right text-teal-400 font-bold">{r.tokens_used}</td>
                          <td className="px-4 py-3 text-right text-slate-300">£{(r.credit_pence / 100).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              r.status === 'confirmed' ? 'bg-teal-500/10 text-teal-400' :
                              r.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{r.plan_slug || r.account_type || '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}