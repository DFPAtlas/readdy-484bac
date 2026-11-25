export interface DashboardFailure {
  key: string;
  label: string;
  message: string;
}

export interface DashboardStatsData {
  totalJobs: number;
  activeJobs: number;
  newJobsThisMonth: number;
  totalGuards: number;
  totalClients: number;
  pendingVerifications: number;
  pendingSiaVerifications: number;
  openComplaints: number;
  failedPayments: number;
  heldPayments: number;
  monthlyRevenue: number;
  avgMatchTimeMinutes: number | null;
  activeSubscriptions: number;
  trialAccounts: number;
  incompleteProfiles: number;
  openSupportTickets: number;
  newUsersThisMonth: number;
}

export interface DashboardTrends {
  newJobsThisMonthTrend: number | null;
  monthlyRevenueTrend: number | null;
  avgMatchTimeTrend: number | null;
}

export interface DashboardAlert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
  href: string;
}

export interface AvailableDashboardSnapshot {
  available: true;
  stats: DashboardStatsData;
  trends: DashboardTrends;
  alerts: DashboardAlert[];
}

export interface UnavailableDashboardSnapshot {
  available: false;
  failures: DashboardFailure[];
}

export type DashboardSnapshot = AvailableDashboardSnapshot | UnavailableDashboardSnapshot;

export interface LatestRequestTracker {
  begin(): number;
  isCurrent(id: number): boolean;
  invalidate(): void;
}

export interface TimeoutScope {
  run<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T>;
  clear(): void;
}

export interface SettledDashboardResults {
  values: Record<string, unknown>;
  failures: DashboardFailure[];
}

export const DASHBOARD_COLLECTED_STATUSES: readonly string[] = [
  'succeeded',
  'completed',
  'paid',
  'refunded',
  'partially_refunded',
];

export const STATS_RESULT_KEYS: readonly string[] = [
  'totalJobs',
  'activeJobs',
  'newJobsThisMonth',
  'totalGuards',
  'totalClients',
  'pendingVerifications',
  'pendingSiaVerifications',
  'openComplaints',
  'failedSubscriptionPayments',
  'failedTransactions',
  'heldPayouts',
  'monthlySubscriptionRevenue',
  'monthlyTransactionRevenue',
  'monthlyMatchTimeAssignments',
  'prevNewJobs',
  'prevMonthlySubscriptionRevenue',
  'prevMonthlyTransactionRevenue',
  'prevMonthlyMatchTimeAssignments',
  'activeSubscriptions',
  'trialAccounts',
  'incompleteProfiles',
  'openSupportTickets',
  'newGuardsThisMonth',
  'newClientsThisMonth',
  'jobDates',
];

export const STATS_RESULT_LABELS: Readonly<Record<string, string>> = {
  totalJobs: 'Total jobs',
  activeJobs: 'Active jobs',
  newJobsThisMonth: 'New jobs this month',
  totalGuards: 'Total guards',
  totalClients: 'Total clients',
  pendingVerifications: 'Guard verifications',
  pendingSiaVerifications: 'SIA verifications',
  openComplaints: 'Complaints',
  failedSubscriptionPayments: 'Failed subscription payments',
  failedTransactions: 'Failed transactions',
  heldPayouts: 'Held payouts',
  monthlySubscriptionRevenue: 'Subscription revenue this month',
  monthlyTransactionRevenue: 'Transaction revenue this month',
  monthlyMatchTimeAssignments: 'Match time (this month)',
  prevNewJobs: 'Previous month jobs',
  prevMonthlySubscriptionRevenue: 'Previous month subscription revenue',
  prevMonthlyTransactionRevenue: 'Previous month transaction revenue',
  prevMonthlyMatchTimeAssignments: 'Match time (previous month)',
  activeSubscriptions: 'Active subscriptions',
  trialAccounts: 'Trial accounts',
  incompleteProfiles: 'Incomplete guard profiles',
  openSupportTickets: 'Open support tickets',
  newGuardsThisMonth: 'New guards this month',
  newClientsThisMonth: 'New clients this month',
  jobDates: 'Job creation dates',
};

