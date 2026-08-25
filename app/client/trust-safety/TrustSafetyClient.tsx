"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useSafetyData, useUpdateSafetyCheck, useUpdateJobSafety } from './useSafetyData';
import SafetyStatsBar from './SafetyStatsBar';
import JobSafetyChecklist from './JobSafetyChecklist';
import SiteInstructionsPanel from './SiteInstructionsPanel';
import EmergencyContactsPanel from './EmergencyContactsPanel';
import IncidentHistory from './IncidentHistory';
import ComplianceWarnings from './ComplianceWarnings';
import type { GuardAssignment } from './useSafetyData';

interface ClientDetails {
  id: string;
  company_name: string;
  contact_name: string;
}

export default function TrustSafetyClient() {
  const { checking, blocked } = useRouteGuard();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [assignments, setAssignments] = useState<Record<string, GuardAssignment[]>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const { jobs, incidents, counts, loading, error } = useSafetyData();
  const updateSafetyCheck = useUpdateSafetyCheck();
  const updateJobSafety = useUpdateJobSafety();

  const loadClient = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, contact_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setClient(data as ClientDetails);
  }, []);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useEffect(() => {
    if (jobs.length === 0) return;
    const loadAssignments = async () => {
      setLoadingAssignments(true);
      const jobIds = jobs.map((j) => j.id);
      const { data } = await supabase
        .from('job_assignments')
        .select('id, job_id, guard_id, status, guards(id, full_name, sia_licence_number, sia_verified, sia_expiry_date, sia_licence_type)')
        .in('job_id', jobIds);
      const map: Record<string, GuardAssignment[]> = {};
      (data || []).forEach((a: any) => {
        if (!map[a.job_id]) map[a.job_id] = [];
        map[a.job_id].push(a as GuardAssignment);
      });
      setAssignments(map);
      setLoadingAssignments(false);
    };
    loadAssignments();
  }, [jobs.length]);

  const handleToggle = async (jobId: string, checkId: string | undefined, field: string, value: boolean) => {
    if (!client) return;
    const { error } = await updateSafetyCheck(checkId, jobId, client.id, { [field]: value });
    if (!error) {
      window.location.reload();
    }
  };

  const handleChangeRisk = async (jobId: string, riskLevel: string) => {
    const { error } = await updateJobSafety(jobId, { risk_level: riskLevel });
    if (!error) {
      window.location.reload();
    }
  };

  const handleChangeLoneWorker = async (jobId: string, value: boolean) => {
    const { error } = await updateJobSafety(jobId, { lone_worker_flag: value });
    if (!error) {
      window.location.reload();
    }
  };

  const handleSaveSiteInstructions = async (jobId: string, fields: Record<string, string | null>) => {
    const { error } = await updateJobSafety(jobId, fields);
    if (!error) {
      window.location.reload();
    }
  };

  const handleSaveJobContact = async (jobId: string, field: string, value: string | null) => {
    const { error } = await updateJobSafety(jobId, { [field]: value });
    if (!error) {
      window.location.reload();
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-400">You do not have permission to view this area.</p>
        </div>
      </div>
    );
  }

  const initials = client?.company_name
    ? client.company_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'CL';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'checklist', label: 'Safety Checklist', icon: 'ri-list-check-2' },
    { id: 'site', label: 'Site Instructions', icon: 'ri-door-open-line' },
    { id: 'contacts', label: 'Emergency Contacts', icon: 'ri-phone-line' },
    { id: 'compliance', label: 'Compliance', icon: 'ri-error-warning-line' },
    { id: 'incidents', label: 'Incidents', icon: 'ri-flashlight-line' },
  ];

  const jobMap = Object.fromEntries(jobs.map((j) => [j.id, { job_title: j.job_title, venue_name: j.venue_name }]));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={client?.company_name || client?.contact_name || 'Client'}
        subtitle="Client"
        initials={initials}
      />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Trust & Safety</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage safety, compliance, and emergency contacts for every job.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/client/support"
                className="flex items-center gap-2 bg-white dark:bg-[#111d35] text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-customer-service-2-line" />
                Support
              </Link>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="flex lg:hidden gap-2 overflow-x-auto mb-4 pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap cursor-pointer transition-all ${
                  activeTab === t.id
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white dark:bg-[#111d35] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1e2d4d]'
                }`}
              >
                <i className={`${t.icon}`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Desktop Tabs */}
          <div className="hidden lg:flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-[#1e2d4d] pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-teal-500 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#162036]'
                }`}
              >
                <i className={`${t.icon}`} />
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <SafetyStatsBar counts={counts} onTabChange={setActiveTab} />

              {counts.complianceWarnings > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="ri-error-warning-line text-red-400 text-lg" />
                    <h3 className="text-sm font-bold text-red-400">Compliance Warnings</h3>
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {counts.complianceWarnings}
                    </span>
                  </div>
                  <ComplianceWarnings jobs={jobs} assignments={assignments} />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="ri-phone-line text-teal-400 text-lg" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Emergency Contacts</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {counts.missingEmergencyContacts} job{counts.missingEmergencyContacts !== 1 ? 's' : ''} missing emergency contacts.
                  </p>
                  <button
                    onClick={() => setActiveTab('contacts')}
                    className="w-full py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Manage Contacts
                  </button>
                </div>

                <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="ri-door-open-line text-teal-400 text-lg" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Site Instructions</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {counts.missingSiteInstructions} job{counts.missingSiteInstructions !== 1 ? 's' : ''} missing site instructions.
                  </p>
                  <button
                    onClick={() => setActiveTab('site')}
                    className="w-full py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Add Instructions
                  </button>
                </div>
              </div>

              {incidents.length > 0 && (
                <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <i className="ri-flashlight-line text-rose-400 text-lg" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Incidents</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('incidents')}
                      className="text-xs text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <IncidentHistory incidents={incidents.slice(0, 3)} jobs={jobMap} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-list-check-2 text-teal-400 text-lg" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Job Safety Checklist</h2>
              </div>
              <JobSafetyChecklist
                jobs={jobs}
                onToggle={handleToggle}
                onChangeRisk={handleChangeRisk}
                onChangeLoneWorker={handleChangeLoneWorker}
              />
            </div>
          )}

          {activeTab === 'site' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-door-open-line text-teal-400 text-lg" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Site Instructions</h2>
              </div>
              <SiteInstructionsPanel jobs={jobs} onSave={handleSaveSiteInstructions} />
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-phone-line text-teal-400 text-lg" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Emergency Contacts</h2>
              </div>
              <EmergencyContactsPanel
                jobs={jobs}
                clientId={client?.id || ''}
                onSaveJobContact={handleSaveJobContact}
              />
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-error-warning-line text-orange-400 text-lg" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Compliance Warnings</h2>
              </div>
              <ComplianceWarnings jobs={jobs} assignments={assignments} />
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-flashlight-line text-rose-400 text-lg" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Incident History</h2>
              </div>
              <IncidentHistory incidents={incidents} jobs={jobMap} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}