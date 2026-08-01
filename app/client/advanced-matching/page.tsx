'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import PortalSidebar from '@/components/PortalSidebar';

interface MatchedGuard {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  hourly_rate: number | null;
  years_experience: number | null;
  sia_verified: boolean;
  sia_expiry_date: string | null;
  sia_licence_number: string | null;
  licence_types: string[] | null;
  specializations: string[] | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  has_transport: boolean | null;
  availability_status: string | null;
  languages: string[] | null;
  match_score: number;
  user_id: string | null;
  verification_status: string | null;
}

const securityTypeLabels: Record<string, string> = {
  'door-supervisor': 'Door Supervisor',
  'event-security': 'Event Security',
  'retail-security': 'Retail Security',
  'close-protection': 'Close Protection',
  'cctv-operator': 'CCTV Operator',
  'security-guard': 'Security Guard',
  'mobile-patrol': 'Mobile Patrol',
  'key-holding': 'Key Holding',
};

const specialityOptions = [
  { value: 'all', label: 'All Specialities' },
  { value: 'door-supervisor', label: 'Door Supervisor' },
  { value: 'event-security', label: 'Event Security' },
  { value: 'retail-security', label: 'Retail Security' },
  { value: 'close-protection', label: 'Close Protection' },
  { value: 'cctv-operator', label: 'CCTV Operator' },
  { value: 'mobile-patrol', label: 'Mobile Patrol' },
];

const experienceOptions = [
  { value: 'all', label: 'Any Experience' },
  { value: '5', label: '5+ years' },
  { value: '3', label: '3+ years' },
  { value: '1', label: '1+ year' },
  { value: 'entry', label: 'Entry Level' },
];

const rateOptions = [
  { value: 'all', label: 'Any Rate' },
  { value: '15', label: 'Up to £15/hr' },
  { value: '20', label: 'Up to £20/hr' },
  { value: '25', label: 'Up to £25/hr' },
  { value: '30', label: 'Up to £30/hr' },
  { value: 'premium', label: '£30+/hr' },
];

const sortOptions = [
  { value: 'match', label: 'Best Match' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'rate_low', label: 'Lowest Rate' },
  { value: 'rate_high', label: 'Highest Rate' },
  { value: 'reviews', label: 'Most Reviewed' },
];

function computeMatchScore(guard: any, preferences: { speciality: string; experience: string; rate: string }): number {
  let score = 50;

  if (guard.sia_verified) score += 15;

  if (guard.rating && guard.rating >= 4.5) score += 15;
  else if (guard.rating && guard.rating >= 4.0) score += 10;
  else if (guard.rating && guard.rating >= 3.0) score += 5;

  if (guard.total_jobs_completed && guard.total_jobs_completed >= 50) score += 10;
  else if (guard.total_jobs_completed && guard.total_jobs_completed >= 20) score += 7;
  else if (guard.total_jobs_completed && guard.total_jobs_completed >= 5) score += 3;

  if (guard.years_experience && guard.years_experience >= 5) score += 10;
  else if (guard.years_experience && guard.years_experience >= 3) score += 7;
  else if (guard.years_experience && guard.years_experience >= 1) score += 3;

  if (preferences.speciality !== 'all' && guard.licence_types) {
    const hasMatch = guard.licence_types.some((lt: string) =>
      lt.toLowerCase().includes(preferences.speciality.toLowerCase())
    );
    if (hasMatch) score += 10;
  }

  if (preferences.experience !== 'all') {
    const expLevel = parseInt(preferences.experience);
    if (!isNaN(expLevel) && guard.years_experience && guard.years_experience >= expLevel) score += 8;
  }

  if (preferences.rate !== 'all' && guard.hourly_rate) {
    if (preferences.rate === 'premium') {
      if (guard.hourly_rate >= 30) score += 5;
    } else {
      const maxRate = parseInt(preferences.rate);
      if (!isNaN(maxRate) && guard.hourly_rate <= maxRate) score += 8;
    }
  }

  if (guard.has_transport) score += 3;
  if (guard.languages && guard.languages.length > 1) score += 2;

  return Math.min(100, score);
}

function getMatchLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'Excellent Match', color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  if (score >= 75) return { label: 'Great Match', color: 'text-teal-400', bg: 'bg-teal-500/15' };
  if (score >= 60) return { label: 'Good Match', color: 'text-blue-400', bg: 'bg-blue-500/15' };
  if (score >= 40) return { label: 'Fair Match', color: 'text-amber-400', bg: 'bg-amber-500/15' };
  return { label: 'Low Match', color: 'text-slate-400', bg: 'bg-slate-500/15' };
}

