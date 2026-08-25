"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import ClientMonitoringStats from './ClientMonitoringStats';
import ClientMonitoringAlerts from './ClientMonitoringAlerts';
import ClientMonitoringTable from './ClientMonitoringTable';
import ClientMonitoringDetail from './ClientMonitoringDetail';
import Pagination from '@/components/Pagination';

interface SubscriptionData {
  user_id: string;
  status: string;
  plan_name: string;
  trial_end_date: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

interface JobData {
  id: string;
  client_id: string;
  status: string;
  start_date: string | null;
  created_at: string;
  guards_required: number;
  job_title: string;
}

interface ApplicationData {
  id: string;
  job_id: string;
  status: string;
}

interface AssignmentData {
  id: string;
  job_id: string;
  status: string;
}

interface PaymentData {
  id: string;
  user_id: string;
  status: string;
  amount: number;
  created_at: string;
}

interface TicketData {
  id: string;
  client_id: string;
  status: string;
  priority: string;
  created_at: string;
  subject: string;
}

interface TransactionData {
  id: string;
  client_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface ClientMonitoringData {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  business_address: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  is_suspended: boolean | null;
  subscription_tier: string | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  trading_name: string | null;
  company_registration_number: string | null;
  vat_number: string | null;
  billing_email: string | null;
  billing_address: string | null;
  subscription: SubscriptionData | null;
  jobCounts: {
    total: number;
    active: number;
    posted: number;
    draft: number;
    completed: number;
    payment_pending: number;
    starting_soon_48h: number;
    no_applicants: number;
  };
  paymentStatus: {
    total_spent: number;
    failed_payments: number;
    pending_payments: number;
  };
  supportStatus: {
    open_tickets: number;
    urgent_tickets: number;
    awaiting_reply: number;
  };
  healthScore: number;
  healthStatus: 'healthy' | 'warning' | 'needs_attention' | 'critical';
  alerts: string[];
}

function calculateProfilePercent(client: any): number {
  const fields = [
    !!client.company_name?.trim(),
    !!client.contact_name?.trim(),
    !!client.email?.trim(),
    !!client.phone?.trim(),
    !!client.city?.trim(),
    !!client.postcode?.trim(),
    !!client.business_address?.trim(),
    !!client.company_registration_number?.trim(),
    !!client.vat_number?.trim(),
    !!client.billing_email?.trim(),
    !!client.billing_address?.trim(),
  ];
  const done = fields.filter(Boolean).length;
  return Math.round((done / fields.length) * 100);
}

function calculateHealthScore(client: any, enriched: any): { score: number; status: ClientMonitoringData['healthStatus'] } {
  let score = 0;

  const profilePct = calculateProfilePercent(client);
  score += Math.round((profilePct / 100) * 20);

  if (enriched.subscription?.status === 'active') score += 20;
  else if (enriched.subscription?.status === 'trialing') score += 15;
  else if (enriched.subscription?.status === 'past_due') score += 5;

  if (enriched.paymentStatus.total_spent > 0) score += 15;
  else if (enriched.jobCounts.total > 0) score += 5;

  if (enriched.jobCounts.active > 0) score += 10;
  else if (enriched.jobCounts.total > 0) score += 5;

  if (enriched.paymentStatus.failed_payments === 0) score += 10;

  if (enriched.supportStatus.urgent_tickets === 0) score += 10;
  else if (enriched.supportStatus.open_tickets === 0) score += 5;

  if (client.last_login) {
    const daysSince = (Date.now() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 10;
    else if (daysSince < 30) score += 5;
  }

  if (client.verified) score += 5;

  const status: ClientMonitoringData['healthStatus'] =
    score >= 90 ? 'healthy' : score >= 70 ? 'warning' : score >= 50 ? 'needs_attention' : 'critical';

  return { score, status };
}

function getClientAlerts(client: any, enriched: any): string[] {
  const alerts: string[] = [];
  if (enriched.paymentStatus.failed_payments > 0) alerts.push('payment_failed');
  if (enriched.subscription?.trial_end_date) {
    const trialEnd = new Date(enriched.subscription.trial_end_date);
    const daysUntil = (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= 7) alerts.push('trial_ending');
  }
  if (enriched.jobCounts.starting_soon_48h > 0) alerts.push('job_starts_soon');
  if (enriched.supportStatus.urgent_tickets > 0) alerts.push('urgent_ticket');
  if (enriched.jobCounts.no_applicants > 0) alerts.push('no_applicants');
  if (!client.profile_completed) alerts.push('incomplete_profile');
  if (enriched.paymentStatus.total_spent === 0 && enriched.jobCounts.total === 0) alerts.push('no_activity');
  return alerts;
}

const ALERT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  payment_failed: { label: 'Payment Failed', color: 'red', icon: 'ri-error-warning-line' },
  trial_ending: { label: 'Trial Ending Soon', color: 'amber', icon: 'ri-time-line' },
  job_starts_soon: { label: 'Job Starts Soon', color: 'blue', icon: 'ri-calendar-check-line' },
  urgent_ticket: { label: 'Urgent Ticket', color: 'red', icon: 'ri-alarm-warning-line' },
  no_applicants: { label: 'No Applicants', color: 'orange', icon: 'ri-user-search-line' },
  incomplete_profile: { label: 'Incomplete Profile', color: 'amber', icon: 'ri-user-unfollow-line' },
  no_activity: { label: 'No Activity', color: 'slate', icon: 'ri-zzz-line' },
};

export default function ClientMonitoringPage() {
  const [clients, setClients] = useState<ClientMonitoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'needs_attention' | 'critical' | 'has_alerts'>('all');
  const [selectedClient, setSelectedClient] = useState<ClientMonitoringData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        clientsRes,
        subsRes,
        jobsRes,
        appsRes,
        assignRes,
        paymentsRes,
        ticketsRes,
        txRes,
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('subscriptions').select('*'),
        supabase.from('jobs').select('id, client_id, status, start_date, created_at, guards_required, job_title').eq('is_deleted', false),
        supabase.from('job_applications').select('id, job_id, status'),
        supabase.from('job_assignments').select('id, job_id, status'),
        supabase.from('subscription_payments').select('id, user_id, status, amount, created_at'),
        supabase.from('support_tickets').select('id, client_id, status, priority, created_at, subject').eq('is_deleted', false),
        supabase.from('transactions').select('id, client_id, amount, status, created_at'),
      ]);

