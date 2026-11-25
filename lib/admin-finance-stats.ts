import { paymentAmounts } from './financeAmounts';

export interface FinanceFailure {
  key: string;
  label: string;
  message: string;
}

export interface FinancePayment {
  id: string;
  date: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  stripe_fee: number;
  net_amount: number;
  status: string;
  invoice_id: string;
  refunded: boolean;
  refund_amount: number;
  remaining_amount: number;
}

export interface FinanceCost {
  id: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  supplier: string;
  billing_date: string;
  notes: string;
}

export interface FinanceSubscription {
  id: string;
  status: string;
  plan_amount: number;
  stripe_price_id: string | null;
  billing_interval: string | null;
  created_at: string;
  cancelled_at: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  next_payment_date: string | null;
}

export interface FinancePlan {
  slug: string;
  name: string;
  monthly_price_pence: number;
  stripe_price_id: string;
}

export interface FinanceSnapshotRow {
  id: string;
  snapshot_month: string;
  gross_revenue: number;
  net_revenue: number;
  stripe_fees: number;
  running_costs: number;
  vat_estimate: number;
  estimated_profit: number;
  refunds: number;
  failed_payments: number;
  active_subscriptions: number;
  new_guards: number;
  new_clients: number;
  cancelled_accounts: number;
  trial_accounts: number;
  mrr: number;
  arr: number;
  arpu: number;
  churn_rate: number;
  failed_payment_rate: number;
  created_at: string;
}

export interface FinanceData {
  payments: FinancePayment[];
  costs: FinanceCost[];
  activeSubscriptionCount: number;
  subscriptions: FinanceSubscription[];
  plans: FinancePlan[];
  snapshots: FinanceSnapshotRow[];
  guardsThisMonth: number;
  guardsLastMonth: number;
  clientsThisMonth: number;
  clientsLastMonth: number;
  trialCount: number;
  cancelledCount: number;
}

export interface AvailableFinanceSnapshot {
  available: true;
  data: FinanceData;
}

export interface UnavailableFinanceSnapshot {
  available: false;
  failures: FinanceFailure[];
}

export type FinanceSnapshot = AvailableFinanceSnapshot | UnavailableFinanceSnapshot;

export interface FinanceQueryResult {
  key: string;
  settlement: PromiseSettledResult<unknown>;
}

export const FINANCE_LABELS: Readonly<Record<string, string>> = {
  subscriptionPayments: 'Subscription payments',
  transactions: 'Job and transaction payments',
  activeSubscriptions: 'Active subscriptions',
  subscriptions: 'Subscription records',
  plans: 'Plan pricing',
  platformCosts: 'Running costs',
  financeSnapshots: 'Monthly finance snapshots',
  guardsThisMonth: 'New guards this month',
  guardsLastMonth: 'New guards last month',
  clientsThisMonth: 'New clients this month',
  clientsLastMonth: 'New clients last month',
  trialSubscriptions: 'Trial accounts',
  cancelledSubscriptions: 'Cancelled subscriptions',
  paymentSubscriptions: 'Subscription owners',
  paymentClients: 'Payment customer records',
  paymentClientsByUser: 'Payment customer accounts',
  transactionClients: 'Transaction customer records',
};

export const FINANCE_COUNT_KEYS: readonly string[] = [
  'activeSubscriptions',
  'guardsThisMonth',
  'guardsLastMonth',
  'clientsThisMonth',
  'clientsLastMonth',
  'trialSubscriptions',
  'cancelledSubscriptions',
];

export const FINANCE_ROW_KEYS: readonly string[] = [
  'subscriptionPayments',
  'transactions',
  'subscriptions',
  'plans',
  'platformCosts',
  'financeSnapshots',
  'paymentSubscriptions',
  'paymentClients',
  'paymentClientsByUser',
  'transactionClients',
];