export const STATS_COUNT_KEYS: readonly string[] = [
  'totalJobs',
  'activeJobs',
  'newJobsThisMonth',
  'totalGuards',
  'totalClients',
  'pendingVerifications',
  'pendingSiaVerifications',
  'openComplaints',
  'failedSubscriptionPayments',
  'failedTransactions',
  'heldPayouts',
  'prevNewJobs',
  'activeSubscriptions',
  'trialAccounts',
  'incompleteProfiles',
  'openSupportTickets',
  'newGuardsThisMonth',
  'newClientsThisMonth',
];

export const STATS_ROW_KEYS: readonly string[] = [
  'monthlySubscriptionRevenue',
  'monthlyTransactionRevenue',
  'monthlyMatchTimeAssignments',
  'prevMonthlySubscriptionRevenue',
  'prevMonthlyTransactionRevenue',
  'prevMonthlyMatchTimeAssignments',
  'jobDates',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function labelFor(key: string): string {
  return STATS_RESULT_LABELS[key] || 'Dashboard metric';
}

function messageFromError(error: unknown): string {
  if (!error) return 'Request failed';
  if (typeof error === 'string') return error;
  const record = asRecord(error);
  const message = record && typeof record.message === 'string' ? record.message.trim() : '';
  return message || 'Request failed';
}

function failureFor(key: string, message: unknown): DashboardFailure {
  return {key, label: labelFor(key), message: messageFromError(message)};
}

export function createLatestRequestTracker(): LatestRequestTracker {
  let current = 0;
  return {
    begin(): number {
      current += 1;
      return current;
    },
    isCurrent(id: number): boolean {
      return id === current;
    },
    invalidate(): void {
      current += 1;
    },
  };
}

export function createTimeoutScope(): TimeoutScope {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  return {
    run<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          reject(new Error(message));
        }, timeoutMs);
        timers.add(timer);
        promise.then(
          (value) => {
            timers.delete(timer);
            clearTimeout(timer);
            resolve(value);
          },
          (error: unknown) => {
            timers.delete(timer);
            clearTimeout(timer);
            reject(error);
          }
        );
      });
    },
    clear(): void {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
  };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return createTimeoutScope().run(promise, timeoutMs, message);
}

function moneyCents(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function remainingPence(payment: unknown): number {
  const record = asRecord(payment);
  if (!record) return 0;
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  const collected = DASHBOARD_COLLECTED_STATUSES.includes(status) ? moneyCents(record.amount) : 0;
  if (collected === 0) return 0;
  if (status === 'refunded') return 0;
  const recorded = moneyCents(record.refund_amount);
  if (recorded > 0) return collected - Math.min(collected, recorded);
  return record.refunded ? 0 : collected;
}

export function remainingRevenue(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  const total = rows.reduce<number>((sum: number, payment: unknown) => sum + remainingPence(payment), 0);
  return total / 100;
}

function averageMatchMinutes(rows: readonly unknown[], jobCreatedAtById: Map<string, string>): number | null {
  let totalMinutes = 0;
  let validCount = 0;
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const assignedAt = typeof record.assigned_at === 'string' ? new Date(record.assigned_at).getTime() : 0;
    const jobId = typeof record.job_id === 'string' ? record.job_id : null;
    const createdAtValue = jobId ? jobCreatedAtById.get(jobId) : null;
    const jobCreatedAt = createdAtValue ? new Date(createdAtValue).getTime() : 0;
    if (assignedAt && jobCreatedAt && assignedAt > jobCreatedAt) {
      totalMinutes += (assignedAt - jobCreatedAt) / (1000 * 60);
      validCount += 1;
    }
  }
  if (validCount === 0) return null;
  return Math.round(totalMinutes / validCount);
}