export default function AdvancedMatchingPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [guards, setGuards] = useState<MatchedGuard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialityFilter, setSpecialityFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [rateFilter, setRateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('match');
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Free');
  const [initials, setInitials] = useState('CL');
  const [toast, setToast] = useState('');
  const [selectedGuard, setSelectedGuard] = useState<MatchedGuard | null>(null);
  const [invitingGuard, setInvitingGuard] = useState<string | null>(null);
  const [savedGuardIds, setSavedGuardIds] = useState<Set<string>>(new Set());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientJobs, setClientJobs] = useState<any[]>([]);
  const [inviteJobId, setInviteJobId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');

  const preferences = { speciality: specialityFilter, experience: experienceFilter, rate: rateFilter };

  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');
      setSubscriptionTier(client.subscription_tier || 'Free');
      setInitials((client.company_name || 'Client').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase());

      const { data: activeJobs } = await supabase
        .from('jobs')
        .select('id, job_title, status')
        .eq('client_id', client.id)
        .eq('is_deleted', false)
        .in('status', ['open', 'awaiting_guard_selection', 'pending'])
        .order('created_at', { ascending: false });

      setClientJobs(activeJobs || []);

      const { data: verifiedGuards } = await supabase
        .from('guards')
        .select('id, user_id, full_name, profile_image_url, rating, total_reviews, total_jobs_completed, hourly_rate, years_experience, sia_verified, sia_expiry_date, sia_licence_number, licence_types, specializations, location, postcode, bio, has_transport, availability_status, languages, verification_status')
        .in('verification_status', ['approved', 'verified'])
        .eq('is_active', true)
        .order('rating', { ascending: false });

      if (verifiedGuards) {
        const scored = verifiedGuards.map((g: any) => ({
          ...g,
          match_score: computeMatchScore(g, preferences),
        }));
        setGuards(scored);
      }

      const { data: invites } = await supabase
        .from('job_invites')
        .select('guard_id, job_id')
        .in('job_id', (activeJobs || []).map(j => j.id));

      const savedSet = new Set<string>();
      (invites || []).forEach((inv: any) => savedSet.add(inv.guard_id));
      setSavedGuardIds(savedSet);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setGuards(prev => prev.map(g => ({ ...g, match_score: computeMatchScore(g, preferences) })));
  }, [specialityFilter, experienceFilter, rateFilter]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleInvite = async (guard: MatchedGuard) => {
    if (!inviteJobId || !clientId) {
      setToast('Please select a job to invite this guard to');
      return;
    }
    setInvitingGuard(guard.id);
    try {
      const { data: existing } = await supabase
        .from('job_invites')
        .select('id')
        .eq('job_id', inviteJobId)
        .eq('guard_id', guard.id)
        .maybeSingle();

      if (existing) {
        setToast('This guard has already been invited to this job');
        setInvitingGuard(null);
        setInviteJobId(null);
        setInviteMessage('');
        return;
      }

      const { error } = await supabase.from('job_invites').insert({
        job_id: inviteJobId,
        guard_id: guard.id,
        client_id: clientId,
        status: 'pending',
        message: inviteMessage || `You've been matched to a security job. Tap to view details and apply.`,
      });

      if (error) throw error;

      if (guard.user_id) {
        await supabase.from('notifications').insert({
          user_id: guard.user_id,
          user_type: 'guard',
          type: 'job_invite',
          title: 'New Job Invite!',
          message: `A client has invited you to apply for a job. Check your invites to respond.`,
          link: '/guard/job-invites',
          is_read: false,
        });
      }

      setSavedGuardIds(prev => new Set(prev).add(guard.id));
      setToast(`Invite sent to ${guard.full_name}`);
      setInviteJobId(null);
      setInviteMessage('');
    } catch {
      setToast('Failed to send invite');
    } finally {
      setInvitingGuard(null);
    }
  };

  const saveGuard = async (guardId: string) => {
    if (!clientId) return;
    try {
      const { data: existing } = await supabase
        .from('client_favorites')
        .select('id')
        .eq('client_id', clientId)
        .eq('guard_id', guardId)
        .maybeSingle();

      if (existing) {
        await supabase.from('client_favorites').delete().eq('id', existing.id);
        setSavedGuardIds(prev => {
          const next = new Set(prev);
          next.delete(guardId);
          return next;
        });
        setToast('Removed from saved');
      } else {
        await supabase.from('client_favorites').insert({ client_id: clientId, guard_id: guardId });
        setSavedGuardIds(prev => new Set(prev).add(guardId));
        setToast('Guard saved');
      }
    } catch {
      setToast('Failed to update saved guards');
    }
  };

  const filteredGuards = guards.filter(g => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = g.full_name.toLowerCase().includes(q);
      const matchesLocation = (g.location || '').toLowerCase().includes(q);
      const matchesPostcode = (g.postcode || '').toLowerCase().includes(q);
      const matchesLicence = (g.licence_types || []).some(l => l.toLowerCase().includes(q));
      const matchesSpecialization = (g.specializations || []).some(s => s.toLowerCase().includes(q));
      if (!matchesName && !matchesLocation && !matchesPostcode && !matchesLicence && !matchesSpecialization) return false;
    }
    if (specialityFilter !== 'all') {
      const hasMatch = (g.licence_types || []).some(l => l.toLowerCase().includes(specialityFilter.toLowerCase())) ||
        (g.specializations || []).some(s => s.toLowerCase().includes(specialityFilter.toLowerCase()));
      if (!hasMatch) return false;
    }
    if (experienceFilter !== 'all') {
      if (experienceFilter === 'entry') {
        if ((g.years_experience || 0) >= 1) return false;
      } else {
        const minExp = parseInt(experienceFilter);
        if (!isNaN(minExp) && (g.years_experience || 0) < minExp) return false;
      }
    }
    if (rateFilter !== 'all') {
      if (rateFilter === 'premium') {
        if ((g.hourly_rate || 0) < 30) return false;
      } else {
        const maxRate = parseInt(rateFilter);
        if (!isNaN(maxRate) && (g.hourly_rate || 0) > maxRate) return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'match') return b.match_score - a.match_score;
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'experience') return (b.years_experience || 0) - (a.years_experience || 0);
    if (sortBy === 'rate_low') return (a.hourly_rate || 0) - (b.hourly_rate || 0);
    if (sortBy === 'rate_high') return (b.hourly_rate || 0) - (a.hourly_rate || 0);
    if (sortBy === 'reviews') return (b.total_reviews || 0) - (a.total_reviews || 0);
    return 0;
  });

  const stats = {
    total: guards.length,
    available: guards.filter(g => g.availability_status === 'available').length,
    topRated: guards.filter(g => (g.rating || 0) >= 4.5).length,
    siaVerified: guards.filter(g => g.sia_verified).length,
  };

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Finding your best matches...</p>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName={companyName} subtitle={subscriptionTier} initials={initials} />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.advanced_matching" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName}
        subtitle={subscriptionTier}
        initials={initials}
      />

      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        {toast && (
          <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d] animate-fade-in">
            <i className="ri-checkbox-circle-fill text-teal-400"></i>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}

        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-12 border-b border-[#1e2d4d] overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://readdy.ai/api/search-image?query=A%20dark%20abstract%20technology%20background%20with%20subtle%20grid%20lines%2C%20glowing%20teal%20dots%20forming%20connection%20patterns%20across%20the%20canvas%2C%20deep%20navy%20blue%20base%20color%2C%20minimalist%20futuristic%20aesthetic%2C%20no%20text%2C%20no%20people%2C%20professional%20clean%20look%20suitable%20for%20a%20security%20technology%20brand%2C%204K%20quality&width=1440&height=400&seq=am-bg-1&orientation=landscape')] bg-cover bg-center opacity-15"></div>
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/client/dashboard" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <span className="text-slate-500 text-sm">Back to Dashboard</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-white">Advanced Matching</h1>
                <p className="text-slate-400 max-w-xl">
                  Our AI analyses guard profiles, ratings, experience, and licence types to recommend the best security professionals for your requirements.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-teal-500/15 border border-teal-500/25 rounded-xl px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
                  <span className="text-teal-300 text-sm font-semibold">{stats.available} guards available now</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Verified Guards', value: stats.total, icon: 'ri-shield-user-line', color: 'text-teal-400' },
              { label: 'Available Now', value: stats.available, icon: 'ri-user-follow-line', color: 'text-emerald-400' },
              { label: 'Top Rated (4.5+)', value: stats.topRated, icon: 'ri-star-line', color: 'text-amber-400' },
              { label: 'SIA Verified', value: stats.siaVerified, icon: 'ri-shield-check-line', color: 'text-blue-400' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${s.icon} text-lg ${s.color}`}></i>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-200">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search guards by name, location, postcode, licence type..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <i className="ri-shield-line text-slate-500 text-sm"></i>
                <select
                  value={specialityFilter}
                  onChange={(e) => setSpecialityFilter(e.target.value)}
                  className="bg-transparent text-sm text-white border-none outline-none cursor-pointer pr-8"
                >
                  {specialityOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#111d35]">{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <i className="ri-award-line text-slate-500 text-sm"></i>
                <select
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="bg-transparent text-sm text-white border-none outline-none cursor-pointer pr-8"
                >
                  {experienceOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#111d35]">{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d]">
                <i className="ri-money-pound-circle-line text-slate-500 text-sm"></i>
                <select
                  value={rateFilter}
                  onChange={(e) => setRateFilter(e.target.value)}
                  className="bg-transparent text-sm text-white border-none outline-none cursor-pointer pr-8"
                >
                  {rateOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#111d35]">{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-[#162036] rounded-lg px-3 py-2 border border-[#1e2d4d] ml-auto">
                <i className="ri-sort-desc text-slate-500 text-sm"></i>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm text-white border-none outline-none cursor-pointer pr-8"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#111d35]">{o.label}</option>
                  ))}
                </select>
              </div>

              {(specialityFilter !== 'all' || experienceFilter !== 'all' || rateFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSpecialityFilter('all');
                    setExperienceFilter('all');
                    setRateFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer whitespace-nowrap transition-colors"
                >
                  <i className="ri-close-circle-line mr-1"></i>Clear All
                </button>
              )}
            </div>
          </div>

          {loadError ? (
            <div className="bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load guards</h3>
              <p className="text-slate-500 text-sm mb-6">We could not load the guard data. Please try again.</p>
              <button onClick={loadData} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                <i className="ri-refresh-line"></i>Retry
              </button>
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-user-search-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                {searchQuery || specialityFilter !== 'all' || experienceFilter !== 'all' || rateFilter !== 'all'
                  ? 'No guards match your criteria'
                  : 'No verified guards available'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {searchQuery || specialityFilter !== 'all' || experienceFilter !== 'all' || rateFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria to find more guards.'
                  : 'There are currently no verified guards in the system. Check back soon.'}
              </p>
              {(specialityFilter !== 'all' || experienceFilter !== 'all' || rateFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setSpecialityFilter('all'); setExperienceFilter('all'); setRateFilter('all'); setSearchQuery(''); }}
                  className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
                >
                  <i className="ri-close-circle-line"></i>Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">
                Showing {filteredGuards.length} guard{filteredGuards.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGuards.map((guard) => {
                  const matchInfo = getMatchLabel(guard.match_score);
                  const isSaved = savedGuardIds.has(guard.id);
                  return (
                    <div
                      key={guard.id}
                      className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden hover:border-teal-500/25 transition-all group"
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                              {guard.profile_image_url ? (
                                <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <i className="ri-user-line text-xl text-slate-500"></i>
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white text-sm">{guard.full_name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {guard.sia_verified && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                    SIA
                                  </span>
                                )}
                                {guard.rating && (
                                  <span className="text-xs text-amber-400 flex items-center gap-0.5">
                                    <i className="ri-star-fill text-[10px]"></i>
                                    {guard.rating.toFixed(1)}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">({guard.total_reviews || 0})</span>
                              </div>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${matchInfo.bg} border border-white/5`}>
                            <span className={`text-xs font-bold ${matchInfo.color}`}>{guard.match_score}%</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-4">
                          {guard.location && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <i className="ri-map-pin-line text-slate-600"></i>
                              {guard.location}{guard.postcode ? `, ${guard.postcode}` : ''}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <i className="ri-briefcase-line text-slate-600"></i>
                            {guard.years_experience || 0} years experience · {guard.total_jobs_completed || 0} jobs completed
                          </p>
                          {guard.hourly_rate && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <i className="ri-money-pound-circle-line text-slate-600"></i>
                              £{guard.hourly_rate}/hr
                            </p>
                          )}
                          {(guard.licence_types && guard.licence_types.length > 0) && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <i className="ri-shield-line text-slate-600"></i>
                              {guard.licence_types.slice(0, 3).map(l => securityTypeLabels[l] || l).join(', ')}
                              {guard.licence_types.length > 3 && '...'}
                            </p>
                          )}
                          {guard.availability_status && (
                            <p className="text-xs flex items-center gap-1.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${guard.availability_status === 'available' ? 'bg-emerald-400' : guard.availability_status === 'part_time' ? 'bg-amber-400' : 'bg-slate-500'}`}></span>
                              <span className="text-slate-400 capitalize">{guard.availability_status.replace('_', ' ')}</span>
                            </p>
                          )}
                        </div>

                        {guard.bio && (
                          <p className="text-xs text-slate-500 mb-4 line-clamp-2">{guard.bio}</p>
                        )}

                        <div className="flex items-center gap-2 pt-3 border-t border-[#1e2d4d]">
                          {clientJobs.length > 0 && !isSaved ? (
                            <div className="flex-1 flex items-center gap-2">
                              <select
                                value={inviteJobId || ''}
                                onChange={(e) => setInviteJobId(e.target.value || null)}
                                className="flex-1 bg-[#162036] border border-[#1e2d4d] rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer pr-8"
                              >
                                <option value="">Select a job...</option>
                                {clientJobs.map((job) => (
                                  <option key={job.id} value={job.id} className="bg-[#111d35]">{job.job_title}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleInvite(guard)}
                                disabled={invitingGuard === guard.id || !inviteJobId}
                                className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {invitingGuard === guard.id ? (
                                  <i className="ri-loader-4-line animate-spin"></i>
                                ) : (
                                  'Invite'
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => router.push('/client/post-job')}
                              className="flex-1 bg-teal-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <i className="ri-add-line mr-1"></i>Post a Job to Invite
                            </button>
                          )}
                          <button
                            onClick={() => saveGuard(guard.id)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${isSaved ? 'bg-teal-500/20 text-teal-400 border border-teal-500/25' : 'bg-[#162036] text-slate-500 hover:text-teal-400 border border-[#1e2d4d]'}`}
                          >
                            <i className={`${isSaved ? 'ri-bookmark-fill' : 'ri-bookmark-line'} text-sm`}></i>
                          </button>
                          <button
                            onClick={() => setSelectedGuard(guard)}
                            className="px-3 py-1.5 bg-[#162036] border border-[#1e2d4d] text-slate-300 rounded-lg text-xs font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedGuard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedGuard(null)}>
          <div
            className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-white">Guard Profile</h3>
              <button onClick={() => setSelectedGuard(null)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#162036] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#1e2d4d]">
                  {selectedGuard.profile_image_url ? (
                    <img src={selectedGuard.profile_image_url} alt={selectedGuard.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <i className="ri-user-line text-2xl text-slate-500"></i>
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{selectedGuard.full_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedGuard.sia_verified && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">SIA Verified</span>
                    )}
                    {selectedGuard.rating && (
                      <span className="text-sm text-amber-400 flex items-center gap-0.5">
                        <i className="ri-star-fill text-xs"></i>{selectedGuard.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Experience', value: `${selectedGuard.years_experience || 0} yrs` },
                  { label: 'Jobs Completed', value: selectedGuard.total_jobs_completed || 0 },
                  { label: 'Hourly Rate', value: selectedGuard.hourly_rate ? `£${selectedGuard.hourly_rate}/hr` : 'N/A' },
                  { label: 'Match Score', value: `${selectedGuard.match_score}%` },
                ].map((item) => (
                  <div key={item.label} className="bg-[#162036] rounded-xl p-3 border border-[#1e2d4d]">
                    <p className="text-[10px] text-slate-500 font-medium uppercase">{item.label}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {selectedGuard.bio && (
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase mb-2">About</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedGuard.bio}</p>
                </div>
              )}

              {(selectedGuard.licence_types && selectedGuard.licence_types.length > 0) && (
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase mb-2">Licence Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGuard.licence_types.map((lt) => (
                      <span key={lt} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {securityTypeLabels[lt] || lt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(selectedGuard.specializations && selectedGuard.specializations.length > 0) && (
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase mb-2">Specializations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGuard.specializations.map((s) => (
                      <span key={s} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(selectedGuard.languages && selectedGuard.languages.length > 0) && (
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase mb-2">Languages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGuard.languages.map((l) => (
                      <span key={l} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-[#1e2d4d]">
                {selectedGuard.has_transport && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <i className="ri-car-line text-teal-400"></i> Has Transport
                  </span>
                )}
                {selectedGuard.sia_expiry_date && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <i className="ri-calendar-check-line text-teal-400"></i>
                    SIA expires {new Date(selectedGuard.sia_expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}