export const FINANCE_BASE_QUERY_KEYS: readonly string[] = [
  'subscriptionPayments',
  'transactions',
  'activeSubscriptions',
  'subscriptions',
  'plans',
  'platformCosts',
  'financeSnapshots',
  'guardsThisMonth',
  'guardsLastMonth',
  'clientsThisMonth',
  'clientsLastMonth',
  'trialSubscriptions',
  'cancelledSubscriptions',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function messageFromError(error: unknown): string {
  if (!error) return 'Request failed';
  if (typeof error === 'string') return error.trim() || 'Request failed';
  const record = asRecord(error);
  const message = record && typeof record.message === 'string' ? record.message.trim() : '';
  return message || 'Request failed';
}

function labelFor(key: string): string {
  return FINANCE_LABELS[key] || 'Finance data';
}

function failureFor(key: string, message: unknown): FinanceFailure {
  return { key, label: labelFor(key), message: messageFromError(message) };
}

function dedupeFailures(failures: readonly FinanceFailure[]): FinanceFailure[] {
  const seen = new Set<string>();
  const result: FinanceFailure[] = [];
  for (const failure of failures) {
    const signature = `${failure.key}:${failure.message}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(failure);
  }
  return result;
}

export function settleFinanceResults(results: readonly FinanceQueryResult[]): {
  values: Record<string, unknown>;
  failures: FinanceFailure[];
} {
  const values: Record<string, unknown> = {};
  const failures: FinanceFailure[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(results) || results.length === 0) {
    return { values, failures: [failureFor('querySet', 'Finance queries did not complete as expected')] };
  }

  results.forEach((entry) => {
    if (!entry || typeof entry.key !== 'string' || !entry.key) {
      failures.push(failureFor('querySet', 'A finance query was not identified'));
      return;
    }
    if (seen.has(entry.key)) return;
    seen.add(entry.key);

    if (entry.settlement.status === 'rejected') {
      failures.push(failureFor(entry.key, entry.settlement.reason));
      return;
    }
    if (entry.settlement.status !== 'fulfilled') {
      failures.push(failureFor(entry.key, 'Request failed'));
      return;
    }
    const record = asRecord(entry.settlement.value);
    if (!record) {
      failures.push(failureFor(entry.key, 'Empty response'));
      return;
    }
    if (record.error) {
      failures.push(failureFor(entry.key, record.error));
      return;
    }
    values[entry.key] = record;
  });

  FINANCE_COUNT_KEYS.forEach((key) => {
    if (!(key in values)) return;
    const record = asRecord(values[key]);
    if (!record || typeof record.count !== 'number' || !Number.isFinite(record.count)) {
      failures.push(failureFor(key, 'Count was not returned by the query'));
    }
  });

  FINANCE_ROW_KEYS.forEach((key) => {
    if (!(key in values)) return;
    const record = asRecord(values[key]);
    if (!record || !Array.isArray(record.data)) {
      failures.push(failureFor(key, 'Rows were not returned by the query'));
    }
  });

  return { values, failures };
}

export function estimateStripeFee(amount: number): number {
  return Math.max(amount * 0.015 + 0.2, 0.2);
}

export function financeRows(values: Record<string, unknown>, key: string): readonly unknown[] {
  const record = asRecord(values[key]);
  return record && Array.isArray(record.data) ? record.data : [];
}

export function uniqueRowIds(rows: readonly unknown[], fields: readonly string[]): string[] {
  const ids = new Set<string>();
  rows.forEach((row) => {
    const record = asRecord(row);
    if (!record) return;
    fields.forEach((field) => {
      const value = record[field];
      if (typeof value === 'string' && value.trim()) ids.add(value);
    });
  });
  return [...ids];
}

function requireRows(
  values: Record<string, unknown>,
  key: string,
  failures: FinanceFailure[]
): readonly unknown[] {
  const record = asRecord(values[key]);
  if (record && Array.isArray(record.data)) return record.data;
  failures.push(failureFor(key, 'Rows were not returned by the query'));
  return [];
}

function requireCount(values: Record<string, unknown>, key: string, failures: FinanceFailure[]): number {
  const record = asRecord(values[key]);
  if (record && typeof record.count === 'number' && Number.isFinite(record.count)) return record.count;
  failures.push(failureFor(key, 'Count was not returned by the query'));
  return 0;
}

interface CustomerRecord {
  company_name: string;
  email: string;
  contact_name: string;
}

interface SubscriptionOwner {
  client_id: string;
  plan_name: string;
}

function readCustomer(value: unknown, keyField: 'id' | 'user_id'): { id: string; customer: CustomerRecord } | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asText(record[keyField]);
  if (!id) return null;
  return {
    id,
    customer: {
      company_name: asText(record.company_name),
      email: asText(record.email, '-'),
      contact_name: asText(record.contact_name),
    },
  };
}

export function buildFinanceSnapshot(
  base: Record<string, unknown>,
  enrichment: Record<string, unknown>
): FinanceSnapshot {
  const failures: FinanceFailure[] = [];

  const subscriptionPaymentRows = requireRows(base, 'subscriptionPayments', failures);
  const transactionRows = requireRows(base, 'transactions', failures);
  const subscriptionRows = requireRows(base, 'subscriptions', failures);
  const planRows = requireRows(base, 'plans', failures);
  const costRows = requireRows(base, 'platformCosts', failures);
  const snapshotRows = requireRows(base, 'financeSnapshots', failures);
  const ownerRows = requireRows(enrichment, 'paymentSubscriptions', failures);
  const clientRows = requireRows(enrichment, 'paymentClients', failures);
  const clientByUserRows = requireRows(enrichment, 'paymentClientsByUser', failures);
  const transactionClientRows = requireRows(enrichment, 'transactionClients', failures);

  const activeSubscriptionCount = requireCount(base, 'activeSubscriptions', failures);
  const guardsThisMonth = requireCount(base, 'guardsThisMonth', failures);
  const guardsLastMonth = requireCount(base, 'guardsLastMonth', failures);
  const clientsThisMonth = requireCount(base, 'clientsThisMonth', failures);
  const clientsLastMonth = requireCount(base, 'clientsLastMonth', failures);
  const trialCount = requireCount(base, 'trialSubscriptions', failures);
  const cancelledCount = requireCount(base, 'cancelledSubscriptions', failures);

  if (failures.length > 0) {
    return { available: false, failures: dedupeFailures(failures) };
  }

  const clientsById = new Map<string, CustomerRecord>();
  const clientsByUser = new Map<string, CustomerRecord>();
  clientRows.forEach((row) => {
    const parsed = readCustomer(row, 'id');
    if (parsed) clientsById.set(parsed.id, parsed.customer);
  });
  clientByUserRows.forEach((row) => {
    const parsed = readCustomer(row, 'user_id');
    if (parsed) clientsByUser.set(parsed.id, parsed.customer);
  });
  transactionClientRows.forEach((row) => {
    const parsed = readCustomer(row, 'id');
    if (parsed) clientsById.set(parsed.id, parsed.customer);
  });

  const ownersById = new Map<string, SubscriptionOwner>();
  ownerRows.forEach((row) => {
    const record = asRecord(row);
    if (!record) return;
    const id = asText(record.id);
    if (!id) return;
    ownersById.set(id, {
      client_id: asText(record.client_id),
      plan_name: asText(record.plan_name),
    });
  });

  const subscriptionPayments: FinancePayment[] = subscriptionPaymentRows.map((row) => {
    const record = asRecord(row) ?? {};
    const owner = asText(record.subscription_id) ? ownersById.get(asText(record.subscription_id)) : undefined;
    const client =
      (owner && owner.client_id ? clientsById.get(owner.client_id) : undefined) ??
      clientsByUser.get(asText(record.user_id));
    const amount = asNumber(record.amount);
    const fee = estimateStripeFee(amount);
    const amounts = paymentAmounts(
      {
        amount,
        status: asText(record.status),
        refund_amount: record.refund_amount,
        refunded: record.refunded === true,
      },
      fee
    );
    return {
      id: asText(record.id),
      date: asText(record.created_at),
      customer: client?.company_name || client?.contact_name || 'Unknown',
      email: client?.email || '-',
      plan: owner?.plan_name || 'Subscription',
      amount,
      stripe_fee: fee,
      net_amount: amounts.net,
      refund_amount: amounts.refunded,
      remaining_amount: amounts.remaining,
      status: asText(record.status),
      invoice_id: asText(record.stripe_invoice_id),
      refunded: record.refunded === true,
    };
  });

  const transactionPayments: FinancePayment[] = transactionRows.map((row) => {
    const record = asRecord(row) ?? {};
    const client = clientsById.get(asText(record.client_id));
    const amount = asNumber(record.amount);
    const fee = estimateStripeFee(amount);
    const amounts = paymentAmounts(
      {
        amount,
        status: asText(record.status),
        refund_amount: record.refund_amount,
        refunded: record.refunded === true,
      },
      fee
    );
    return {
      id: asText(record.id),
      date: asText(record.created_at),
      customer: client?.company_name || client?.contact_name || 'Unknown',
      email: client?.email || '-',
      plan: asText(record.transaction_type, 'Job Payment'),
      amount,
      stripe_fee: fee,
      net_amount: amounts.net,
      refund_amount: amounts.refunded,
      remaining_amount: amounts.remaining,
      status: asText(record.status),
      invoice_id: asText(record.stripe_invoice_id),
      refunded: record.refunded === true,
    };
  });

  const payments = [...subscriptionPayments, ...transactionPayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const costs: FinanceCost[] = costRows.map((row) => {
    const record = asRecord(row) ?? {};
    return {
      id: asText(record.id),
      service_name: asText(record.service_name),
      category: asText(record.category),
      monthly_cost: asNumber(record.monthly_cost),
      supplier: asText(record.supplier),
      billing_date: asText(record.billing_date),
      notes: asText(record.notes),
    };
  });

  const subscriptions: FinanceSubscription[] = subscriptionRows.map((row) => {
    const record = asRecord(row) ?? {};
    return {
      id: asText(record.id),
      status: asText(record.status),
      plan_amount: asNumber(record.plan_amount),
      stripe_price_id: asText(record.stripe_price_id) || null,
      billing_interval: asText(record.billing_interval) || null,
      created_at: asText(record.created_at),
      cancelled_at: asText(record.cancelled_at) || null,
      trial_end_date: asText(record.trial_end_date) || null,
      current_period_end: asText(record.current_period_end) || null,
      next_payment_date: asText(record.next_payment_date) || null,
    };
  });

  const plans: FinancePlan[] = planRows.map((row) => {
    const record = asRecord(row) ?? {};
    return {
      slug: asText(record.slug),
      name: asText(record.name),
      monthly_price_pence: asNumber(record.monthly_price_pence),
      stripe_price_id: asText(record.stripe_price_id),
    };
  });

  const snapshots: FinanceSnapshotRow[] = snapshotRows.map((row) => {
    const record = asRecord(row) ?? {};
    return {
      id: asText(record.id),
      snapshot_month: asText(record.snapshot_month),
      gross_revenue: asNumber(record.gross_revenue),
      net_revenue: asNumber(record.net_revenue),
      stripe_fees: asNumber(record.stripe_fees),
      running_costs: asNumber(record.running_costs),
      vat_estimate: asNumber(record.vat_estimate),
      estimated_profit: asNumber(record.estimated_profit),
      refunds: asNumber(record.refunds),
      failed_payments: asNumber(record.failed_payments),
      active_subscriptions: asNumber(record.active_subscriptions),
      new_guards: asNumber(record.new_guards),
      new_clients: asNumber(record.new_clients),
      cancelled_accounts: asNumber(record.cancelled_accounts),
      trial_accounts: asNumber(record.trial_accounts),
      mrr: asNumber(record.mrr),
      arr: asNumber(record.arr),
      arpu: asNumber(record.arpu),
      churn_rate: asNumber(record.churn_rate),
      failed_payment_rate: asNumber(record.failed_payment_rate),
      created_at: asText(record.created_at),
    };
  });

  return {
    available: true,
    data: {
      payments,
      costs,
      activeSubscriptionCount,
      subscriptions,
      plans,
      snapshots,
      guardsThisMonth,
      guardsLastMonth,
      clientsThisMonth,
      clientsLastMonth,
      trialCount,
      cancelledCount,
    },
  };
}

export function createUnavailableFinanceSnapshot(message: string): UnavailableFinanceSnapshot {
  return { available: false, failures: [failureFor('finance', message)] };
}