function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function settleDashboardQueries(settlements: readonly PromiseSettledResult<unknown>[]): SettledDashboardResults {
  const values: Record<string, unknown> = {};
  const failures: DashboardFailure[] = [];

  if (!Array.isArray(settlements) || settlements.length !== STATS_RESULT_KEYS.length) {
    failures.push(failureFor('querySet', 'Dashboard queries did not complete as expected'));
    return {values, failures};
  }

  settlements.forEach((settlement, index) => {
    const key = STATS_RESULT_KEYS[index];
    if (settlement.status === 'rejected') {
      failures.push(failureFor(key, settlement.reason));
      return;
    }
    if (settlement.status !== 'fulfilled') {
      failures.push(failureFor(key, 'Request failed'));
      return;
    }
    const record = asRecord(settlement.value);
    if (!record) {
      failures.push(failureFor(key, 'Empty response'));
      return;
    }
    if (record.error) {
      failures.push(failureFor(key, record.error));
      return;
    }
    values[key] = record;
  });

  STATS_COUNT_KEYS.forEach((key) => {
    const record = asRecord(values[key]);
    if (!record) return;
    if (typeof record.count !== 'number' || !Number.isFinite(record.count)) {
      failures.push(failureFor(key, 'Count was not returned by the query'));
    }
  });

  STATS_ROW_KEYS.forEach((key) => {
    const record = asRecord(values[key]);
    if (!record) return;
    if (!Array.isArray(record.data)) {
      failures.push(failureFor(key, 'Rows were not returned by the query'));
    }
  });

  return {values, failures};
}

function requireCount(values: Record<string, unknown>, key: string): number {
  const record = asRecord(values[key]);
  if (!record || typeof record.count !== 'number' || !Number.isFinite(record.count)) {
    throw new Error(`Dashboard count unavailable: ${key}`);
  }
  return record.count;
}

function requireRows(values: Record<string, unknown>, key: string): readonly unknown[] {
  const record = asRecord(values[key]);
  if (!record || !Array.isArray(record.data)) {
    throw new Error(`Dashboard rows unavailable: ${key}`);
  }
  return record.data;
}

export function buildAlerts(stats: DashboardStatsData): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  if (stats.pendingVerifications > 0) {
    alerts.push({
      id: 1,
      type: 'warning',
      title: `${stats.pendingVerifications} Guard${stats.pendingVerifications > 1 ? 's' : ''} Awaiting Verification`,
      message: 'Pending profile checks require admin review to unblock guard availability.',
      action: 'Review Now',
      href: '/admin/guard-verifications',
    });
  }
  if (stats.pendingSiaVerifications > 0) {
    alerts.push({
      id: 2,
      type: 'warning',
      title: `${stats.pendingSiaVerifications} SIA Licence${stats.pendingSiaVerifications > 1 ? 's' : ''} Pending`,
      message: 'SIA licence verifications need admin approval.',
      action: 'Verify',
      href: '/admin/sia-verifications',
    });
  }
  if (stats.openComplaints > 0) {
    alerts.push({
      id: 3,
      type: 'critical',
      title: `${stats.openComplaints} Open Complaint${stats.openComplaints > 1 ? 's' : ''}`,
      message: 'Unresolved complaints need admin attention.',
      action: 'Investigate',
      href: '/admin/complaints',
    });
  }
  if (stats.failedPayments > 0) {
    alerts.push({
      id: 4,
      type: 'critical',
      title: `${stats.failedPayments} Failed Payment${stats.failedPayments > 1 ? 's' : ''}`,
      message: 'Recent payment failures require review and retry.',
      action: 'Review',
      href: '/admin/failed-payments',
    });
  }
  if (stats.heldPayments > 0) {
    alerts.push({
      id: 5,
      type: 'warning',
      title: `${stats.heldPayments} Held Payout${stats.heldPayments > 1 ? 's' : ''}`,
      message: 'Guard payouts are on hold and need admin release.',
      action: 'Release',
      href: '/admin/held-payments',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: 1,
      type: 'info',
      title: 'All Systems Normal',
      message: 'No pending verifications, complaints, or payment issues. Dashboard is clear.',
      action: 'View Activity',
      href: '/admin/activity-log',
    });
  }
  return alerts;
}

