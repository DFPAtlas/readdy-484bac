import {paymentTotals, isCollected, type FinancialPayment} from '../../../lib/financeAmounts.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface SnapshotMetrics {
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
  payment_success_rate: number;
}

function getMonthRange(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function getSnapshotMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await page(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('Snapshot source could not be read');
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

interface SnapshotReference { id: string; snapshot_month: string; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validReference(row: SnapshotReference | null, month: string): row is SnapshotReference {
  return row != null && uuid.test(row.id) && row.snapshot_month === month;
}

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, Allow: 'POST, OPTIONS' } });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: {schema:'app'},
  });

  // Scheduled calls use service-role auth; manual generation requires finance MFA.
  try {
  const authorization=req.headers.get('Authorization');
  if (authorization !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    const token=authorization?.replace(/^Bearer /,'');
    if (!token) return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:corsHeaders});
    const {data:{user},error}=await supabase.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:corsHeaders});
    const {data:admin,error:adminError}=await supabase.from('admin_users').select('role,is_active').eq('user_id',user.id).maybeSingle();
    if (adminError) return new Response(JSON.stringify({error:'Administrator access could not be verified'}),{status:503,headers:corsHeaders});
    let aal=null;try{const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');aal=JSON.parse(atob(p+'='.repeat((4-p.length%4)%4))).aal;}catch{}
    if (!admin?.is_active || !['super_admin','finance_admin'].includes(admin.role) || aal!=='aal2') return new Response(JSON.stringify({error:'Finance admin MFA required'}),{status:403,headers:corsHeaders});
  }
  } catch {
    return new Response(JSON.stringify({error:'Administrator access could not be verified'}),{status:503,headers:corsHeaders});
  }
  try {
    const now = new Date();
    const targetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const { start, end } = getMonthRange(targetMonth);
    const snapshotMonth = getSnapshotMonth(targetMonth);

    const { data: existing, error: existingError } = await supabase
      .from('finance_snapshots')
      .select('id,snapshot_month')
      .eq('snapshot_month', snapshotMonth)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      if (!validReference(existing, snapshotMonth)) throw new Error('Saved snapshot could not be confirmed');
      return new Response(
        JSON.stringify({ status: 'already_exists', snapshot_month: snapshotMonth, snapshot_id: existing.id,
          message: `Snapshot already exists for ${snapshotMonth}`, skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const monthStart = new Date(start);
    const prevMonthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));

    const payments: FinancialPayment[]=[];
    for (const table of ['subscription_payments','transactions']) {
      for(let offset=0;;offset+=500){
        let query=supabase.from(table).select('id,amount,status,refunded,refund_amount').gte('created_at',start).lt('created_at',end).order('id');
        if(table==='transactions')query=query.or('transaction_type.neq.subscription,transaction_type.is.null');
        const {data,error}=await query.range(offset,offset+499);
        if(error || !Array.isArray(data))throw new Error('Snapshot payments could not be read');
        payments.push(...data);
        if(data.length<500)break;
      }
    }
    const totals=paymentTotals(payments);
    const grossRevenue=totals.collected;
    const refunds=totals.refunded;
    const failedPayments=payments.filter(p=>p.status==='failed').length;
    const totalPayments=payments.length;
    const failedPaymentRate=totalPayments>0?failedPayments/totalPayments:0;
    const paymentSuccessRate=totalPayments>0?payments.filter(p=>isCollected(p.status)).length/totalPayments:0;
    const runningCostsData = await readAll<{ id: string; monthly_cost: number | string | null }>((from,to) => supabase
      .from('platform_costs')
      .select('id,monthly_cost').order('id').range(from,to));
    const runningCosts = (runningCostsData || []).reduce((sum, c) => sum + (Number(c.monthly_cost) || 0), 0);

    const successfulPaymentsCount=payments.filter(p=>isCollected(p.status)).length;
    const stripeFees=Math.round((grossRevenue*0.015+successfulPaymentsCount*0.20)*100)/100;
    const netRevenue=Math.round((grossRevenue-refunds-stripeFees)*100)/100;
    const vatEstimate = Math.max(0, netRevenue) * 0.20;
    const payouts=await readAll<{ id: string; net_amount: number | string | null; status: string }>((from,to) => supabase.from('guard_payouts').select('id,net_amount,status').gte('created_at',start).lt('created_at',end).order('id').range(from,to));
    const guardFunds=(payouts || []).filter(p=>!['failed','cancelled'].includes(p.status)).reduce((sum,p)=>sum+Number(p.net_amount || 0),0);
    const estimatedProfit = netRevenue - guardFunds - runningCosts - vatEstimate;

    const activeSubs = await readAll<{ id: string; plan_amount: number | string | null; billing_interval: string | null }>((from,to) => supabase
      .from('subscriptions')
      .select('id, plan_amount, billing_interval')
      .eq('status', 'active')
      .lt('created_at', end).order('id').range(from,to));
    const activeSubscriptions = (activeSubs || []).length;

    const mrr = (activeSubs || []).reduce((sum, s) => {
      const amount = Number(s.plan_amount) || 0;
      const interval = s.billing_interval || 'month';
      if (interval === 'year') return sum + (amount / 12 / 100);
      if (interval === 'week') return sum + (amount * 4.33 / 100);
      if (interval === 'day') return sum + (amount * 30 / 100);
      return sum + (amount / 100);
    }, 0);

    const arr = mrr * 12;
    const arpu = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;

    const cancelledData = await readAll<{ id: string }>((from,to) => supabase
      .from('subscriptions')
      .select('id')
      .gte('cancelled_at', start)
      .lt('cancelled_at', end).order('id').range(from,to));
    const cancelledAccounts = (cancelledData || []).length;

    const prevActiveSubs = await readAll<{ id: string }>((from,to) => supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active')
      .lt('created_at', prevMonthEnd.toISOString()).order('id').range(from,to));
    const prevActiveCount = (prevActiveSubs || []).length;
    const churnRate = prevActiveCount > 0 ? cancelledAccounts / prevActiveCount : 0;

    const trialData = await readAll<{ id: string }>((from,to) => supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'trialing')
      .lt('created_at', end).order('id').range(from,to));
    const trialAccounts = (trialData || []).length;

    const newGuards = await readAll<{ id: string }>((from,to) => supabase
      .from('guards')
      .select('id')
      .gte('created_at', start)
      .lt('created_at', end).order('id').range(from,to));
    const newGuardsCount = (newGuards || []).length;

    const newClients = await readAll<{ id: string }>((from,to) => supabase
      .from('clients')
      .select('id')
      .gte('created_at', start)
      .lt('created_at', end).order('id').range(from,to));
    const newClientsCount = (newClients || []).length;

    const snapshot: SnapshotMetrics = {
      snapshot_month: snapshotMonth,
      gross_revenue: Math.round(grossRevenue * 100) / 100,
      net_revenue: Math.round(netRevenue * 100) / 100,
      stripe_fees: Math.round(stripeFees * 100) / 100,
      running_costs: Math.round(runningCosts * 100) / 100,
      vat_estimate: Math.round(vatEstimate * 100) / 100,
      estimated_profit: Math.round(estimatedProfit * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      failed_payments: failedPayments,
      active_subscriptions: activeSubscriptions,
      new_guards: newGuardsCount,
      new_clients: newClientsCount,
      cancelled_accounts: cancelledAccounts,
      trial_accounts: trialAccounts,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      arpu: Math.round(arpu * 100) / 100,
      churn_rate: Math.round(churnRate * 10000) / 10000,
      failed_payment_rate: Math.round(failedPaymentRate * 10000) / 10000,
      payment_success_rate: Math.round(paymentSuccessRate * 10000) / 10000,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('finance_snapshots')
      .insert(snapshot)
      .select()
      .single();

    if (insertError?.code === '23505') {
      const { data: saved, error: savedError } = await supabase.from('finance_snapshots')
        .select('id,snapshot_month').eq('snapshot_month',snapshotMonth).maybeSingle();
      if (savedError || !validReference(saved,snapshotMonth)) throw new Error('Concurrent snapshot outcome could not be confirmed');
      return new Response(JSON.stringify({status:'already_exists',snapshot_month:snapshotMonth,snapshot_id:saved.id,
        message:`Snapshot already exists for ${snapshotMonth}`,skipped:true}),{status:200,headers:corsHeaders});
    }
    if (insertError || !validReference(inserted,snapshotMonth)) throw new Error('Saved snapshot could not be confirmed');

    return new Response(
      JSON.stringify({
        status: 'created', snapshot_month: snapshotMonth, snapshot_id: inserted.id,
        message: `Snapshot created for ${snapshotMonth}`,
        snapshot: inserted,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    console.error('Monthly finance snapshot could not be confirmed');
    return new Response(
      JSON.stringify({ error: 'Monthly finance snapshot could not be confirmed. Check saved history before retrying.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

Deno.serve(handler);
