"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { supabase } from '@/lib/supabase';
import FocusTrap from 'focus-trap-react';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import { JobListSchema } from '@/components/JobPostingSchema';
import BackToTop from '@/components/BackToTop';
import ShareJobButton from '@/components/ShareJobButton';
import JobsNearMeFilter from '@/components/JobsNearMeFilter';
import ClientBadge from '@/components/ClientBadge';

interface Job {
  id: string;
  job_title: string;
  job_description: string | null;
  venue_city: string;
  venue_postcode: string | null;
  number_of_guards: number;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  urgency: string | null;
  sia_licence_required: boolean;
  required_licence_types: string[] | null;
  required_license_type?: string | null;
  uniform_required: boolean;
  additional_requirements: string | null;
  created_at: string;
  is_featured?: boolean;
  is_urgent?: boolean;
  expires_at?: string | null;
  clients?: {
    company_name: string;
    client_promo_tier: string | null;
    founding_client_badge: boolean;
  };
}

export default function JobsClient() {
  const router = useSafeRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [siaRequired, setSiaRequired] = useState(false);
  const [uniformRequired, setUniformRequired] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSiaType, setSelectedSiaType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [minRate, setMinRate] = useState('0');
  const [foundingClientsOnly, setFoundingClientsOnly] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [showFloatingBtn, setShowFloatingBtn] = useState(false);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [listMode, setListMode] = useState<'all' | 'nearme'>('all');
  const [guardProfile, setGuardProfile] = useState<any>(null);
  const [myApplications, setMyApplications] = useState<Record<string, string>>({});
  const [clientProfile, setClientProfile] = useState<any>(null);

  useEffect(() => {
    fetchJobs();
    checkGuardSession();
    checkClientSession();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        window.location.replace(`/jobs/${id}`);
      }
    }
  }, [showExpired]);

  useEffect(() => {
    applyFilters();
  }, [jobs, searchQuery, siaRequired, uniformRequired, selectedUrgency, selectedCity, selectedSiaType, dateFrom, dateTo, sortBy, minRate, showExpired, foundingClientsOnly, myApplications]);

  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingBtn(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkClientSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (clientData) {
        setClientProfile(clientData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkGuardSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: guardData } = await supabase
        .from('guards')
        .select('id, verification_status, licence_types, sia_licence_number, sia_verified')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (guardData) {
        setGuardProfile(guardData);
        const { data: apps } = await supabase
          .from('job_applications')
          .select('job_id, status')
          .eq('guard_id', guardData.id);
        if (apps) {
          const map: Record<string, string> = {};
          apps.forEach((a: any) => { map[a.job_id] = a.status; });
          setMyApplications(map);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJobs = async () => {
    try {
      let query = supabase
        .from('jobs')
        .select(`
          id,
          job_title,
          job_description,
          venue_city,
          venue_postcode,
          number_of_guards,
          start_date,
          end_date,
          start_time,
          end_time,
          hourly_rate,
          urgency,
          sia_licence_required,
          required_licence_types,
          required_license_type,
          uniform_required,
          additional_requirements,
          created_at,
          is_featured,
          is_urgent,
          expires_at,
          clients!jobs_client_id_fkey (
            company_name,
            client_promo_tier,
            founding_client_badge
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!showExpired) {
        query = query.eq('status', 'open');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching jobs:', error);
        throw error;
      }

      const jobList = (data as Job[]) || [];
      setJobs(jobList);

      if (jobList.length > 0) {
        const jobIds = jobList.map((j) => j.id);
        const { data: appData } = await supabase
          .from('job_applications')
          .select('job_id')
          .in('job_id', jobIds);

        if (appData) {
          const counts: Record<string, number> = {};
          appData.forEach((row: { job_id: string }) => {
            counts[row.job_id] = (counts[row.job_id] || 0) + 1;
          });
          setApplicantCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.job_title?.toLowerCase().includes(query) ||
          job.venue_city?.toLowerCase().includes(query) ||
          job.venue_postcode?.toLowerCase().includes(query) ||
          job.clients?.company_name?.toLowerCase().includes(query)
      );
    }

    if (siaRequired) {
      filtered = filtered.filter((job) => job.sia_licence_required === true);
    }

    if (uniformRequired) {
      filtered = filtered.filter((job) => job.uniform_required === true);
    }

    if (selectedUrgency !== 'all') {
      filtered = filtered.filter((job) => job.urgency === selectedUrgency);
    }

    if (selectedCity !== 'all') {
      filtered = filtered.filter((job) =>
        job.venue_city?.toLowerCase() === selectedCity.toLowerCase()
      );
    }

    if (selectedSiaType !== 'all') {
      filtered = filtered.filter((job) =>
        job.required_licence_types?.includes(selectedSiaType)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter((job) => job.start_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((job) => job.start_date <= dateTo);
    }

    if (minRate && parseFloat(minRate) > 0) {
      filtered = filtered.filter((job) => job.hourly_rate >= parseFloat(minRate));
    }

    if (foundingClientsOnly) {
      filtered = filtered.filter((job) =>
        job.clients?.client_promo_tier === 'founding_client' || job.clients?.founding_client_badge === true
      );
    }

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'highest-pay':
        filtered.sort((a, b) => b.hourly_rate - a.hourly_rate);
        break;
      case 'start-soon':
        filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        break;
      case 'urgency':
        const urgencyOrder: Record<string, number> = { immediate: 0, urgent: 1, high: 2, normal: 3, standard: 4 };
        filtered.sort((a, b) => (urgencyOrder[a.urgency ?? ''] ?? 5) - (urgencyOrder[b.urgency ?? ''] ?? 5));
        break;
    }

    // Featured jobs always come first
    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });

    setFilteredJobs(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSiaRequired(false);
    setUniformRequired(false);
    setSelectedUrgency('all');
    setSelectedCity('all');
    setSelectedSiaType('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
    setMinRate('0');
    setFoundingClientsOnly(false);
  };

  const handleViewDetails = async (jobId: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();

      if (!user) {
        setSelectedJobId(jobId);
        setShowAuthModal(true);
      } else {
        router.push(`/jobs/${jobId}`);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setSelectedJobId(jobId);
      setShowAuthModal(true);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const formatDateISO = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case 'immediate':
        return { classes: 'bg-red-100 text-red-700 border border-red-200', icon: 'ri-flashlight-line', label: 'Immediate' };
      case 'urgent':
        return { classes: 'bg-amber-100 text-amber-700 border border-amber-200', icon: 'ri-alarm-warning-line', label: 'Urgent' };
      case 'high':
        return { classes: 'bg-orange-100 text-orange-700 border border-orange-200', icon: 'ri-arrow-up-line', label: 'High' };
      case 'normal':
      case 'standard':
        return { classes: 'bg-green-100 text-green-700 border border-green-200', icon: 'ri-time-line', label: 'Standard' };
      default:
        return null;
    }
  };

  const getExpiryBadge = (startDate: string, urgency: string | null) => {
    const now = new Date();
    const start = new Date(startDate);
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null;

    if (diffDays === 0) {
      return { label: 'Closes Today', classes: 'bg-red-600 text-white', icon: 'ri-alarm-warning-fill' };
    } else if (diffDays === 1) {
      return { label: 'Closes Tomorrow', classes: 'bg-red-500 text-white', icon: 'ri-timer-flash-line' };
    } else if (diffDays <= 3) {
      return { label: `Closes in ${diffDays} days`, classes: 'bg-orange-500 text-white', icon: 'ri-timer-line' };
    } else if (diffDays <= 7) {
      return { label: `Closes in ${diffDays} days`, classes: 'bg-amber-400 text-amber-900', icon: 'ri-time-line' };
    }
    return null;
  };

  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { classes: 'bg-amber-100 text-amber-700 border border-amber-200', icon: 'ri-time-line', label: 'Applied' };
      case 'accepted':
      case 'confirmed':
        return { classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: 'ri-checkbox-circle-line', label: 'Accepted' };
      case 'declined':
      case 'rejected':
        return { classes: 'bg-red-100 text-red-700 border border-red-200', icon: 'ri-close-circle-line', label: 'Declined' };
      case 'shortlisted':
        return { classes: 'bg-blue-100 text-blue-700 border border-blue-200', icon: 'ri-star-line', label: 'Shortlisted' };
      default:
        return { classes: 'bg-slate-100 text-slate-700 border border-slate-200', icon: 'ri-question-line', label: status };
    }
  };

  const allSiaTypes = Array.from(
    new Set(jobs.flatMap((j) => {
      const types = j.required_licence_types ? [...j.required_licence_types] : [];
      if (j.required_license_type && !types.includes(j.required_license_type)) {
        types.push(j.required_license_type);
      }
      return types;
    }))
  ).sort();

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <section
        className="relative pt-32 pb-20 bg-[#0e1628] border-b border-slate-800/60"
        aria-labelledby="jobs-hero-heading"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            {guardProfile && (
              <Link
                href="/guard/dashboard"
                className="inline-flex items-center gap-2 bg-[#162036] hover:bg-[#1a2642] border border-slate-700/50 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium mb-4 transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Guard Dashboard
              </Link>
            )}
            {clientProfile && (
              <Link
                href="/client/dashboard"
                className="inline-flex items-center gap-2 bg-[#162036] hover:bg-[#1a2642] border border-slate-700/50 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium mb-4 transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Client Dashboard
              </Link>
            )}
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-briefcase-line" aria-hidden="true"></i>
              Live Security Jobs
            </div>
            <h1 id="jobs-hero-heading" className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Find Security Jobs
            </h1>
            <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
              Browse available security positions across the UK
            </p>

            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <label htmlFor="job-search" className="sr-only">
                  Search jobs by title, location, or company
                </label>
                <input
                  id="job-search"
                  type="text"
                  placeholder="Search by job title, location, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-6 py-4 pr-12 rounded-xl bg-[#111d35] border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
                  aria-describedby="search-description"
                />
                <span id="search-description" className="sr-only">
                  Enter keywords to filter available security jobs
                </span>
                <i
                  className="ri-search-line absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl"
                  aria-hidden="true"
                ></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#111d35] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl">
                <i className="ri-shield-check-line text-2xl text-teal-400"></i>
              </div>
              <div>
                <h3 className="font-bold text-white">Want to Apply for These Jobs?</h3>
                <p className="text-slate-400 text-sm">
                  Join QuickGuard as a security professional today
                </p>
              </div>
            </div>
            <Link
              href="/guard/register"
              className="bg-teal-500 text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-teal-400 transition-all whitespace-nowrap flex items-center gap-2 shadow-lg hover:shadow-teal-500/20"
            >
              <i className="ri-user-add-line text-xl"></i>
              Join as Security Guard
            </Link>
          </div>
        </div>
      </div>

      <section className="py-12" aria-labelledby="jobs-list-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1" aria-labelledby="filters-heading">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 sm:p-6 sticky top-24">
                <h2 id="filters-heading" className="text-xl font-bold text-white mb-6">
                  Filters
                </h2>

                <div className="mb-6 p-4 bg-[#0e1628] border border-slate-700/50 rounded-xl">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-semibold text-slate-300">
                      Show Expired / Archived
                    </span>
                    <div className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={showExpired}
                        onChange={(e) => setShowExpired(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </div>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Include past start dates &amp; non-open statuses</p>
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={siaRequired}
                      onChange={(e) => setSiaRequired(e.target.checked)}
                      className="w-5 h-5 text-teal-500 border-slate-600 rounded bg-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-sm font-semibold text-slate-300">
                      SIA Licence Required Only
                    </span>
                  </label>
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uniformRequired}
                      onChange={(e) => setUniformRequired(e.target.checked)}
                      className="w-5 h-5 text-teal-500 border-slate-600 rounded bg-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-sm font-semibold text-slate-300">
                      Uniform Required Only
                    </span>
                  </label>
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={foundingClientsOnly}
                      onChange={(e) => setFoundingClientsOnly(e.target.checked)}
                      className="w-5 h-5 text-teal-500 border-slate-600 rounded bg-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-sm font-semibold text-slate-300">
                      Founding Clients Only
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Reliable repeat posters</p>
                </div>

                <div className="mb-6">
                  <label htmlFor="urgency-filter" className="block text-sm font-semibold text-slate-300 mb-3">
                    Urgency
                  </label>
                  <div className="relative">
                    <select
                      id="urgency-filter"
                      value={selectedUrgency}
                      onChange={(e) => setSelectedUrgency(e.target.value)}
                      className="w-full px-4 py-2.5 pr-8 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 appearance-none cursor-pointer"
                    >
                      <option value="all">Any Urgency</option>
                      <option value="immediate">Immediate</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="standard">Standard</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="city-filter" className="block text-sm font-semibold text-slate-300 mb-3">
                    City
                  </label>
                  <div className="relative">
                    <select
                      id="city-filter"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full px-4 py-2.5 pr-8 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 appearance-none cursor-pointer"
                    >
                      <option value="all">All Cities</option>
                      {Array.from(new Set(jobs.map((j) => j.venue_city).filter(Boolean))).sort().map((city) => (
                        <option key={city} value={city!}>{city}</option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                {allSiaTypes.length > 0 && (
                  <div className="mb-6">
                    <label htmlFor="sia-type-filter" className="block text-sm font-semibold text-slate-300 mb-3">
                      SIA Licence Type
                    </label>
                    <div className="relative">
                      <select
                        id="sia-type-filter"
                        value={selectedSiaType}
                        onChange={(e) => setSelectedSiaType(e.target.value)}
                        className="w-full px-4 py-2.5 pr-8 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 appearance-none cursor-pointer"
                      >
                        <option value="all">Any Type</option>
                        {allSiaTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Start Date Range
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 cursor-pointer"
                        placeholder="From"
                      />
                      {!dateFrom && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">From</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 cursor-pointer"
                        placeholder="To"
                      />
                      {!dateTo && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">To</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="pay-rate-filter" className="block text-sm font-semibold text-slate-300 mb-3">
                    Minimum Pay Rate
                  </label>
                  <div className="relative">
                    <select
                      id="pay-rate-filter"
                      value={minRate}
                      onChange={(e) => setMinRate(e.target.value)}
                      className="w-full px-4 py-2.5 pr-8 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 appearance-none cursor-pointer"
                    >
                      <option value="0">Any Rate</option>
                      <option value="10">£10+/hour</option>
                      <option value="12">£12+/hour</option>
                      <option value="15">£15+/hour</option>
                      <option value="18">£18+/hour</option>
                      <option value="20">£20+/hour</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="sort-filter" className="block text-sm font-semibold text-slate-300 mb-3">
                    Sort By
                  </label>
                  <div className="relative">
                    <select
                      id="sort-filter"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-4 py-2.5 pr-8 bg-[#0e1628] border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 appearance-none cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="highest-pay">Highest Pay</option>
                      <option value="start-soon">Starting Soon</option>
                      <option value="urgency">Most Urgent</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  aria-label="Clear all filters"
                >
                  Clear Filters
                </button>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded-xl p-1">
                  <button
                    onClick={() => setListMode('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      listMode === 'all'
                        ? 'bg-teal-500 text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Jobs
                  </button>
                  <button
                    onClick={() => setListMode('nearme')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      listMode === 'nearme'
                        ? 'bg-teal-500 text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <i className="ri-map-pin-line mr-1"></i>
                    Near Me
                  </button>
                </div>
                {guardProfile && (
                  <span className="text-sm text-slate-400">
                    Signed in as <span className="text-teal-400 font-semibold">Guard</span>
                  </span>
                )}
              </div>

              {listMode === 'nearme' ? (
                <JobsNearMeFilter />
              ) : loading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 animate-pulse">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="h-6 bg-slate-700 rounded w-2/3 mb-3"></div>
                          <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
                          <div className="flex gap-4 mb-4">
                            <div className="h-4 bg-slate-700 rounded w-24"></div>
                            <div className="h-4 bg-slate-700 rounded w-24"></div>
                            <div className="h-4 bg-slate-700 rounded w-24"></div>
                          </div>
                          <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
                          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                        </div>
                        <div className="ml-6">
                          <div className="h-8 bg-slate-700 rounded w-24 mb-2"></div>
                          <div className="h-10 bg-slate-700 rounded w-32"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-12 text-center" role="status" aria-live="polite">
                  <i className="ri-inbox-line text-6xl text-slate-600 mb-4" aria-hidden="true"></i>
                  <h3 className="text-xl font-bold text-white mb-2">No Jobs Found</h3>
                  <p className="text-slate-400 mb-6">
                    {searchQuery || siaRequired || uniformRequired || selectedUrgency !== 'all' || selectedCity !== 'all' || selectedSiaType !== 'all' || dateFrom || dateTo || parseFloat(minRate) > 0 || showExpired || foundingClientsOnly
                      ? 'Try adjusting your filters or search query'
                      : 'No active jobs available at the moment'}
                  </p>
                  {(searchQuery || siaRequired || uniformRequired || selectedUrgency !== 'all' || selectedCity !== 'all' || selectedSiaType !== 'all' || dateFrom || dateTo || parseFloat(minRate) > 0 || showExpired || foundingClientsOnly) && (
                    <button
                      onClick={clearFilters}
                      className="bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredJobs.map((job) => (
                    <article
                      key={job.id}
                      className={`rounded-2xl p-5 sm:p-6 transition-all ${job.is_featured ? 'bg-[#111d35] border-2 border-violet-500/40 hover:border-violet-500/60 shadow-violet-500/10 shadow-lg' : 'bg-[#111d35] border border-slate-700/50 hover:border-teal-500/30'}`}
                      aria-labelledby={`job-title-${job.id}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 id={`job-title-${job.id}`} className="text-xl font-bold text-white">
                              {job.job_title}
                            </h3>
                            {job.is_featured && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-violet-500/15 text-violet-300 border-violet-500/30 whitespace-nowrap">
                                <i className="ri-vip-crown-line"></i>Featured
                              </span>
                            )}
                            {job.is_urgent && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-500/15 text-red-300 border-red-500/30 whitespace-nowrap">
                                <i className="ri-flashlight-line"></i>Urgent
                              </span>
                            )}
                            {job.expires_at && new Date(job.expires_at) > new Date() && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30 whitespace-nowrap">
                                <i className="ri-timer-flash-line"></i>
                                Expires {new Date(job.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                            {job.clients?.client_promo_tier && job.clients.client_promo_tier !== 'standard' && (
                              <ClientBadge tier={job.clients.client_promo_tier} badge={job.clients.founding_client_badge} />
                            )}
                            {(() => {
                              const badge = getUrgencyBadge(job.urgency);
                              return badge ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.classes}`}>
                                  <i className={badge.icon} aria-hidden="true"></i>
                                  {badge.label}
                                </span>
                              ) : null;
                            })()}
                            {(() => {
                              const expiry = getExpiryBadge(job.start_date, job.urgency);
                              return expiry ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${expiry.classes}`}>
                                  <i className={expiry.icon} aria-hidden="true"></i>
                                  {expiry.label}
                                </span>
                              ) : null;
                            })()}
                            {myApplications?.[job.id] && (
                              (() => {
                                const ab = getApplicationStatusBadge(myApplications[job.id]);
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ab.classes}`}>
                                    <i className={ab.icon} aria-hidden="true"></i>
                                    {ab.label}
                                  </span>
                                );
                              })()
                            )}
                          </div>

                          <p className="text-slate-400 mb-3">
                            {job.clients?.company_name || 'Private Client'}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-4">
                            <span className="flex items-center gap-1">
                              <i className="ri-map-pin-line text-teal-400" aria-hidden="true"></i>
                              {job.venue_city}
                              {job.venue_postcode ? `, ${job.venue_postcode}` : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-calendar-line text-teal-400" aria-hidden="true"></i>
                              <time dateTime={formatDateISO(job.start_date)}>{formatDate(job.start_date)}</time>
                              {job.end_date && job.end_date !== job.start_date && (
                                <>
                                  {' - '}
                                  <time dateTime={formatDateISO(job.end_date)}>{formatDate(job.end_date)}</time>
                                </>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-time-line text-teal-400" aria-hidden="true"></i>
                              {formatTime(job.start_time)} - {formatTime(job.end_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-team-line text-teal-400" aria-hidden="true"></i>
                              {job.number_of_guards} {job.number_of_guards === 1 ? 'Guard' : 'Guards'}
                            </span>
                            <span className="flex items-center gap-1 bg-teal-500/10 text-teal-400 border border-teal-400/20 px-2.5 py-0.5 rounded-full font-medium">
                              <i className="ri-user-follow-line" aria-hidden="true"></i>
                              {applicantCounts[job.id] ?? 0}{' '}
                              {(applicantCounts[job.id] ?? 0) === 1 ? 'guard' : 'guards'} applied
                            </span>
                          </div>

                          {job.job_description && (
                            <p className="text-slate-400 text-sm mb-4 line-clamp-2">{job.job_description}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {job.sia_licence_required && (
                              <span className="bg-teal-500/10 text-teal-400 border border-teal-400/20 px-3 py-1 rounded-full text-xs font-medium">
                                <i className="ri-shield-check-line mr-1" aria-hidden="true"></i>
                                SIA Required
                              </span>
                            )}
                            {job.required_licence_types && job.required_licence_types.map((lic) => (
                              <span key={lic} className="bg-teal-500/10 text-teal-400 border border-teal-400/20 px-3 py-1 rounded-full text-xs font-medium">
                                {lic}
                              </span>
                            ))}
                            {job.uniform_required && (
                              <span className="bg-purple-500/10 text-purple-400 border border-purple-400/20 px-3 py-1 rounded-full text-xs font-medium">
                                <i className="ri-shirt-line mr-1" aria-hidden="true"></i>
                                Uniform Required
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right ml-4 sm:ml-6 flex flex-col items-end gap-3 flex-shrink-0">
                          <div>
                            <div className="text-3xl font-bold text-teal-400 mb-1">
                              £{Number(job.hourly_rate).toFixed(2)}
                            </div>
                            <p className="text-sm text-slate-500">per hour</p>
                          </div>
                          <Link
                            href={`/jobs/${job.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleViewDetails(job.id);
                            }}
                            className="block bg-teal-500 text-slate-900 px-5 sm:px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all whitespace-nowrap text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 shadow-lg hover:shadow-teal-500/20"
                            aria-label={`View details for ${job.job_title} position`}
                          >
                            View Details
                          </Link>
                          <ShareJobButton
                            jobId={job.id}
                            jobTitle={job.job_title}
                            location={`${job.venue_city}${job.venue_postcode ? `, ${job.venue_postcode}` : ''}`}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#0e1628] border-t border-slate-800/60 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-building-line"></i>
            For Businesses
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Need Security Guards for Your Business?</h2>
          <p className="text-xl text-slate-400 mb-10">
            Post your security job and connect with qualified professionals in minutes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/client/register"
              className="bg-teal-500 text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-teal-400 transition-all whitespace-nowrap flex items-center justify-center gap-2 shadow-lg hover:shadow-teal-500/20 hover:scale-105"
            >
              <i className="ri-building-line text-xl"></i>
              Register Your Company
            </Link>
            <Link
              href="/client/post-job"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 hover:scale-105"
            >
              <i className="ri-add-circle-line text-xl"></i>
              Post a Security Job
            </Link>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            allowOutsideClick: true,
            escapeDeactivates: true,
            returnFocusOnDeactivate: true,
          }}
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAuthModal(false);
              }
            }}
          >
            <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl max-w-md w-full p-8 relative">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Close dialog"
              >
                <i className="ri-close-line text-xl" aria-hidden="true"></i>
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-shield-user-line text-3xl text-teal-400" aria-hidden="true"></i>
                </div>
                <h2 id="auth-modal-title" className="text-2xl font-bold text-white mb-2">
                  Sign In Required
                </h2>
                <p className="text-slate-400">Please sign in to apply for this job</p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/guard/login"
                  className="block w-full bg-teal-500 text-slate-900 text-center py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  onClick={() => setShowAuthModal(false)}
                >
                  Sign In as Guard
                </Link>
                <Link
                  href="/guard/register"
                  className="block w-full bg-white/10 text-white text-center py-3 rounded-xl font-semibold border border-white/20 hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  onClick={() => setShowAuthModal(false)}
                >
                  Create Guard Account
                </Link>
              </div>

              <p className="text-sm text-slate-500 text-center mt-4">
                Don't have an account? Sign up to start applying for jobs
              </p>
            </div>
          </div>
        </FocusTrap>
      )}

      <Footer />

      {filteredJobs.length > 0 && <JobListSchema jobs={filteredJobs} />}
      <BackToTop />

      <div
        className={`fixed bottom-24 right-6 z-40 transition-all duration-300 ${
          showFloatingBtn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <Link
          href="/client/post-job"
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-5 py-3 rounded-full shadow-lg font-semibold text-sm whitespace-nowrap transition-all cursor-pointer"
          aria-label="Post a Job"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-add-circle-line text-lg"></i>
          </div>
          Post a Job
        </Link>
      </div>
    </div>
  );
}