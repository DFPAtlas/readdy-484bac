'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadCompanyDashboardData } from '@/lib/company-dashboard-data';
import { resolveCompanyTab, type CompanyTab } from '@/lib/company-navigation';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';

interface Company {
  id: string;
  company_name: string;
  company_number: string;
  vat_number: string;
  business_address: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  verification_status: string;
  profile_completed: boolean;
  subscription_status: string;
  total_staff: number;
  active_guards: number;
  total_sites: number;
  total_revenue: number;
  created_at: string;
}

interface CompanySite {
  id: string;
  site_name: string;
  address: string;
  city: string;
  postcode: string;
  contact_name: string;
  contact_phone: string;
  active_rotas: number;
  active_guards: number;
  status: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  sia_licence_number: string;
  status: string;
  site_name: string;
}

interface Rota {
  id: string;
  site_name: string;
  guard_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  site_name: string;
  reported_at: string;
}

interface ComplianceRecord {
  id: string;
  record_type: string;
  title: string;
  status: string;
  expiry_date: string;
}

interface TrainingRecord {
  id: string;
  course_name: string;
  guard_name: string;
  completion_date: string;
  expiry_date: string;
  status: string;
}

export default function CompanyDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [sites, setSites] = useState<CompanySite[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const [activeTab, setActiveTab] = useState<CompanyTab>('overview');
  useEffect(() => { setActiveTab(resolveCompanyTab(searchParams.get('tab'))); }, [searchParams]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const loadDashboard = useCallback(async () => {
    if (!mountedRef.current) return;
    const request = ++requestRef.current;
    const current = () => mountedRef.current && request === requestRef.current;
    setLoading(true); setLoadError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError) throw new Error('Your company account could not be confirmed. Please retry.');
      if (!user) { router.replace('/company/login'); return; }
      const { data: companyData, error: companyError } = await supabase.from('companies').select('*').eq('user_id', user.id).maybeSingle();
      if (!current()) return;
      if (companyError) throw new Error('Your company profile could not be loaded. Please retry.');
      if (!companyData) { router.replace('/company/login?error=company-profile-not-found'); return; }
      const data = await loadCompanyDashboardData(supabase, companyData.id, user.id);
      if (!current()) return;
      setCompany(companyData as Company);
      setSites(data.sites); setStaff(data.staff); setRotas(data.rotas); setIncidents(data.incidents);
      setCompliance(data.compliance); setTraining(data.training); setUnreadMessages(data.unreadMessages);
    } catch (cause) {
      if (current()) setLoadError(cause instanceof Error ? cause.message : 'Company dashboard data could not be loaded.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard();
    return () => { mountedRef.current = false; };
  }, [loadDashboard]);

  useEffect(() => {
    if (!company?.id) return;
    const ch = supabase
      .channel('company-dashboard')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'company_sites', filter: `company_id=eq.${company.id}` }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'app', table: 'company_staff', filter: `company_id=eq.${company.id}` }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'app', table: 'rotas', filter: `company_id=eq.${company.id}` }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'app', table: 'incidents', filter: `company_id=eq.${company.id}` }, () => loadDashboard())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [company?.id, loadDashboard]);

  const getSeverityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/25';
    if (s === 'high') return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    if (s === 'medium') return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  };

  const getStatusColor = (s: string) => {
    if (s === 'active' || s === 'completed' || s === 'approved' || s === 'resolved') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
    if (s === 'pending' || s === 'scheduled') return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    if (s === 'open' || s === 'in_progress') return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
    if (s === 'inactive' || s === 'expired') return 'bg-red-500/15 text-red-400 border-red-500/25';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your company dashboard...</p>
        </div>
      </div>
    );
  }

  if (loadError) return <main className="min-h-screen bg-[#0B1933] text-white flex items-center justify-center px-6">
    <div role="alert" className="max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <h1 className="text-xl font-bold mb-3">Company dashboard unavailable</h1><p>{loadError}</p>
      <button type="button" onClick={() => void loadDashboard()} className="mt-4 text-teal-300 underline">Retry dashboard</button>
      <Link href="/contact?subject=company-dashboard" className="ml-6 text-teal-300 underline">Contact support</Link>
    </div>
  </main>;

  if (!company) return null;

  const initials = company.company_name
    ? company.company_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'CO';

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line' },
    { key: 'sites', label: 'Sites', icon: 'ri-building-4-line', count: sites.length },
    { key: 'staff', label: 'Staff', icon: 'ri-team-line', count: staff.length },
    { key: 'rotas', label: 'Rotas', icon: 'ri-calendar-check-line', count: rotas.length },
    { key: 'incidents', label: 'Incidents', icon: 'ri-alert-line', count: incidents.filter(i => i.status === 'open').length },
    { key: 'compliance', label: 'Compliance', icon: 'ri-shield-check-line', count: compliance.filter(c => c.status === 'pending').length },
    { key: 'training', label: 'Training', icon: 'ri-book-open-line', count: training.length },
    { key: 'reports', label: 'Reports', icon: 'ri-file-chart-line' },
    { key: 'billing', label: 'Billing', icon: 'ri-bank-card-line' },
    { key: 'messages', label: 'Messages', icon: 'ri-message-3-line', count: unreadMessages },
    { key: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  ];

  const revenueFormatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(company.total_revenue || 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex">
      <PortalSidebar
        role="company"
        companyTab={activeTab}
        displayName={company.company_name || 'Company'}
        subtitle={company.verification_status === 'approved' ? 'Verified Company' : 'Company'}
        initials={initials}
        accentColor="violet"
      />
      <div className="flex-1 min-h-screen pt-16 lg:pt-8 pb-24 px-4 lg:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{company.company_name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {company.business_address || 'Security Company Dashboard'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact?subject=company-site-setup" className="flex items-center gap-2 bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-add-circle-line"></i>
                Request Site Setup
              </Link>
              <Link href="/contact?subject=company-staff-setup" className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-user-add-line"></i>
                Request Staff Setup
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-violet-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-team-line text-violet-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{staff.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Staff</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-shield-user-line text-emerald-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{company.active_guards}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Guards</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-building-4-line text-blue-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{sites.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Sites</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-calendar-check-line text-amber-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{rotas.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upcoming Rotas</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-red-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-alert-line text-red-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{incidents.filter(i => i.status === 'open').length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Open Incidents</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl p-5">
              <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center mb-3">
                <i className="ri-money-pound-circle-line text-teal-400 text-lg"></i>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{revenueFormatted}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] rounded-2xl shadow-sm">
            <div className="flex gap-0 border-b border-slate-200 dark:border-[#1e2d4d] overflow-x-auto px-4">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(resolveCompanyTab(tab.key))}
                  className={`flex items-center gap-2 px-4 py-3.5 font-medium transition-colors whitespace-nowrap text-sm border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'text-violet-500 dark:text-violet-400 border-violet-500 dark:border-violet-400'
                      : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  <i className={`${tab.icon} text-base`}></i>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      tab.key === 'incidents' ? 'bg-red-500/15 text-red-400' :
                      tab.key === 'messages' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-violet-500/15 text-violet-400'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Company Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">Company Details</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="text-slate-900 dark:text-white font-medium">{company.company_name}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Number</span><span className="text-slate-900 dark:text-white font-medium">{company.company_number || 'N/A'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">VAT</span><span className="text-slate-900 dark:text-white font-medium">{company.vat_number || 'N/A'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="text-slate-900 dark:text-white font-medium">{company.contact_name}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="text-slate-900 dark:text-white font-medium">{company.phone || 'N/A'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-900 dark:text-white font-medium">{company.email}</span></div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">Status</p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Verification</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(company.verification_status)}`}>{company.verification_status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Subscription</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(company.subscription_status)}`}>{company.subscription_status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Profile</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${company.profile_completed ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-amber-500/15 text-amber-400 border-amber-500/25'}`}>{company.profile_completed ? 'Complete' : 'Incomplete'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Member Since</span>
                            <span className="text-sm text-slate-900 dark:text-white font-medium">{new Date(company.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Rotas</h3>
                      <button onClick={() => setActiveTab('rotas')} className="text-sm text-violet-500 dark:text-violet-400 font-medium hover:underline whitespace-nowrap cursor-pointer">View All</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                            <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Site</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Guard</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Time</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#1e2d4d]">
                          {rotas.slice(0, 5).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#0B1933]">
                              <td className="py-2.5 px-3 text-slate-900 dark:text-white font-medium">{r.site_name}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.guard_name}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{new Date(r.shift_date).toLocaleDateString('en-GB')}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.start_time} - {r.end_time}</td>
                              <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(r.status)}`}>{r.status}</span></td>
                            </tr>
                          ))}
                          {rotas.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-500">No upcoming rotas</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Open Incidents</h3>
                      <button onClick={() => setActiveTab('incidents')} className="text-sm text-violet-500 dark:text-violet-400 font-medium hover:underline whitespace-nowrap cursor-pointer">View All</button>
                    </div>
                    <div className="space-y-3">
                      {incidents.filter(i => i.status === 'open').slice(0, 3).map(inc => (
                        <div key={inc.id} className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-4 border border-slate-200 dark:border-[#1e2d4d]">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityColor(inc.severity)}`}>{inc.severity}</span>
                                <h4 className="font-semibold text-slate-900 dark:text-white">{inc.title}</h4>
                              </div>
                              <p className="text-sm text-slate-500">{inc.description}</p>
                              <p className="text-xs text-slate-400 mt-2">{inc.site_name} · {new Date(inc.reported_at).toLocaleString('en-GB')}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {incidents.filter(i => i.status === 'open').length === 0 && (
                        <p className="text-slate-500 text-sm py-4">No open incidents</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sites' && (
                <div className="space-y-4">
                  {sites.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-building-4-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No sites added yet</p>
                      <Link href="/contact?subject=company-site-setup" className="mt-4 inline-block px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">Request Site Setup</Link>
                    </div>
                  ) : (
                    sites.map(site => (
                      <div key={site.id} className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d] hover:border-violet-500/30 transition-all">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white text-lg">{site.site_name}</h4>
                            <p className="text-sm text-slate-500 mt-1">{site.address}, {site.city}, {site.postcode}</p>
                            <div className="flex items-center gap-4 mt-3 text-sm">
                              <span className="flex items-center gap-1 text-slate-500"><i className="ri-user-line"></i> {site.active_guards} guards</span>
                              <span className="flex items-center gap-1 text-slate-500"><i className="ri-calendar-line"></i> {site.active_rotas} rotas</span>
                              <span className="flex items-center gap-1 text-slate-500"><i className="ri-phone-line"></i> {site.contact_name || 'No contact'}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(site.status)}`}>{site.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'staff' && (
                <div className="space-y-4">
                  {staff.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-team-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No staff added yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Name</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Role</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">SIA Licence</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Site</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#1e2d4d]">
                          {staff.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#0B1933]">
                              <td className="py-3 px-3 text-slate-900 dark:text-white font-medium">{s.full_name}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400 capitalize">{s.role}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{s.sia_licence_number || 'N/A'}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{s.site_name}</td>
                              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(s.status)}`}>{s.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'rotas' && (
                <div className="space-y-4">
                  {rotas.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-calendar-check-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No upcoming rotas</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Site</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Guard</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Time</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#1e2d4d]">
                          {rotas.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#0B1933]">
                              <td className="py-3 px-3 text-slate-900 dark:text-white font-medium">{r.site_name}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{r.guard_name}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{new Date(r.shift_date).toLocaleDateString('en-GB')}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{r.start_time} - {r.end_time}</td>
                              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(r.status)}`}>{r.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'incidents' && (
                <div className="space-y-4">
                  {incidents.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-alert-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No incidents recorded</p>
                    </div>
                  ) : (
                    incidents.map(inc => (
                      <div key={inc.id} className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityColor(inc.severity)}`}>{inc.severity}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusColor(inc.status)}`}>{inc.status}</span>
                            </div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{inc.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">{inc.description}</p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                              <span><i className="ri-building-4-line mr-1"></i>{inc.site_name}</span>
                              <span><i className="ri-time-line mr-1"></i>{new Date(inc.reported_at).toLocaleString('en-GB')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'compliance' && (
                <div className="space-y-4">
                  {compliance.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-shield-check-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No compliance records</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Title</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#1e2d4d]">
                          {compliance.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[#0B1933]">
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400 capitalize">{c.record_type}</td>
                              <td className="py-3 px-3 text-slate-900 dark:text-white font-medium">{c.title}</td>
                              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(c.status)}`}>{c.status}</span></td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'training' && (
                <div className="space-y-4">
                  {training.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="ri-book-open-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No training records</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e2d4d]">
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Course</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Guard</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Completed</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Expiry</th>
                            <th className="text-left py-3 px-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#1e2d4d]">
                          {training.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-[#0B1933]">
                              <td className="py-3 px-3 text-slate-900 dark:text-white font-medium">{t.course_name}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{t.guard_name}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{t.completion_date ? new Date(t.completion_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{t.expiry_date ? new Date(t.expiry_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(t.status)}`}>{t.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Reports</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: 'Staff Report', desc: 'Staff activity and attendance summary', icon: 'ri-team-line', color: 'violet' },
                      { title: 'Site Report', desc: 'Site performance and incident summary', icon: 'ri-building-4-line', color: 'blue' },
                      { title: 'Financial Report', desc: 'Revenue, costs and profitability', icon: 'ri-money-pound-circle-line', color: 'emerald' },
                      { title: 'Compliance Report', desc: 'Compliance status and upcoming deadlines', icon: 'ri-shield-check-line', color: 'amber' },
                      { title: 'Training Report', desc: 'Staff training completion and gaps', icon: 'ri-book-open-line', color: 'teal' },
                      { title: 'Incident Report', desc: 'Incident trends and resolution metrics', icon: 'ri-alert-line', color: 'red' },
                    ].map(report => (
                      <div key={report.title} className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d] hover:border-violet-500/30 transition-all cursor-pointer">
                        <div className={`w-10 h-10 bg-${report.color}-500/15 rounded-lg flex items-center justify-center mb-3`}>
                          <i className={`${report.icon} text-${report.color}-400 text-lg`}></i>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{report.title}</h4>
                        <p className="text-sm text-slate-500 mt-1">{report.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Billing Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Current Plan</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{company.subscription_status || 'Free'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Total Revenue</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{revenueFormatted}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d]">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">VAT Number</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{company.vat_number || 'Not Set'}</p>
                    </div>
                  </div>
                  <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-arrow-right-line"></i>
                    Manage Billing
                  </Link>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Messages</h3>
                    <Link href="/contact?subject=company-messages" className="text-sm text-violet-500 dark:text-violet-400 font-medium hover:underline whitespace-nowrap">Contact Support</Link>
                  </div>
                  {unreadMessages > 0 ? (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
                          <i className="ri-message-3-line text-blue-400 text-lg"></i>
                        </div>
                        <div>
                          <p className="font-semibold text-blue-300">You have {unreadMessages} unread message{unreadMessages !== 1 ? 's' : ''}</p>
                          <p className="text-sm text-blue-400/70">Check your messages for updates from staff and clients</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <i className="ri-message-3-line text-6xl text-slate-300 dark:text-slate-600"></i>
                      <p className="text-slate-500 mt-4">No new messages</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Company Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: 'Company Profile', desc: 'Contact support to request changes to your company profile', icon: 'ri-building-line', href: '/contact?subject=company-profile' },
                      { title: 'Staff Management', desc: 'Review staff records; contact support to request changes', icon: 'ri-team-line', href: '/company/dashboard?tab=staff' },
                      { title: 'Notification Preferences', desc: 'Ask support about available notification settings', icon: 'ri-notification-3-line', href: '/contact?subject=company-notifications' },
                      { title: 'Security Settings', desc: 'Contact support for account security assistance', icon: 'ri-shield-keyhole-line', href: '/contact?subject=company-security' },
                      { title: 'Billing & Invoices', desc: 'Review the billing information available for this company', icon: 'ri-bank-card-line', href: '/company/dashboard?tab=billing' },
                      { title: 'API & Integrations', desc: 'Discuss integration availability and scope with support', icon: 'ri-plug-line', href: '/contact?subject=company-integrations' },
                    ].map(item => (
                      <Link key={item.title} href={item.href} className="bg-slate-50 dark:bg-[#0B1933] rounded-xl p-5 border border-slate-200 dark:border-[#1e2d4d] hover:border-violet-500/30 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-violet-500/15 rounded-lg flex items-center justify-center group-hover:bg-violet-500/25 transition-colors">
                            <i className={`${item.icon} text-violet-400 text-lg`}></i>
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{item.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