export function buildDashboardSnapshot(settlements: readonly PromiseSettledResult<unknown>[]): DashboardSnapshot {
  const {values, failures} = settleDashboardQueries(settlements);
  if (failures.length > 0) return {available: false, failures};

  const totalJobs = requireCount(values, 'totalJobs');
  const activeJobs = requireCount(values, 'activeJobs');
  const newJobsThisMonth = requireCount(values, 'newJobsThisMonth');
  const pendingVerifications = requireCount(values, 'pendingVerifications');
  const pendingSiaVerifications = requireCount(values, 'pendingSiaVerifications');
  const openComplaints = requireCount(values, 'openComplaints');
  const failedPayments =
    requireCount(values, 'failedSubscriptionPayments') + requireCount(values, 'failedTransactions');
  const heldPayments = requireCount(values, 'heldPayouts');

  const monthlyRevenue =
    remainingRevenue(requireRows(values, 'monthlySubscriptionRevenue')) +
    remainingRevenue(requireRows(values, 'monthlyTransactionRevenue'));

  const prevNewJobs = requireCount(values, 'prevNewJobs');
  const prevMonthlyRevenue =
    remainingRevenue(requireRows(values, 'prevMonthlySubscriptionRevenue')) +
    remainingRevenue(requireRows(values, 'prevMonthlyTransactionRevenue'));

  const jobCreatedAtById = new Map<string, string>();
  requireRows(values, 'jobDates').forEach((job) => {
    const record = asRecord(job);
    if (!record) return;
    const id = typeof record.id === 'string' ? record.id : null;
    const createdAt = typeof record.created_at === 'string' ? record.created_at : null;
    if (id && createdAt) jobCreatedAtById.set(id, createdAt);
  });

  const avgMatchTimeMinutes = averageMatchMinutes(requireRows(values, 'monthlyMatchTimeAssignments'), jobCreatedAtById);
  const prevAvgMatchTimeMinutes = averageMatchMinutes(
    requireRows(values, 'prevMonthlyMatchTimeAssignments'),
    jobCreatedAtById
  );

  const stats: DashboardStatsData = {
    totalJobs,
    activeJobs,
    newJobsThisMonth,
    totalGuards: requireCount(values, 'totalGuards'),
    totalClients: requireCount(values, 'totalClients'),
    pendingVerifications,
    pendingSiaVerifications,
    openComplaints,
    failedPayments,
    heldPayments,
    monthlyRevenue,
    avgMatchTimeMinutes,
    activeSubscriptions: requireCount(values, 'activeSubscriptions'),
    trialAccounts: requireCount(values, 'trialAccounts'),
    incompleteProfiles: requireCount(values, 'incompleteProfiles'),
    openSupportTickets: requireCount(values, 'openSupportTickets'),
    newUsersThisMonth: requireCount(values, 'newGuardsThisMonth') + requireCount(values, 'newClientsThisMonth'),
  };

  const trends: DashboardTrends = {
    newJobsThisMonthTrend: calcTrend(newJobsThisMonth, prevNewJobs),
    monthlyRevenueTrend: calcTrend(monthlyRevenue, prevMonthlyRevenue),
    avgMatchTimeTrend:
      avgMatchTimeMinutes != null && prevAvgMatchTimeMinutes != null
        ? avgMatchTimeMinutes - prevAvgMatchTimeMinutes
        : null,
  };

  return {available: true, stats, trends, alerts: buildAlerts(stats)};
}

export function createUnavailableSnapshot(message: string): UnavailableDashboardSnapshot {
  return {available: false, failures: [failureFor('dashboard', message)]};
}