      const clientsData = (clientsRes.data || []) as any[];
      const subsData = (subsRes.data || []) as SubscriptionData[];
      const jobsData = (jobsRes.data || []) as JobData[];
      const appsData = (appsRes.data || []) as ApplicationData[];
      const assignData = (assignRes.data || []) as AssignmentData[];
      const paymentsData = (paymentsRes.data || []) as PaymentData[];
      const ticketsData = (ticketsRes.data || []) as TicketData[];
      const txData = (txRes.data || []) as TransactionData[];

      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const enriched: ClientMonitoringData[] = clientsData.map((client) => {
        const clientJobs = jobsData.filter((j) => j.client_id === client.id);
        const clientApps = appsData.filter((a) => clientJobs.some((j) => j.id === a.job_id));
        const clientAssignments = assignData.filter((a) => clientJobs.some((j) => j.id === a.job_id));
        const clientPayments = paymentsData.filter((p) => p.user_id === client.user_id);
        const clientTickets = ticketsData.filter((t) => t.client_id === client.id);
        const clientTx = txData.filter((t) => t.client_id === client.id);
        const clientSub = subsData.find((s) => s.user_id === client.user_id) || null;

        const openJobs = clientJobs.filter((j) => j.status === 'open');
        const jobsNoApplicants = openJobs.filter((j) => {
          const apps = clientApps.filter((a) => a.job_id === j.id);
          return apps.length === 0;
        });

        const jobsStartingSoon = clientJobs.filter((j) => {
          if (!j.start_date) return false;
          const d = new Date(j.start_date);
          return d >= now && d <= in48h;
        });

        const totalSpent = clientTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const failedPayments = clientPayments.filter((p) => p.status === 'failed').length;
        const pendingPayments = clientPayments.filter((p) => p.status === 'pending').length;

        const openTickets = clientTickets.filter((t) => ['open', 'awaiting_client', 'escalated', 'under_review'].includes(t.status));
        const urgentTickets = openTickets.filter((t) => t.priority === 'urgent');
        const awaitingReply = openTickets.filter((t) => t.status === 'awaiting_client');

        const enrichedData = {
          subscription: clientSub,
          jobCounts: {
            total: clientJobs.length,
            active: clientJobs.filter((j) => j.status === 'active').length,
            posted: clientJobs.filter((j) => j.status === 'open').length,
            draft: clientJobs.filter((j) => j.status === 'draft').length,
            completed: clientJobs.filter((j) => j.status === 'completed').length,
            payment_pending: clientJobs.filter((j) => j.status === 'payment_pending').length,
            starting_soon_48h: jobsStartingSoon.length,
            no_applicants: jobsNoApplicants.length,
          },
          paymentStatus: {
            total_spent: totalSpent,
            failed_payments: failedPayments,
            pending_payments: pendingPayments,
          },
          supportStatus: {
            open_tickets: openTickets.length,
            urgent_tickets: urgentTickets.length,
            awaiting_reply: awaitingReply.length,
          },
        };

        const { score, status } = calculateHealthScore(client, enrichedData);
        const alerts = getClientAlerts(client, enrichedData);

        return {
          ...client,
          ...enrichedData,
          healthScore: score,
          healthStatus: status,
          alerts,
        } as ClientMonitoringData;
      });

