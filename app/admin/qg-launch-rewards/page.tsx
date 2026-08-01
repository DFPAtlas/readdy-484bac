'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminQGLaunchRewardsPage() {
  const [tab, setTab] = useState<'overview' | 'referrals' | 'ledger' | 'redemptions' | 'invites' | 'campaigns' | 'fraud' | 'analytics' | 'audit_log' | 'pre_account_tokens' | 'launch_accounts' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIssued: 0, totalLiability: 0, pending: 0, approved: 0, rejected: 0 });
  const [referrals, setReferrals] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [fraudEvents, setFraudEvents] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>({});
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [programmeEnabled, setProgrammeEnabled] = useState(true);

  const [inviteFilter, setInviteFilter] = useState('all');
  const [inviteSearch, setInviteSearch] = useState('');

  const [campaignForm, setCampaignForm] = useState({ name: '', target_role: 'mixed', email_subject: '', email_preview: '', email_body_html: '', description: '', send_limit: 500 });
  const [showCampaignCreate, setShowCampaignCreate] = useState(false);
  const [campaignRecipients, setCampaignRecipients] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [testEmail, setTestEmail] = useState('');

  const [fraudFilter, setFraudFilter] = useState('all');
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [auditFilter, setAuditFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');

  const [clawbackNote, setClawbackNote] = useState('');
  const [showClawbackModal, setShowClawbackModal] = useState<string | null>(null);

  const [preAccountSearch, setPreAccountSearch] = useState('');
  const [preAccountFilter, setPreAccountFilter] = useState('all');
  const [preAccountTokens, setPreAccountTokens] = useState<any[]>([]);
  const [preAccountLoading, setPreAccountLoading] = useState(false);
  const [preAccountNote, setPreAccountNote] = useState('');
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null);
  const [linkUserId, setLinkUserId] = useState('');

  const [launchAccountSearch, setLaunchAccountSearch] = useState('');
  const [launchAccountFilter, setLaunchAccountFilter] = useState('all');
  const [launchAccounts, setLaunchAccounts] = useState<any[]>([]);
  const [launchAccountLoading, setLaunchAccountLoading] = useState(false);

  const [updateForm, setUpdateForm] = useState({ title: '', summary: '', body: '', audience: 'all' });
  const [showUpdateCreate, setShowUpdateCreate] = useState(false);
  const [launchUpdates, setLaunchUpdates] = useState<any[]>([]);
  const [updateLoading, setUpdateLoading] = useState(false);

  const [publicStats, setPublicStats] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  async function callAnalytics(action: string, body: any = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-analytics`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  }

  async function callFraud(action: string, body: any = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-fraud-scan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  }

  const loadAll = useCallback(async () => {
    setLoading(true);

    // Referrals
    let refQuery = supabase.from('qg_referrals').select('*').order('created_at', { ascending: false }).limit(200);
    if (searchQuery) refQuery = refQuery.or(`referred_email.ilike.%${searchQuery}%,referrer_user_id.eq.${searchQuery}`);
    const { data: refData } = await refQuery;
    if (refData) {
      setReferrals(refData);
      const pending = refData.filter(r => r.status === 'verified').length;
      const approved = refData.filter(r => r.status === 'approved').length;
      const rejected = refData.filter(r => r.status === 'rejected').length;
      const totalApprovedTokens = refData.filter(r => r.status === 'approved').reduce((s, r) => s + (r.approved_tokens || 0), 0);
      const totalPending = refData.filter(r => r.status === 'verified').reduce((s, r) => s + (r.pending_tokens || 0), 0);
      setStats({ totalIssued: totalApprovedTokens + totalPending, totalLiability: ((totalApprovedTokens + totalPending) / 100) * 10, pending, approved, rejected });
    }

    const { data: ledData } = await supabase.from('qg_token_ledger').select('*').order('created_at', { ascending: false }).limit(200);
    if (ledData) setLedger(ledData);

    const { data: redData } = await supabase.from('qg_token_redemptions').select('*').order('created_at', { ascending: false }).limit(200);
    if (redData) setRedemptions(redData);

    const { data: invData } = await supabase.from('qg_launch_invites').select('*').order('created_at', { ascending: false }).limit(200);
    if (invData) setInvites(invData);

    const { data: campData } = await supabase.from('qg_launch_campaigns').select('*').order('created_at', { ascending: false });
    if (campData) setCampaigns(campData);

    const { data: fraData } = await supabase.from('qg_fraud_events').select('*').order('created_at', { ascending: false }).limit(200);
    if (fraData) setFraudEvents(fraData);

    const { data: audData } = await supabase.from('qg_launch_reward_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (audData) setAuditLog(audData);

    const { data: setData } = await supabase.from('qg_launch_reward_settings').select('*');
    if (setData) {
      const map: any = {};
      setData.forEach((r: any) => { try { map[r.key] = JSON.parse(r.value); } catch { map[r.key] = r.value; } });
      setSettings(map);
      setProgrammeEnabled(map.programme_enabled === true || map.programme_enabled === 'true');
    }

    // Load analytics overview
    const analyticsOverview = await callAnalytics('get_overview');
    if (analyticsOverview) setAnalyticsData(analyticsOverview);

    setLoading(false);
  }, [searchQuery]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (tab === 'pre_account_tokens') loadPreAccountTokens();
  }, [tab]);

  const handleApprove = async (refId: string) => {
    setActionLoading(refId); setActionMsg(''); setActionErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/approve_qg_referral`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
        body: JSON.stringify({ referral_uuid: refId }),
      });
      if (!res.ok) { setActionErr('Failed to approve'); setActionLoading(null); return; }
      setActionMsg('Approved!'); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleReject = async (refId: string) => {
    setActionLoading(refId); setActionMsg(''); setActionErr('');
    try {
      const { error } = await supabase.from('qg_referrals').update({ status: 'rejected', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', refId);
      if (error) { setActionErr(error.message); setActionLoading(null); return; }
      setActionMsg('Rejected'); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleManualAdjust = async (userId: string, tokens: number, note: string) => {
    setActionLoading('manual'); setActionMsg(''); setActionErr('');
    try {
      const { error } = await supabase.from('qg_token_ledger').insert({ user_id: userId, event_type: 'manual_adjustment', tokens, status: 'approved', admin_note: note, created_by: (await supabase.auth.getUser()).data.user?.id });
      if (error) { setActionErr(error.message); setActionLoading(null); return; }
      setActionMsg(`${tokens > 0 ? 'Added' : 'Deducted'} ${Math.abs(tokens)} tokens`); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleResendInvite = async (inviteId: string) => {
    setActionLoading(inviteId); setActionMsg(''); setActionErr('');
    try {
      const { data: inv } = await supabase.from('qg_launch_invites').select('*').eq('id', inviteId).maybeSingle();
      if (!inv) { setActionErr('Invite not found'); setActionLoading(null); return; }
      await supabase.from('email_queue').insert({ to_email: inv.recipient_email, subject: 'You\'re invited to QG Launch Rewards', html_body: `<p>Join QG Launch Rewards: <a href="${inv.invite_url}">${inv.invite_url}</a></p>`, template_name: 'qg_launch_rewards_invite', status: 'pending', created_at: new Date().toISOString() });
      await supabase.from('qg_launch_invites').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', inviteId);
      setActionMsg('Invite resent'); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleCancelInvite = async (inviteId: string) => {
    setActionLoading(inviteId); setActionMsg(''); setActionErr('');
    try {
      await supabase.from('qg_launch_invites').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', inviteId);
      setActionMsg('Invite cancelled'); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleSuppressEmail = async (email: string) => {
    setActionLoading('suppress'); setActionMsg(''); setActionErr('');
    try {
      await supabase.from('email_suppression_list').upsert({ email: email.toLowerCase().trim(), reason: 'manual_block', source: 'qg_launch_rewards', created_at: new Date().toISOString() }, { onConflict: 'email' });
      setActionMsg(`${email} added to suppression list`); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleToggleProgramme = async () => {
    const newVal = !programmeEnabled;
    setProgrammeEnabled(newVal);
    await supabase.from('qg_launch_reward_settings').upsert({ key: 'programme_enabled', value: JSON.stringify(newVal), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setActionMsg(`Programme ${newVal ? 'enabled' : 'disabled'}`);
  };

  const handleSaveSetting = async (key: string, value: any) => {
    const jsonVal = typeof value === 'boolean' ? JSON.stringify(value) : (typeof value === 'number' ? String(value) : JSON.stringify(value));
    await supabase.from('qg_launch_reward_settings').upsert({ key, value: jsonVal, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setActionMsg(`${key} updated`); loadAll();
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).filter(k => k !== 'metadata').join(',');
    const rows = data.map((r: any) => {
      const { metadata, ...rest } = r;
      return Object.values(rest).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v !== null ? v : '').join(',');
    });
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleScanReferral = async (refId: string) => {
    setActionLoading(`scan_${refId}`); setActionMsg(''); setActionErr('');
    const result = await callFraud('scan_referral', { referral_id: refId });
    if (result?.error) setActionErr(result.error);
    else setActionMsg(`Risk score: ${result?.risk?.risk_level} (${result?.risk?.risk_score})`);
    setActionLoading(null); loadAll();
  };

  const handleFraudAction = async (eventId: string, action: string) => {
    setActionLoading(`fraud_${eventId}`); setActionMsg(''); setActionErr('');
    const result = await callFraud(action, { event_id: eventId });
    if (result?.error) setActionErr(result.error);
    else setActionMsg(`Fraud event ${action.replace('_fraud_event', '')}`);
    setActionLoading(null); loadAll();
  };

  const handleClawback = async () => {
    if (!showClawbackModal) return;
    setActionLoading('clawback'); setActionMsg(''); setActionErr('');
    try {
      const ref = referrals.find(r => r.id === showClawbackModal);
      if (!ref || !ref.referrer_user_id) return;
      const tokens = ref.approved_tokens || 0;
      if (tokens > 0) {
        await supabase.from('qg_token_ledger').insert({
          user_id: ref.referrer_user_id, event_type: 'clawback', tokens: -tokens, status: 'approved',
          admin_note: clawbackNote || 'Manual clawback', created_by: (await supabase.auth.getUser()).data.user?.id,
          related_referral_id: ref.id,
        });
      }
      await supabase.from('qg_referrals').update({ status: 'cancelled', approved_tokens: 0, pending_tokens: 0, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', showClawbackModal);
      setActionMsg(`Clawed back ${tokens} tokens`); setShowClawbackModal(null); setClawbackNote(''); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleRefreshStats = async () => {
    setActionLoading('refresh'); setActionMsg(''); setActionErr('');
    const result = await callAnalytics('refresh_daily_stats', { stat_date: new Date().toISOString().slice(0, 10) });
    if (result?.error) setActionErr(result.error);
    else setActionMsg('Daily stats refreshed');
    setActionLoading(null); loadAll();
  };

  const handleAnalyticsExport = async (type: string) => {
    setActionLoading('export'); setActionMsg(''); setActionErr('');
    const result = await callAnalytics('export_report_csv', { export_type: type });
    if (result?.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `qg_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      setActionMsg('CSV exported');
    } else if (result?.error) setActionErr(result.error);
    setActionLoading(null);
  };

  const handleCreateCampaign = async () => {
    setActionLoading('create_campaign'); setActionMsg(''); setActionErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-campaign-admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'create_campaign', ...campaignForm }),
      });
      const data = await res.json();
      if (!res.ok) { setActionErr(data.error || 'Failed'); setActionLoading(null); return; }
      setActionMsg('Campaign created!'); setShowCampaignCreate(false); setCampaignForm({ name: '', target_role: 'mixed', email_subject: '', email_preview: '', email_body_html: '', description: '', send_limit: 500 });
      loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleCampaignAction = async (campaignId: string, action: string) => {
    setActionLoading(campaignId); setActionMsg(''); setActionErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-campaign-admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) { setActionErr(data.error || 'Failed'); setActionLoading(null); return; }
      setActionMsg(`Campaign ${action.replace('_campaign', '')}d`); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleImportRecipients = async () => {
    if (!selectedCampaignId || !campaignRecipients.trim()) return;
    setActionLoading('import'); setActionMsg(''); setActionErr('');
    const lines = campaignRecipients.split('\n').filter(l => l.trim());
    const recipients = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { email: parts[0] || '', name: parts[1] || '', role: parts[2] || '' };
    }).filter(r => r.email);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-campaign-admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'import_recipients', campaign_id: selectedCampaignId, recipients }),
      });
      const data = await res.json();
      if (!res.ok) { setActionErr(data.error || 'Failed'); setActionLoading(null); return; }
      setImportResult(data);
      setActionMsg(`Imported ${data.imported}, skipped ${data.skipped}`);
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleSendBatch = async () => {
    if (!selectedCampaignId || !campaignRecipients.trim()) return;
    setActionLoading('send_batch'); setActionMsg(''); setActionErr('');
    const emails = campaignRecipients.split('\n').map(l => l.split(',')[0]?.trim()).filter(Boolean);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-campaign-admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'send_campaign_batch', campaign_id: selectedCampaignId, recipient_emails: emails }),
      });
      const data = await res.json();
      if (!res.ok) { setActionErr(data.error || 'Failed'); setActionLoading(null); return; }
      setActionMsg(`Sent ${data.sent} emails!`); loadAll();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleSendTestEmail = async () => {
    if (!selectedCampaignId || !testEmail) return;
    setActionLoading('test_email'); setActionMsg(''); setActionErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-campaign-admin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'send_test_email', campaign_id: selectedCampaignId, test_email: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setActionErr(data.error || 'Failed'); setActionLoading(null); return; }
      setActionMsg(`Test email queued to ${testEmail}`);
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCampaignRecipients(text);
    };
    reader.readAsText(file);
  };

  const getFilteredInvites = () => {
    let filtered = invites;
    if (inviteFilter !== 'all') filtered = filtered.filter(i => i.status === inviteFilter);
    if (inviteSearch) filtered = filtered.filter(i => (i.recipient_email || '').toLowerCase().includes(inviteSearch.toLowerCase()) || (i.recipient_name || '').toLowerCase().includes(inviteSearch.toLowerCase()));
    return filtered;
  };

  const getFilteredFraud = () => {
    if (fraudFilter === 'all') return fraudEvents;
    if (fraudFilter === 'open') return fraudEvents.filter(f => f.review_status === 'open');
    if (fraudFilter === 'high_critical') return fraudEvents.filter(f => f.severity === 'high' || f.severity === 'critical');
    if (fraudFilter === 'confirmed') return fraudEvents.filter(f => f.review_status === 'confirmed');
    return fraudEvents;
  };

  const getFilteredAudit = () => {
    let filtered = auditLog;
    if (auditFilter !== 'all') filtered = filtered.filter(a => a.action === auditFilter);
    if (auditSearch) filtered = filtered.filter(a => (a.actor_role || '').toLowerCase().includes(auditSearch.toLowerCase()) || a.action.toLowerCase().includes(auditSearch.toLowerCase()));
    return filtered;
  };

  const filteredInvites = getFilteredInvites();
  const filteredFraud = getFilteredFraud();
  const filteredAudit = getFilteredAudit();

  const getFilteredPreAccount = () => {
    let filtered = preAccountTokens;
    if (preAccountFilter !== 'all') filtered = filtered.filter(p => p.status === preAccountFilter);
    if (preAccountSearch) filtered = filtered.filter(p => (p.email || '').toLowerCase().includes(preAccountSearch.toLowerCase()) || (p.email_normalised || '').toLowerCase().includes(preAccountSearch.toLowerCase()) || (p.referral_code || '').toLowerCase().includes(preAccountSearch.toLowerCase()));
    return filtered;
  };

  const loadPreAccountTokens = async () => {
    setPreAccountLoading(true);
    const { data } = await supabase.from('qg_pre_account_tokens').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setPreAccountTokens(data);
    setPreAccountLoading(false);
  };

  const handlePreAccountAction = async (id: string, action: string, note?: string) => {
    setActionLoading(`pre_${id}`); setActionMsg(''); setActionErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setActionErr('Not authenticated'); setActionLoading(null); return; }

      if (action === 'link' && linkUserId) {
        const { data: row } = await supabase.from('qg_pre_account_tokens').select('email').eq('id', id).maybeSingle();
        if (row?.email) {
          const { error: linkErr } = await supabase.rpc('link_qg_pre_account_tokens', { user_uuid: linkUserId, user_email: row.email });
          if (linkErr) { setActionErr(linkErr.message); } else { setActionMsg('Linked successfully'); setShowLinkModal(null); setLinkUserId(''); }
        } else {
          setActionErr('Pre-account token record not found');
        }
        loadPreAccountTokens(); loadAll();
      } else if (action === 'cancel') {
        await supabase.from('qg_pre_account_tokens').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
        setActionMsg('Pre-account tokens cancelled');
        loadPreAccountTokens();
      } else if (action === 'reject') {
        await supabase.from('qg_pre_account_tokens').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id);
        setActionMsg('Pre-account tokens rejected');
        loadPreAccountTokens();
      }
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const filteredPreAccount = getFilteredPreAccount();

  const getFilteredLaunchAccounts = () => {
    let filtered = launchAccounts;
    if (launchAccountFilter !== 'all') filtered = filtered.filter(a => a.profile_status === launchAccountFilter);
    if (launchAccountSearch) filtered = filtered.filter(a => (a.email || '').toLowerCase().includes(launchAccountSearch.toLowerCase()) || (a.name || '').toLowerCase().includes(launchAccountSearch.toLowerCase()));
    return filtered;
  };

  const loadLaunchAccounts = async () => {
    setLaunchAccountLoading(true);
    const { data } = await supabase.from('qg_launch_profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setLaunchAccounts(data);
    setLaunchAccountLoading(false);
  };

  const loadLaunchUpdates = async () => {
    setUpdateLoading(true);
    const { data } = await supabase.from('qg_launch_updates').select('*').order('published_at', { ascending: false }).limit(50);
    if (data) setLaunchUpdates(data);
    setUpdateLoading(false);
  };

  const loadPublicStats = async () => {
    setStatsLoading(true);
    const { data } = await supabase.from('qg_launch_public_stats').select('*').order('key');
    if (data) setPublicStats(data);
    setStatsLoading(false);
  };

  const handleCreateUpdate = async () => {
    setActionLoading('create_update'); setActionMsg(''); setActionErr('');
    try {
      await supabase.from('qg_launch_updates').insert({ ...updateForm, status: 'published', published_at: new Date().toISOString() });
      setActionMsg('Update published!'); setShowUpdateCreate(false); setUpdateForm({ title: '', summary: '', body: '', audience: 'all' }); loadLaunchUpdates();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleUpdateAction = async (id: string, action: string) => {
    setActionLoading(`update_${id}`); setActionMsg(''); setActionErr('');
    try {
      if (action === 'archive') await supabase.from('qg_launch_updates').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id);
      else if (action === 'publish') await supabase.from('qg_launch_updates').update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      else if (action === 'unpublish') await supabase.from('qg_launch_updates').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', id);
      setActionMsg(`Update ${action}ed`); loadLaunchUpdates();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleTogglePublicStat = async (key: string, currentVal: boolean) => {
    await supabase.from('qg_launch_public_stats').update({ is_public: !currentVal, updated_at: new Date().toISOString() }).eq('key', key);
    loadPublicStats();
  };

  const handleUpdateStatValue = async (key: string, value: string) => {
    let jsonVal: any;
    try { jsonVal = JSON.parse(value); } catch { jsonVal = value; }
    await supabase.from('qg_launch_public_stats').update({ value: jsonVal, updated_at: new Date().toISOString() }).eq('key', key);
    setActionMsg(`${key} updated`); loadPublicStats();
  };

  const handleCancelLaunchAccount = async (id: string) => {
    setActionLoading(`la_${id}`); setActionMsg(''); setActionErr('');
    try {
      await supabase.from('qg_launch_profiles').update({ profile_status: 'temporary', linked_user_id: null, updated_at: new Date().toISOString() }).eq('id', id);
      setActionMsg('Launch account cancelled'); loadLaunchAccounts();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  const handleRefreshPublicStats = async () => {
    setActionLoading('refresh_stats'); setActionMsg(''); setActionErr('');
    try {
      const { count: members } = await supabase.from('qg_launch_profiles').select('*', { count: 'exact', head: true });
      const { count: guards } = await supabase.from('qg_launch_profiles').select('*', { count: 'exact', head: true }).eq('intended_role', 'guard');
      const { count: clients } = await supabase.from('qg_launch_profiles').select('*', { count: 'exact', head: true }).eq('intended_role', 'client');
      const { data: tokenSum } = await supabase.from('qg_pre_account_tokens').select('pending_tokens,approved_tokens');
      const totalTokens = (tokenSum || []).reduce((s, r) => s + (r.pending_tokens || 0) + (r.approved_tokens || 0), 0);
      
      await supabase.from('qg_launch_public_stats').upsert({ key: 'total_launch_members', value: String(members || 0), updated_at: new Date().toISOString() });
      await supabase.from('qg_launch_public_stats').upsert({ key: 'total_guard_interest', value: String(guards || 0), updated_at: new Date().toISOString() });
      await supabase.from('qg_launch_public_stats').upsert({ key: 'total_client_interest', value: String(clients || 0), updated_at: new Date().toISOString() });
      await supabase.from('qg_launch_public_stats').upsert({ key: 'total_qg_tokens_issued', value: String(totalTokens), updated_at: new Date().toISOString() });
      setActionMsg('Public stats refreshed'); loadPublicStats();
    } catch (e: any) { setActionErr(e.message); }
    setActionLoading(null);
  };

  useEffect(() => {
    if (tab === 'launch_accounts') { loadLaunchAccounts(); loadLaunchUpdates(); loadPublicStats(); }
  }, [tab]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'referrals', label: 'Referrals', icon: 'ri-user-shared-line' },
    { key: 'ledger', label: 'Tokens', icon: 'ri-coins-line' },
    { key: 'redemptions', label: 'Redemptions', icon: 'ri-coupon-line' },
    { key: 'invites', label: 'Invites', icon: 'ri-mail-send-line' },
    { key: 'campaigns', label: 'Campaigns', icon: 'ri-megaphone-line' },
    { key: 'fraud', label: 'Fraud', icon: 'ri-spy-line' },
    { key: 'analytics', label: 'Analytics', icon: 'ri-bar-chart-line' },
    { key: 'audit_log', label: 'Audit Log', icon: 'ri-file-list-3-line' },
    { key: 'pre_account_tokens', label: 'Pre-Account', icon: 'ri-mail-check-line' },
    { key: 'launch_accounts', label: 'Accounts', icon: 'ri-user-star-line' },
    { key: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  ];

  const inviteStatusColors: Record<string, string> = {
    sent: 'bg-blue-500/10 text-blue-400', opened: 'bg-purple-500/10 text-purple-400',
    clicked: 'bg-teal-500/10 text-teal-400', signed_up: 'bg-amber-500/10 text-amber-400',
    verified: 'bg-emerald-500/10 text-emerald-400', failed: 'bg-red-500/10 text-red-400',
    bounced: 'bg-red-500/10 text-red-400', cancelled: 'bg-slate-500/10 text-slate-400',
    queued: 'bg-slate-500/10 text-slate-400', complained: 'bg-orange-500/10 text-orange-400',
  };

  const fraudSeverityColors: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-400', medium: 'bg-amber-500/10 text-amber-400',
    high: 'bg-orange-500/10 text-orange-400', critical: 'bg-red-500/10 text-red-400',
  };

  const fraudReviewColors: Record<string, string> = {
    open: 'bg-red-500/10 text-red-400', reviewing: 'bg-blue-500/10 text-blue-400',
    cleared: 'bg-teal-500/10 text-teal-400', confirmed: 'bg-orange-500/10 text-orange-400',
    ignored: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">QG Launch Rewards</h1>
            <p className="text-slate-400 text-sm mt-1">Administer referrals, tokens, fraud, analytics, and programme settings</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRefreshStats} disabled={actionLoading === 'refresh'} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
              Refresh Stats
            </button>
            <button onClick={handleToggleProgramme} className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap cursor-pointer transition-all ${programmeEnabled ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-teal-500 text-slate-900 hover:bg-teal-400'}`}>
              {programmeEnabled ? 'Pause Programme' : 'Enable Programme'}
            </button>
          </div>
        </div>

        {actionMsg && <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400 text-sm">{actionMsg}</div>}
        {actionErr && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{actionErr}</div>}

        <div className="flex flex-wrap gap-1 mb-8 bg-[#111d35] rounded-xl p-1 border border-[#1a2b4a]">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${tab === t.key ? 'bg-teal-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              <div className="w-4 h-4 flex items-center justify-center"><i className={t.icon}></i></div>
              {t.label}
              {t.key === 'fraud' && fraudEvents.filter(f => f.review_status === 'open').length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{fraudEvents.filter(f => f.review_status === 'open').length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent"></div></div>
        ) : (
          <>
            {/* ===== OVERVIEW ===== */}
            {tab === 'overview' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5"><p className="text-slate-400 text-xs mb-1">Total Issued</p><p className="text-3xl font-bold text-teal-400">{stats.totalIssued.toLocaleString()}</p><p className="text-slate-500 text-xs mt-1">QG Tokens</p></div>
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5"><p className="text-slate-400 text-xs mb-1">Liability</p><p className="text-3xl font-bold text-amber-400">£{stats.totalLiability.toFixed(0)}</p><p className="text-slate-500 text-xs mt-1">Credit value</p></div>
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5"><p className="text-slate-400 text-xs mb-1">Pending</p><p className="text-3xl font-bold text-amber-400">{stats.pending}</p><p className="text-slate-500 text-xs mt-1">Referrals</p></div>
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5"><p className="text-slate-400 text-xs mb-1">Approved</p><p className="text-3xl font-bold text-teal-400">{stats.approved}</p><p className="text-slate-500 text-xs mt-1">Referrals</p></div>
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-5"><p className="text-slate-400 text-xs mb-1">Fraud Alerts</p><p className="text-3xl font-bold text-red-400">{fraudEvents.filter(f => f.review_status === 'open').length}</p><p className="text-slate-500 text-xs mt-1">Open reviews</p></div>
                </div>
                {analyticsData && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Referral Clicks</p><p className="text-lg font-bold text-white">{analyticsData.totalClicks || 0}</p></div>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Guard Signups</p><p className="text-lg font-bold text-white">{analyticsData.guardSignups || 0}</p></div>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Client Signups</p><p className="text-lg font-bold text-white">{analyticsData.clientSignups || 0}</p></div>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Verification Rate</p><p className="text-lg font-bold text-teal-400">{analyticsData.verificationRate || 0}%</p></div>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Invites Sent</p><p className="text-lg font-bold text-white">{analyticsData.invitesSent || 0}</p></div>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3"><p className="text-xs text-slate-400">Fraud Rate</p><p className="text-lg font-bold text-red-400">{fraudEvents.length} events</p></div>
                  </div>
                )}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => handleExportCSV(referrals, 'qg_referrals')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                    </button>
                    <button onClick={loadAll} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>Refresh
                    </button>
                    <button onClick={() => setTab('fraud')} className="px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-spy-line"></i></div>
                      Review Fraud ({fraudEvents.filter(f => f.review_status === 'open').length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== REFERRALS ===== */}
            {tab === 'referrals' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex-1 min-w-[250px]">
                    <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                      <div className="w-9 h-9 flex items-center justify-center pl-2"><i className="ri-search-line text-slate-400 text-sm"></i></div>
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by email or user ID..." className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3 py-2.5" />
                    </div>
                  </div>
                  <button onClick={() => handleExportCSV(referrals, 'qg_referrals')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                </div>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Email</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-right px-4 py-3 font-medium">Pending</th><th className="text-right px-4 py-3 font-medium">Approved</th><th className="text-left px-4 py-3 font-medium">Fraud</th><th className="text-right px-4 py-3 font-medium">Date</th><th className="text-right px-4 py-3 font-medium">Actions</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {referrals.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate">{r.referred_email || '—'}</td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.referred_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{r.referred_role || '—'}</span></td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-teal-500/10 text-teal-400' : r.status === 'verified' ? 'bg-amber-500/10 text-amber-400' : r.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                            <td className="px-4 py-3 text-right text-amber-400">{r.pending_tokens || 0}</td>
                            <td className="px-4 py-3 text-right text-teal-400 font-bold">{r.approved_tokens || 0}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {r.fraud_flags && r.fraud_flags.length > 0 ? <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{r.fraud_flags.length} flag{r.fraud_flags.length > 1 ? 's' : ''}</span> : <span className="text-slate-600 text-xs">—</span>}
                                <button onClick={() => handleScanReferral(r.id)} disabled={actionLoading === `scan_${r.id}`} className="text-slate-500 hover:text-teal-400 cursor-pointer" title="Scan for fraud"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-scan-line text-xs"></i></div></button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {r.status !== 'rejected' && r.status !== 'approved' && <button onClick={() => handleApprove(r.id)} disabled={actionLoading === r.id} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">{actionLoading === r.id ? '...' : 'Approve'}</button>}
                                {r.status !== 'rejected' && r.status !== 'cancelled' && <button onClick={() => handleReject(r.id)} disabled={actionLoading === r.id} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Reject</button>}
                                {r.status === 'approved' && <button onClick={() => { setShowClawbackModal(r.id); setClawbackNote(''); }} className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors whitespace-nowrap cursor-pointer">Clawback</button>}
                                {r.status === 'rejected' && <span className="text-red-400 text-xs">Rejected</span>}
                                {r.status === 'cancelled' && <span className="text-slate-500 text-xs">Cancelled</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {referrals.length === 0 && <div className="py-12 text-center text-slate-500">No referrals found</div>}
                </div>
              </div>
            )}

            {/* ===== TOKEN LEDGER ===== */}
            {tab === 'ledger' && (
              <div>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 mb-6">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Manual Token Adjustment</h3>
                  <form onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); handleManualAdjust(form.get('userId') as string, parseInt(form.get('tokens') as string), form.get('note') as string); }} className="flex flex-wrap items-end gap-3">
                    <div><label className="block text-xs text-slate-400 mb-1">User ID</label><input name="userId" required className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-64" placeholder="UUID" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Tokens (negative to deduct)</label><input name="tokens" type="number" required className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-28" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Note</label><input name="note" required className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-48" placeholder="Reason" /></div>
                    <button type="submit" disabled={actionLoading === 'manual'} className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer">{actionLoading === 'manual' ? '...' : 'Adjust'}</button>
                  </form>
                </div>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">User ID</th><th className="text-left px-4 py-3 font-medium">Event</th><th className="text-right px-4 py-3 font-medium">Tokens</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Note</th><th className="text-right px-4 py-3 font-medium">Date</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {ledger.map((l: any) => (
                          <tr key={l.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[120px] truncate">{l.user_id?.substring(0, 12)}...</td>
                            <td className="px-4 py-3"><span className="text-slate-300 text-xs capitalize">{l.event_type.replace(/_/g, ' ')}</span></td>
                            <td className={`px-4 py-3 text-right font-bold text-xs ${l.tokens > 0 ? 'text-teal-400' : 'text-red-400'}`}>{l.tokens > 0 ? '+' : ''}{l.tokens}</td>
                            <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${l.status === 'approved' ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-500/10 text-slate-400'}`}>{l.status}</span></td>
                            <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{l.admin_note || '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-500 text-[11px]">{new Date(l.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {ledger.length === 0 && <div className="py-12 text-center text-slate-500">No ledger entries</div>}
                </div>
              </div>
            )}

            {/* ===== REDEMPTIONS ===== */}
            {tab === 'redemptions' && (
              <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">User ID</th><th className="text-right px-4 py-3 font-medium">Tokens</th><th className="text-right px-4 py-3 font-medium">Credit</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Plan</th><th className="text-left px-4 py-3 font-medium">Stripe</th><th className="text-right px-4 py-3 font-medium">Date</th></tr></thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {redemptions.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[100px] truncate">{r.user_id?.substring(0, 10)}...</td>
                          <td className="px-4 py-3 text-right text-teal-400 font-bold">{r.tokens_used}</td>
                          <td className="px-4 py-3 text-right text-slate-300">£{(r.credit_pence / 100).toFixed(2)}</td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'confirmed' ? 'bg-teal-500/10 text-teal-400' : r.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : r.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{r.status}</span></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{r.plan_slug || r.account_type || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[120px] truncate">{r.stripe_checkout_session_id?.substring(0, 16) || '—'}...</td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {redemptions.length === 0 && <div className="py-12 text-center text-slate-500">No redemptions yet</div>}
              </div>
            )}

            {/* ===== INVITES ===== */}
            {tab === 'invites' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                      <div className="w-9 h-9 flex items-center justify-center pl-2"><i className="ri-search-line text-slate-400 text-sm"></i></div>
                      <input type="text" value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} placeholder="Search by email or name..." className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3 py-2.5" />
                    </div>
                  </div>
                  <select value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value)} className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 pr-8">
                    <option value="all">All Statuses</option>
                    <option value="sent">Sent</option><option value="opened">Opened</option><option value="clicked">Clicked</option>
                    <option value="signed_up">Signed Up</option><option value="verified">Verified</option>
                    <option value="failed">Failed</option><option value="bounced">Bounced</option>
                  </select>
                  <button onClick={() => handleExportCSV(filteredInvites, 'qg_invites')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                  {[{ label: 'Total', value: invites.length },{ label: 'Sent', value: invites.filter(i => i.status === 'sent').length },{ label: 'Clicked', value: invites.filter(i => i.status === 'clicked').length },{ label: 'Signed Up', value: invites.filter(i => i.status === 'signed_up').length },{ label: 'Verified', value: invites.filter(i => i.status === 'verified').length },{ label: 'Failed', value: invites.filter(i => i.status === 'failed').length },{ label: 'Bounced', value: invites.filter(i => i.status === 'bounced').length },{ label: 'Cancelled', value: invites.filter(i => i.status === 'cancelled').length }].map(s => (
                    <div key={s.label} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3 text-center"><p className="text-xs text-slate-400 mb-1">{s.label}</p><p className="text-xl font-bold text-white">{s.value}</p></div>
                  ))}
                </div>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Recipient</th><th className="text-left px-4 py-3 font-medium">Sender</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Ref Code</th><th className="text-right px-4 py-3 font-medium">Sent</th><th className="text-right px-4 py-3 font-medium">Actions</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {filteredInvites.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{inv.recipient_name || inv.recipient_email}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[100px] truncate">{inv.sender_user_id?.substring(0, 10)}...</td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.recipient_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : inv.recipient_role === 'client' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>{inv.recipient_role || '—'}</span></td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inviteStatusColors[inv.status] || 'bg-slate-500/10 text-slate-400'}`}>{inv.status.replace(/_/g, ' ')}</span></td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">{inv.referral_code || '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1.5">
                              {(inv.status === 'failed' || inv.status === 'bounced') && <button onClick={() => handleResendInvite(inv.id)} disabled={actionLoading === inv.id} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">Resend</button>}
                              {!['cancelled','verified','signed_up'].includes(inv.status) && <button onClick={() => handleCancelInvite(inv.id)} disabled={actionLoading === inv.id} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>}
                              <button onClick={() => handleSuppressEmail(inv.recipient_email)} className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors whitespace-nowrap cursor-pointer">Suppress</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredInvites.length === 0 && <div className="py-12 text-center text-slate-500">No invites found</div>}
                </div>
              </div>
            )}

            {/* ===== CAMPAIGNS ===== */}
            {tab === 'campaigns' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h3 className="text-lg font-semibold text-white">Campaigns</h3>
                  <button onClick={() => setShowCampaignCreate(!showCampaignCreate)} className="px-4 py-2.5 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                    {showCampaignCreate ? 'Cancel' : 'Create Campaign'}
                  </button>
                </div>

                {showCampaignCreate && (
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 mb-6">
                    <h3 className="text-md font-semibold text-white mb-4">New Campaign</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Campaign Name *</label><input value={campaignForm.name} onChange={(e) => setCampaignForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Summer Launch" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Target Role</label><select value={campaignForm.target_role} onChange={(e) => setCampaignForm(p => ({ ...p, target_role: e.target.value }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 pr-8"><option value="mixed">Mixed</option><option value="guard">Guard</option><option value="client">Client</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Email Subject *</label><input value={campaignForm.email_subject} onChange={(e) => setCampaignForm(p => ({ ...p, email_subject: e.target.value }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Join QuickGuard's launch..." /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Preview Text</label><input value={campaignForm.email_preview} onChange={(e) => setCampaignForm(p => ({ ...p, email_preview: e.target.value }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Preview shown in inbox..." /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Send Limit</label><input type="number" value={campaignForm.send_limit} onChange={(e) => setCampaignForm(p => ({ ...p, send_limit: parseInt(e.target.value) || 500 }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Description</label><input value={campaignForm.description} onChange={(e) => setCampaignForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Internal notes..." /></div>
                    </div>
                    <div className="mb-4"><label className="block text-xs text-slate-400 mb-1">HTML Body</label><textarea value={campaignForm.email_body_html} onChange={(e) => setCampaignForm(p => ({ ...p, email_body_html: e.target.value }))} rows={5} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 font-mono" placeholder="<p>Your email HTML here...</p>" /></div>
                    <button onClick={handleCreateCampaign} disabled={actionLoading === 'create_campaign' || !campaignForm.name || !campaignForm.email_subject} className="px-6 py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer disabled:opacity-50">{actionLoading === 'create_campaign' ? 'Creating...' : 'Create Campaign'}</button>
                  </div>
                )}

                {campaigns.length === 0 ? (
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-12 text-center">
                    <div className="w-12 h-12 flex items-center justify-center mx-auto rounded-full bg-teal-500/10 mb-4"><i className="ri-megaphone-line text-teal-400 text-xl"></i></div>
                    <p className="text-slate-400">No campaigns yet. Create your first campaign to send bulk invites.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns.map((c: any) => (
                      <div key={c.id} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                        <div className="p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div><h4 className="text-white font-semibold">{c.name}</h4><p className="text-slate-500 text-xs">{c.description || 'No description'}</p></div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${c.status === 'active' ? 'bg-teal-500/10 text-teal-400' : c.status === 'draft' ? 'bg-slate-500/10 text-slate-400' : c.status === 'paused' ? 'bg-amber-500/10 text-amber-400' : c.status === 'completed' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>{c.status}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-3 mb-4">
                            {[{ l: 'Sent', v: c.sent_count, c: 'text-white' },{ l: 'Opened', v: c.opened_count, c: 'text-purple-400' },{ l: 'Clicked', v: c.clicked_count, c: 'text-teal-400' },{ l: 'Signups', v: c.signup_count, c: 'text-amber-400' },{ l: 'Verified', v: c.verified_count, c: 'text-emerald-400' }].map(s => (
                              <div key={s.l} className="bg-[#0B1933] rounded-lg p-3 text-center"><p className="text-xs text-slate-400">{s.l}</p><p className={`text-lg font-bold ${s.c}`}>{s.v}</p></div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {c.status === 'draft' && <button onClick={() => handleCampaignAction(c.id, 'resume_campaign')} disabled={actionLoading === c.id} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">Activate</button>}
                            {c.status === 'active' && <button onClick={() => handleCampaignAction(c.id, 'pause_campaign')} disabled={actionLoading === c.id} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors whitespace-nowrap cursor-pointer">Pause</button>}
                            {c.status === 'paused' && <button onClick={() => handleCampaignAction(c.id, 'resume_campaign')} disabled={actionLoading === c.id} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">Resume</button>}
                            {c.status !== 'cancelled' && c.status !== 'completed' && <button onClick={() => handleCampaignAction(c.id, 'cancel_campaign')} disabled={actionLoading === c.id} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>}
                            <button onClick={() => { setSelectedCampaignId(selectedCampaignId === c.id ? null : c.id); setCampaignRecipients(''); setImportResult(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${selectedCampaignId === c.id ? 'bg-teal-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{selectedCampaignId === c.id ? 'Close' : 'Manage'}</button>
                          </div>
                        </div>

                        {selectedCampaignId === c.id && (
                          <div className="border-t border-[#1a2b4a] p-5 space-y-4">
                            <div><label className="block text-xs text-slate-400 mb-1">Test Email</label><div className="flex gap-2"><input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" className="flex-1 bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" /><button onClick={handleSendTestEmail} disabled={actionLoading === 'test_email' || !testEmail} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 whitespace-nowrap cursor-pointer disabled:opacity-50">Send Test</button></div></div>
                            <div><label className="block text-xs text-slate-400 mb-1">Upload CSV (email, name, role)</label><input type="file" accept=".csv,.txt" onChange={handleCsvFileUpload} className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 file:cursor-pointer" />{csvFile && <p className="text-teal-400 text-xs mt-1">Loaded: {csvFile.name}</p>}</div>
                            <div><label className="block text-xs text-slate-400 mb-1">Recipients (one per line: email, name, role)</label><textarea value={campaignRecipients} onChange={(e) => setCampaignRecipients(e.target.value)} rows={5} className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 font-mono" placeholder="john@example.com, John, guard&#10;jane@acme.com, Jane, client" /></div>
                            {importResult && <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-teal-400 text-xs">Imported: {importResult.imported}, Skipped: {importResult.skipped}</div>}
                            <div className="flex flex-wrap gap-2">
                              <button onClick={handleImportRecipients} disabled={actionLoading === 'import' || !campaignRecipients.trim()} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 whitespace-nowrap cursor-pointer disabled:opacity-50">{actionLoading === 'import' ? 'Importing...' : 'Validate & Import'}</button>
                              <button onClick={handleSendBatch} disabled={actionLoading === 'send_batch' || !campaignRecipients.trim() || c.status === 'cancelled'} className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 whitespace-nowrap cursor-pointer disabled:opacity-50">{actionLoading === 'send_batch' ? 'Sending...' : 'Send Batch'}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== FRAUD ===== */}
            {tab === 'fraud' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <select value={fraudFilter} onChange={(e) => setFraudFilter(e.target.value)} className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 pr-8">
                    <option value="all">All Events</option><option value="open">Open Reviews</option><option value="high_critical">High & Critical</option><option value="confirmed">Confirmed</option>
                  </select>
                  <button onClick={() => handleExportCSV(filteredFraud, 'qg_fraud_events')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                  <button onClick={async () => { setActionLoading('scan_all'); const r = await callFraud('scan_pending_referrals'); setActionMsg(`Scanned ${r?.scanned || 0}, flagged ${r?.flagged || 0}`); setActionLoading(null); loadAll(); }} disabled={actionLoading === 'scan_all'} className="px-4 py-2.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-scan-line"></i></div>
                    Scan All Pending
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[{ l: 'Open', v: fraudEvents.filter(f => f.review_status === 'open').length, c: 'text-red-400' },{ l: 'High Risk', v: fraudEvents.filter(f => f.severity === 'high').length, c: 'text-orange-400' },{ l: 'Critical', v: fraudEvents.filter(f => f.severity === 'critical').length, c: 'text-red-500' },{ l: 'Cleared', v: fraudEvents.filter(f => f.review_status === 'cleared').length, c: 'text-teal-400' }].map(s => (
                    <div key={s.l} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4 text-center"><p className="text-xs text-slate-400 mb-1">{s.l}</p><p className={`text-2xl font-bold ${s.c}`}>{s.v}</p></div>
                  ))}
                </div>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Referral</th><th className="text-left px-4 py-3 font-medium">Risk</th><th className="text-right px-4 py-3 font-medium">Score</th><th className="text-left px-4 py-3 font-medium">Flags</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Action</th><th className="text-right px-4 py-3 font-medium">Date</th><th className="text-right px-4 py-3 font-medium">Review</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {filteredFraud.map((f: any) => (
                          <tr key={f.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[100px] truncate">{f.referral_id?.substring(0, 10)}...</td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fraudSeverityColors[f.severity] || 'bg-slate-500/10 text-slate-400'}`}>{f.severity}</span></td>
                            <td className={`px-4 py-3 text-right font-bold ${f.score >= 70 ? 'text-red-400' : f.score >= 30 ? 'text-amber-400' : 'text-slate-400'}`}>{f.score}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{f.reason || '—'}</td>
                            <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fraudReviewColors[f.review_status] || 'bg-slate-500/10 text-slate-400'}`}>{f.review_status}</span></td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{f.metadata?.recommended_action || '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {f.review_status === 'open' && (
                                  <>
                                    <button onClick={() => handleFraudAction(f.id, 'clear_fraud_event')} disabled={actionLoading === `fraud_${f.id}`} className="px-2.5 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">Clear</button>
                                    <button onClick={() => handleFraudAction(f.id, 'confirm_fraud_event')} disabled={actionLoading === `fraud_${f.id}`} className="px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Confirm</button>
                                    <button onClick={() => handleFraudAction(f.id, 'ignore_fraud_event')} disabled={actionLoading === `fraud_${f.id}`} className="px-2.5 py-1.5 bg-slate-500/10 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-500/20 transition-colors whitespace-nowrap cursor-pointer">Ignore</button>
                                  </>
                                )}
                                {f.review_status !== 'open' && <span className="text-xs text-slate-600">{f.review_status}</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredFraud.length === 0 && <div className="py-12 text-center text-slate-500">No fraud events found</div>}
                </div>
              </div>
            )}

            {/* ===== ANALYTICS ===== */}
            {tab === 'analytics' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <button onClick={() => setAnalyticsDays(7)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${analyticsDays === 7 ? 'bg-teal-500 text-slate-900' : 'bg-[#111d35] text-slate-400 border border-[#1a2b4a] hover:text-white'}`}>7 Days</button>
                  <button onClick={() => setAnalyticsDays(30)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${analyticsDays === 30 ? 'bg-teal-500 text-slate-900' : 'bg-[#111d35] text-slate-400 border border-[#1a2b4a] hover:text-white'}`}>30 Days</button>
                  <button onClick={() => setAnalyticsDays(90)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${analyticsDays === 90 ? 'bg-teal-500 text-slate-900' : 'bg-[#111d35] text-slate-400 border border-[#1a2b4a] hover:text-white'}`}>90 Days</button>
                  <div className="flex-1"></div>
                  <button onClick={() => handleRefreshStats()} disabled={actionLoading === 'refresh'} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>Refresh Stats
                  </button>
                  <button onClick={() => handleAnalyticsExport('referrals')} disabled={actionLoading === 'export'} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                </div>

                {analyticsData && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                      {[
                        { l: 'Total Clicks', v: analyticsData.totalClicks || 0 },{ l: 'Guard Signups', v: analyticsData.guardSignups || 0 },{ l: 'Client Signups', v: analyticsData.clientSignups || 0 },
                        { l: 'Verified Guards', v: analyticsData.verifiedGuards || 0 },{ l: 'Verified Clients', v: analyticsData.verifiedClients || 0 },{ l: 'Verification Rate', v: `${analyticsData.verificationRate || 0}%` },
                      ].map(s => (
                        <div key={s.l} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">{s.l}</p><p className="text-2xl font-bold text-white">{s.v}</p></div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                      {[
                        { l: 'Pending Tokens', v: analyticsData.pendingTokens || 0, c: 'text-amber-400' },{ l: 'Approved Tokens', v: analyticsData.approvedTokens || 0, c: 'text-teal-400' },
                        { l: 'Redeemed Tokens', v: analyticsData.redeemedTokens || 0, c: 'text-blue-400' },{ l: 'Liability', v: `£${((analyticsData.liabilityPence || 0) / 100).toFixed(0)}`, c: 'text-amber-400' },
                        { l: 'Credit Redeemed', v: `£${((analyticsData.redeemedCredit || 0) / 100).toFixed(0)}`, c: 'text-teal-400' },{ l: 'Fraud Events', v: analyticsData.fraudEvents || 0, c: 'text-red-400' },
                      ].map(s => (
                        <div key={s.l} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">{s.l}</p><p className={`text-2xl font-bold ${s.c}`}>{s.v}</p></div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                        <h3 className="text-sm font-semibold text-white mb-4">Invite Funnel</h3>
                        <div className="space-y-3">
                          {analyticsData.inviteFunnel && (
                            <>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-24">Sent</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-blue-400 h-full rounded-full" style={{ width: '100%' }}></div></div><span className="text-white text-sm font-bold">{analyticsData.inviteFunnel.sent}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-24">Clicked</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-teal-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.inviteFunnel.clicked / Math.max(analyticsData.inviteFunnel.sent, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.inviteFunnel.clicked}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-24">Signed Up</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.inviteFunnel.signedUp / Math.max(analyticsData.inviteFunnel.sent, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.inviteFunnel.signedUp}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-24">Verified</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.inviteFunnel.verified / Math.max(analyticsData.inviteFunnel.sent, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.inviteFunnel.verified}</span></div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                        <h3 className="text-sm font-semibold text-white mb-4">Referral Funnel</h3>
                        <div className="space-y-3">
                          {analyticsData.referralFunnel && (
                            <>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-28">Clicked</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-slate-400 h-full rounded-full" style={{ width: '100%' }}></div></div><span className="text-white text-sm font-bold">{analyticsData.referralFunnel.clicked}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-28">Profile Started</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-purple-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.referralFunnel.profileStarted / Math.max(analyticsData.referralFunnel.clicked, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.referralFunnel.profileStarted}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-28">Account Created</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.referralFunnel.accountCreated / Math.max(analyticsData.referralFunnel.clicked, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.referralFunnel.accountCreated}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-28">Verified</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.referralFunnel.verified / Math.max(analyticsData.referralFunnel.clicked, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.referralFunnel.verified}</span></div>
                              <div className="flex items-center"><span className="text-slate-400 text-xs w-28">Approved</span><div className="flex-1 mx-3 bg-[#0B1933] rounded-full h-4 overflow-hidden"><div className="bg-teal-400 h-full rounded-full" style={{ width: `${Math.min((analyticsData.referralFunnel.approved / Math.max(analyticsData.referralFunnel.clicked, 1)) * 100, 100)}%` }}></div></div><span className="text-white text-sm font-bold">{analyticsData.referralFunnel.approved}</span></div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 mb-6">
                  <h3 className="text-sm font-semibold text-white mb-4">Campaign Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Campaign</th><th className="text-right px-4 py-3 font-medium">Sent</th><th className="text-right px-4 py-3 font-medium">Clicked</th><th className="text-right px-4 py-3 font-medium">Signups</th><th className="text-right px-4 py-3 font-medium">Verified</th><th className="text-right px-4 py-3 font-medium">Conv. Rate</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {campaigns.map((c: any) => {
                          const rate = c.sent_count > 0 ? ((c.verified_count / c.sent_count) * 100).toFixed(1) : '0';
                          return (
                            <tr key={c.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-slate-300">{c.name}</td>
                              <td className="px-4 py-3 text-right text-slate-400">{c.sent_count}</td>
                              <td className="px-4 py-3 text-right text-teal-400">{c.clicked_count}</td>
                              <td className="px-4 py-3 text-right text-amber-400">{c.signup_count}</td>
                              <td className="px-4 py-3 text-right text-emerald-400">{c.verified_count}</td>
                              <td className="px-4 py-3 text-right text-white font-bold">{rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {campaigns.length === 0 && <div className="py-8 text-center text-slate-500">No campaigns yet</div>}
                </div>
              </div>
            )}

            {/* ===== AUDIT LOG ===== */}
            {tab === 'audit_log' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                      <div className="w-9 h-9 flex items-center justify-center pl-2"><i className="ri-search-line text-slate-400 text-sm"></i></div>
                      <input type="text" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search by action or actor..." className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3 py-2.5" />
                    </div>
                  </div>
                  <select value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 pr-8">
                    <option value="all">All Actions</option>
                    <option value="scan_referral">Scan Referral</option>
                    <option value="clear_fraud_event">Clear Fraud</option>
                    <option value="confirm_fraud_event">Confirm Fraud</option>
                    <option value="refresh_stats">Refresh Stats</option>
                    <option value="export_csv">Export CSV</option>
                  </select>
                  <button onClick={() => handleExportCSV(filteredAudit, 'qg_audit_log')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                </div>

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Date/Time</th><th className="text-left px-4 py-3 font-medium">Actor</th><th className="text-left px-4 py-3 font-medium">Action</th><th className="text-left px-4 py-3 font-medium">Target</th><th className="text-left px-4 py-3 font-medium">Target ID</th></tr></thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {filteredAudit.map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{a.actor_role || 'system'} {a.actor_user_id ? `(${a.actor_user_id.substring(0, 8)}...)` : ''}</td>
                            <td className="px-4 py-3"><span className="text-slate-300 text-xs capitalize">{a.action.replace(/_/g, ' ')}</span></td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{a.target_type || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[140px] truncate">{a.target_id?.substring(0, 12) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredAudit.length === 0 && <div className="py-12 text-center text-slate-500">No audit log entries found</div>}
                </div>
              </div>
            )}

            {/* ===== PRE-ACCOUNT TOKENS ===== */}
            {tab === 'pre_account_tokens' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                      <div className="w-9 h-9 flex items-center justify-center pl-2"><i className="ri-search-line text-slate-400 text-sm"></i></div>
                      <input type="text" value={preAccountSearch} onChange={(e) => setPreAccountSearch(e.target.value)} placeholder="Search by email or referral code..." className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3 py-2.5" />
                    </div>
                  </div>
                  <select value={preAccountFilter} onChange={(e) => setPreAccountFilter(e.target.value)} className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 pr-8">
                    <option value="all">All Statuses</option>
                    <option value="pre_account">Pre-Account</option>
                    <option value="linked">Linked</option>
                    <option value="verified">Verified</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button onClick={() => handleExportCSV(filteredPreAccount, 'qg_pre_account_tokens')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  {[
                    { l: 'Total', v: preAccountTokens.length, c: 'text-white' },
                    { l: 'Pre-Account', v: preAccountTokens.filter(p => p.status === 'pre_account').length, c: 'text-blue-400' },
                    { l: 'Linked', v: preAccountTokens.filter(p => p.status === 'linked').length, c: 'text-amber-400' },
                    { l: 'Verified', v: preAccountTokens.filter(p => p.status === 'verified').length, c: 'text-teal-400' },
                    { l: 'Pending Tokens', v: preAccountTokens.reduce((s, p) => s + (p.pending_tokens || 0), 0), c: 'text-amber-400' },
                    { l: 'Liability', v: `£${(preAccountTokens.filter(p => p.status === 'pre_account' || p.status === 'linked').reduce((s, p) => s + (p.pending_tokens || 0), 0) / 10).toFixed(0)}`, c: 'text-orange-400' },
                  ].map(s => (
                    <div key={s.l} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-400 mb-1">{s.l}</p>
                      <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>

                {preAccountLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div></div>
                ) : (
                  <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Email</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-right px-4 py-3 font-medium">Pending</th><th className="text-right px-4 py-3 font-medium">Approved</th><th className="text-left px-4 py-3 font-medium">Ref Code</th><th className="text-left px-4 py-3 font-medium">Linked User</th><th className="text-right px-4 py-3 font-medium">Created</th><th className="text-right px-4 py-3 font-medium">Actions</th></tr></thead>
                        <tbody className="divide-y divide-[#1a2b4a]">
                          {filteredPreAccount.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate" title={p.email}>{p.email || '—'}</td>
                              <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.intended_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : p.intended_role === 'client' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>{p.intended_role || '—'}</span></td>
                              <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                p.status === 'verified' ? 'bg-teal-500/10 text-teal-400' :
                                p.status === 'linked' ? 'bg-amber-500/10 text-amber-400' :
                                p.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                                p.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>{p.status.replace(/_/g, ' ')}</span></td>
                              <td className="px-4 py-3 text-right text-amber-400 font-bold">{p.pending_tokens || 0}</td>
                              <td className="px-4 py-3 text-right text-teal-400 font-bold">{p.approved_tokens || 0}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[100px] truncate">{p.referral_code || '—'}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[80px] truncate">{p.linked_user_id?.substring(0, 10) || '—'}</td>
                              <td className="px-4 py-3 text-right text-slate-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {p.status === 'pre_account' && (
                                    <>
                                      <button onClick={() => { setShowLinkModal(p.id); setLinkUserId(''); }} className="px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap cursor-pointer">Link</button>
                                      <button onClick={() => handlePreAccountAction(p.id, 'cancel')} disabled={actionLoading === `pre_${p.id}`} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
                                    </>
                                  )}
                                  {p.status === 'linked' && (
                                    <button onClick={() => handlePreAccountAction(p.id, 'cancel')} disabled={actionLoading === `pre_${p.id}`} className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
                                  )}
                                  {p.status === 'cancelled' && <span className="text-red-400 text-xs">Cancelled</span>}
                                  {p.status === 'rejected' && <span className="text-red-400 text-xs">Rejected</span>}
                                  {p.status === 'verified' && <span className="text-teal-400 text-xs">Verified</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredPreAccount.length === 0 && <div className="py-12 text-center text-slate-500">No pre-account token records found</div>}
                  </div>
                )}

                {/* Link Modal */}
                {showLinkModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowLinkModal(null)}>
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center">
                          <i className="ri-link text-teal-400 text-lg"></i>
                        </div>
                        <div>
                          <h3 className="text-white font-bold">Link to User</h3>
                          <p className="text-slate-500 text-xs">Manually link this pre-account token record to a QuickGuard user</p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-slate-400 mb-1">User UUID</label>
                        <input type="text" value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} placeholder="Paste user UUID here..." className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500" />
                      </div>
                      <p className="text-amber-400 text-xs mb-4 flex items-center gap-1">
                        <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-error-warning-line"></i></div>
                        This action will be logged. Only use for legitimate linking.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setShowLinkModal(null)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
                        <button onClick={() => handlePreAccountAction(showLinkModal, 'link')} disabled={!linkUserId || actionLoading === `pre_${showLinkModal}`} className="flex-1 px-4 py-2.5 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50">{actionLoading === `pre_${showLinkModal}` ? 'Linking...' : 'Link Account'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== LAUNCH ACCOUNTS ===== */}
            {tab === 'launch_accounts' && (
              <div className="space-y-6">
                {/* Launch Profiles */}
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-lg overflow-hidden">
                        <div className="w-9 h-9 flex items-center justify-center pl-2"><i className="ri-search-line text-slate-400 text-sm"></i></div>
                        <input type="text" value={launchAccountSearch} onChange={(e) => setLaunchAccountSearch(e.target.value)} placeholder="Search by email or name..." className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3 py-2.5" />
                      </div>
                    </div>
                    <select value={launchAccountFilter} onChange={(e) => setLaunchAccountFilter(e.target.value)} className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 pr-8">
                      <option value="all">All Statuses</option>
                      <option value="temporary">Temporary</option>
                      <option value="linked">Linked</option>
                      <option value="converted_guard">Converted (Guard)</option>
                      <option value="converted_client">Converted (Client)</option>
                      <option value="verified">Verified</option>
                    </select>
                    <button onClick={() => handleExportCSV(filteredLaunchAccounts, 'qg_launch_accounts')} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line"></i></div>Export CSV
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { l: 'Total', v: launchAccounts.length, c: 'text-white' },
                      { l: 'Temporary', v: launchAccounts.filter(a => a.profile_status === 'temporary').length, c: 'text-blue-400' },
                      { l: 'Linked', v: launchAccounts.filter(a => a.profile_status === 'linked').length, c: 'text-amber-400' },
                      { l: 'Converted', v: launchAccounts.filter(a => a.profile_status?.includes('converted')).length, c: 'text-teal-400' },
                    ].map(s => (
                      <div key={s.l} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-3 text-center"><p className="text-xs text-slate-400 mb-1">{s.l}</p><p className={`text-lg font-bold ${s.c}`}>{s.v}</p></div>
                    ))}
                  </div>

                  {launchAccountLoading ? (
                    <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div></div>
                  ) : (
                    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-[#1a2b4a] text-slate-400"><th className="text-left px-4 py-3 font-medium">Email</th><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Ref Code</th><th className="text-left px-4 py-3 font-medium">Newsletter</th><th className="text-right px-4 py-3 font-medium">Created</th><th className="text-right px-4 py-3 font-medium">Actions</th></tr></thead>
                          <tbody className="divide-y divide-[#1a2b4a]">
                            {getFilteredLaunchAccounts().map((a: any) => (
                              <tr key={a.id} className="hover:bg-slate-800/30">
                                <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate" title={a.email}>{a.email || '—'}</td>
                                <td className="px-4 py-3 text-slate-400">{a.name || '—'}</td>
                                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.intended_role === 'guard' ? 'bg-emerald-500/10 text-emerald-400' : a.intended_role === 'client' ? 'bg-blue-500/10 text-blue-400' : a.intended_role === 'both' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-500/10 text-slate-400'}`}>{a.intended_role || '—'}</span></td>
                                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.profile_status === 'verified' ? 'bg-teal-500/10 text-teal-400' : a.profile_status?.includes('converted') ? 'bg-blue-500/10 text-blue-400' : a.profile_status === 'linked' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>{a.profile_status || '—'}</span></td>
                                <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[80px] truncate">{a.referral_code || '—'}</td>
                                <td className="px-4 py-3">{a.newsletter_consent ? <span className="text-teal-400 text-xs">Yes</span> : <span className="text-slate-600 text-xs">No</span>}</td>
                                <td className="px-4 py-3 text-right text-slate-500 text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => handleCancelLaunchAccount(a.id)} disabled={actionLoading === `la_${a.id}`} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {getFilteredLaunchAccounts().length === 0 && <div className="py-12 text-center text-slate-500">No launch accounts found</div>}
                    </div>
                  )}
                </div>

                {/* Launch Updates */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-white">Launch Updates</h3>
                    <button onClick={() => setShowUpdateCreate(!showUpdateCreate)} className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                      {showUpdateCreate ? 'Cancel' : 'New Update'}
                    </button>
                  </div>

                  {showUpdateCreate && (
                    <div className="bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-5 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div><label className="block text-xs text-slate-400 mb-1">Title *</label><input value={updateForm.title} onChange={(e) => setUpdateForm(p => ({ ...p, title: e.target.value }))} className="w-full bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Update title..." /></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Audience</label><select value={updateForm.audience} onChange={(e) => setUpdateForm(p => ({ ...p, audience: e.target.value }))} className="w-full bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 pr-8"><option value="all">All</option><option value="guards">Guards</option><option value="clients">Clients</option><option value="both">Both</option></select></div>
                      </div>
                      <div className="mb-3"><label className="block text-xs text-slate-400 mb-1">Summary *</label><input value={updateForm.summary} onChange={(e) => setUpdateForm(p => ({ ...p, summary: e.target.value }))} className="w-full bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Brief summary..." /></div>
                      <div className="mb-3"><label className="block text-xs text-slate-400 mb-1">Body (HTML)</label><textarea value={updateForm.body} onChange={(e) => setUpdateForm(p => ({ ...p, body: e.target.value }))} rows={3} className="w-full bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" placeholder="Optional detailed body..." /></div>
                      <button onClick={handleCreateUpdate} disabled={actionLoading === 'create_update' || !updateForm.title || !updateForm.summary} className="px-5 py-2.5 bg-teal-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50">Publish Update</button>
                    </div>
                  )}

                  {updateLoading ? (
                    <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent"></div></div>
                  ) : launchUpdates.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">No updates yet</p>
                  ) : (
                    <div className="space-y-2">
                      {launchUpdates.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 bg-[#0B1933] rounded-xl p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-white text-sm font-medium truncate">{u.title}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${u.status === 'published' ? 'bg-teal-500/10 text-teal-400' : u.status === 'draft' ? 'bg-slate-500/10 text-slate-400' : 'bg-red-500/10 text-red-400'}`}>{u.status}</span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">{u.audience}</span>
                            </div>
                            <p className="text-slate-400 text-xs truncate">{u.summary}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {u.status !== 'published' && <button onClick={() => handleUpdateAction(u.id, 'publish')} disabled={actionLoading === `update_${u.id}`} className="px-2.5 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg text-[10px] font-medium hover:bg-teal-500/20 whitespace-nowrap cursor-pointer">Publish</button>}
                            {u.status === 'published' && <button onClick={() => handleUpdateAction(u.id, 'unpublish')} disabled={actionLoading === `update_${u.id}`} className="px-2.5 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-medium hover:bg-amber-500/20 whitespace-nowrap cursor-pointer">Unpublish</button>}
                            <button onClick={() => handleUpdateAction(u.id, 'archive')} disabled={actionLoading === `update_${u.id}`} className="px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-500/20 whitespace-nowrap cursor-pointer">Archive</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Public Launch Stats */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-white">Public Launch Stats</h3>
                    <button onClick={handleRefreshPublicStats} disabled={actionLoading === 'refresh_stats'} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm whitespace-nowrap cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                      Refresh Stats
                    </button>
                  </div>

                  {statsLoading ? (
                    <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent"></div></div>
                  ) : (
                    <div className="space-y-3">
                      {publicStats.map((s: any) => (
                        <div key={s.key} className="flex items-center gap-3 bg-[#0B1933] rounded-xl p-3">
                          <button onClick={() => handleTogglePublicStat(s.key, s.is_public)} className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 cursor-pointer ${s.is_public ? 'bg-teal-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                            <i className={`text-xs ${s.is_public ? 'ri-check-line' : 'ri-close-line'}`}></i>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-400 text-xs">{s.label || s.key}</p>
                            <input
                              type="text"
                              defaultValue={typeof s.value === 'string' ? (() => { try { const p = JSON.parse(s.value); return typeof p === 'string' ? p : String(p); } catch { return s.value; } })() : String(s.value)}
                              onBlur={(e) => handleUpdateStatValue(s.key, e.target.value)}
                              className="bg-transparent text-sm text-white outline-none w-full"
                            />
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${s.is_public ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-500/10 text-slate-500'}`}>{s.is_public ? 'Public' : 'Hidden'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== SETTINGS ===== */}
            {tab === 'settings' && (
              <div className="space-y-4 max-w-2xl">
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-5">Programme Settings</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'token_value_pence_per_100', label: 'Token Value (pence per 100)', hint: '100 tokens = this many pence of credit' },
                      { key: 'profile_completion_bonus_tokens', label: 'Profile Completion Bonus', hint: 'Tokens for completing profile' },
                      { key: 'verified_guard_referral_tokens', label: 'Guard Referral Reward', hint: 'Tokens per verified guard' },
                      { key: 'verified_client_referral_tokens', label: 'Client Referral Reward', hint: 'Tokens per verified client' },
                      { key: 'max_redemption_percent_per_invoice', label: 'Max Redemption (% of invoice)', hint: 'Max percentage redeemable' },
                      { key: 'token_expiry_months', label: 'Token Expiry (months)', hint: 'Tokens expire after this' },
                      { key: 'max_referrals_per_user_per_day', label: 'Max Referrals/User/Day', hint: 'Daily referral cap' },
                      { key: 'max_referrals_per_user_per_week', label: 'Max Referrals/User/Week', hint: 'Weekly referral cap' },
                    ].map((field) => (
                      <div key={field.key} className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-slate-300 w-64">{field.label}</label>
                        <input type="number" defaultValue={typeof settings[field.key] === 'number' ? settings[field.key] : parseInt(settings[field.key]) || 0} onBlur={(e) => handleSaveSetting(field.key, parseInt(e.target.value))} className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-24" />
                        <span className="text-xs text-slate-500">{field.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-5">Fraud & Security Settings</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'fraud_scoring_enabled', label: 'Fraud Scoring', hint: 'Enable automated risk scoring', type: 'bool' },
                      { key: 'auto_pause_high_risk_referrals', label: 'Auto-pause High Risk', hint: 'Pause referrals flagged as high risk', type: 'bool' },
                      { key: 'high_risk_score_threshold', label: 'High Risk Threshold', hint: 'Score to flag as high risk (default 70)', type: 'number' },
                      { key: 'critical_risk_score_threshold', label: 'Critical Risk Threshold', hint: 'Score to flag as critical (default 90)', type: 'number' },
                    ].map((field) => (
                      <div key={field.key} className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-slate-300 w-64">{field.label}</label>
                        {field.type === 'bool' ? (
                          <button onClick={() => handleSaveSetting(field.key, settings[field.key] === true || settings[field.key] === 'true' ? false : true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${settings[field.key] === true || settings[field.key] === 'true' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                            {settings[field.key] === true || settings[field.key] === 'true' ? 'Enabled' : 'Disabled'}
                          </button>
                        ) : (
                          <input type="number" defaultValue={parseInt(settings[field.key]) || 0} onBlur={(e) => handleSaveSetting(field.key, parseInt(e.target.value))} className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-24" />
                        )}
                        <span className="text-xs text-slate-500">{field.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-5">Exit Popup Settings</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'exit_popup_enabled', label: 'Enable Launch Popup', hint: 'Master switch. When off, the popup stops across the whole public website.', type: 'bool' },
                      { key: 'exit_popup_show_on_homepage', label: 'Show on Homepage', hint: 'Also show popup on the homepage', type: 'bool' },
                      { key: 'exit_popup_show_on_all_public_pages', label: 'Show Across Public Pages', hint: 'When enabled, the QG Launch Rewards popup can appear across approved public marketing pages. Admin, dashboard, authentication, registration, and payment pages remain excluded.', type: 'bool' },
                      { key: 'exit_popup_mobile_enabled', label: 'Enable Mobile Popup', hint: 'Allow popup on mobile devices after configured delay. Default: off.', type: 'bool' },
                      { key: 'exit_popup_mobile_delay_seconds', label: 'Mobile Delay (seconds)', hint: 'Seconds before showing on mobile', type: 'number' },
                      { key: 'exit_popup_cooldown_days', label: 'Close Cooldown (days)', hint: 'Days before popup re-appears after close', type: 'number' },
                      { key: 'exit_popup_test_icon_enabled', label: 'Show Footer Popup Test Icon', hint: 'Shows a small footer icon for testing the popup. Keep off for normal public launch unless needed.', type: 'bool' },
                    ].map((field) => (
                      <div key={field.key} className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-slate-300 w-64">{field.label}</label>
                        {field.type === 'bool' ? (
                          <button onClick={() => handleSaveSetting(field.key, settings[field.key] === true || settings[field.key] === 'true' ? false : true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${settings[field.key] === true || settings[field.key] === 'true' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                            {settings[field.key] === true || settings[field.key] === 'true' ? 'Enabled' : 'Disabled'}
                          </button>
                        ) : (
                          <input type="number" defaultValue={parseInt(settings[field.key]) || 0} onBlur={(e) => handleSaveSetting(field.key, parseInt(e.target.value))} className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-24" />
                        )}
                        <span className="text-xs text-slate-500">{field.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-5">Invite & Campaign Settings</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'invite_system_enabled', label: 'Invite System', hint: 'Toggle invite system', type: 'bool' },
                      { key: 'max_user_invites_per_day', label: 'Max Invites/User/Day', hint: 'Daily invite cap', type: 'number' },
                      { key: 'max_admin_campaign_sends_per_day', label: 'Max Campaign Sends/Day', hint: 'Campaign send cap', type: 'number' },
                      { key: 'invite_cooldown_minutes', label: 'Invite Cooldown (min)', hint: 'Time between invites', type: 'number' },
                      { key: 'require_marketing_consent_for_bulk_campaigns', label: 'Require Consent for Bulk', hint: 'Marketing consent for campaigns', type: 'bool' },
                    ].map((field) => (
                      <div key={field.key} className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-slate-300 w-64">{field.label}</label>
                        {field.type === 'bool' ? (
                          <button onClick={() => handleSaveSetting(field.key, settings[field.key] === true || settings[field.key] === 'true' ? false : true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${settings[field.key] === true || settings[field.key] === 'true' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                            {settings[field.key] === true || settings[field.key] === 'true' ? 'Enabled' : 'Disabled'}
                          </button>
                        ) : (
                          <input type="number" defaultValue={parseInt(settings[field.key]) || 0} onBlur={(e) => handleSaveSetting(field.key, parseInt(e.target.value))} className="bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 w-24" />
                        )}
                        <span className="text-xs text-slate-500">{field.hint}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== CLAWBACK MODAL ===== */}
            {showClawbackModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowClawbackModal(null)}>
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <i className="ri-error-warning-line text-orange-400 text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Confirm Clawback</h3>
                      <p className="text-slate-500 text-xs">This will cancel all approved tokens for this referral</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Admin Note (required)</label>
                    <input type="text" value={clawbackNote} onChange={(e) => setClawbackNote(e.target.value)} placeholder="Reason for clawback..." className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowClawbackModal(null)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
                    <button onClick={handleClawback} disabled={actionLoading === 'clawback' || !clawbackNote} className="flex-1 px-4 py-2.5 bg-orange-500 text-slate-900 rounded-lg font-semibold text-sm hover:bg-orange-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50">{actionLoading === 'clawback' ? 'Processing...' : 'Clawback Tokens'}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}