      setClients(enriched);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[client-monitoring] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q);

    const matchFilter =
      filterStatus === 'all'
        ? true
        : filterStatus === 'has_alerts'
        ? c.alerts.length > 0
        : c.healthStatus === filterStatus;

    return matchSearch && matchFilter;
  });

  const totalItems = filtered.length;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalClients = clients.length;
  const newClientsThisMonth = clients.filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const trialClients = clients.filter((c) => c.subscription?.status === 'trialing').length;
  const activePayingClients = clients.filter((c) => c.subscription?.status === 'active').length;
  const clientsWithFailedPayments = clients.filter((c) => c.paymentStatus.failed_payments > 0).length;
  const clientsWithOpenTickets = clients.filter((c) => c.supportStatus.open_tickets > 0).length;
  const clientsWithJobsStartingSoon = clients.filter((c) => c.jobCounts.starting_soon_48h > 0).length;

  const urgentAlerts = clients.flatMap((c) =>
    c.alerts
      .filter((a) => ['payment_failed', 'urgent_ticket', 'trial_ending'].includes(a))
      .map((a) => ({
        clientId: c.id,
        clientName: c.company_name || c.contact_name,
        alert: a,
        label: ALERT_LABELS[a]?.label || a,
        color: ALERT_LABELS[a]?.color || 'red',
        icon: ALERT_LABELS[a]?.icon || 'ri-alert-line',
      }))
  );

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-[#111d35] border-b border-[#1a2b4a] px-6 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Client Monitoring</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Overview of all client accounts and issues needing attention'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a2b4a] text-slate-400 rounded-xl hover:bg-[#1e2d4d] hover:text-white transition-colors text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6 space-y-6">
        <ClientMonitoringStats
          totalClients={totalClients}
          newClientsThisMonth={newClientsThisMonth}
          trialClients={trialClients}
          activePayingClients={activePayingClients}
          clientsWithFailedPayments={clientsWithFailedPayments}
          clientsWithOpenTickets={clientsWithOpenTickets}
          clientsWithJobsStartingSoon={clientsWithJobsStartingSoon}
        />

        <ClientMonitoringAlerts alerts={urgentAlerts} />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Search by company, contact, email, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#111d35] text-white placeholder-slate-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 bg-[#111d35] focus:ring-2 focus:ring-teal-500 cursor-pointer pr-8"
            >
              <option value="all">All Clients</option>
              <option value="has_alerts">Has Alerts</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <ClientMonitoringTable
          clients={paginated}
          loading={loading}
          onSelectClient={(c) => setSelectedClient(c)}
        />

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            setCurrentPage(1);
          }}
        />
      </div>

      {selectedClient && (
        <ClientMonitoringDetail
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={() => {
            fetchData();
            setSelectedClient(null);
          }}
        />
      )}
    </div>
  );
}