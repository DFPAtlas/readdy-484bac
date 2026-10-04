'use client';

import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';

type BankPayout={id:string;stripe_payout_id:string;amount_minor:number;currency:string;status:string;arrival_date:string|null;bank_last4:string|null;failure_message:string|null;failure_code:string|null;livemode:boolean;stripe_created_at:string};
const labels:Record<string,string>={pending:'Pending',in_transit:'On its way',paid:'Paid to bank',failed:'Failed',canceled:'Canceled'};
function money(p:BankPayout){
  const formatter=new Intl.NumberFormat('en-GB',{style:'currency',currency:p.currency.toUpperCase()});
  // Stripe retains two-decimal API amounts for ISK/UGX compatibility.
  const digits=['isk','ugx'].includes(p.currency)?2:(formatter.resolvedOptions().maximumFractionDigits??2);
  return formatter.format(Number(p.amount_minor)/10**digits);
}
export default function BankPayoutTracker({guardId}:{guardId:string}){
  const [rows,setRows]=useState<BankPayout[]>([]);
  const [error,setError]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [partialHistory,setPartialHistory]=useState(false);
  const load=useCallback(async()=>{
    const result=await supabase.from('guard_bank_payouts').select('id,stripe_payout_id,amount_minor,currency,status,arrival_date,bank_last4,failure_message,failure_code,livemode,stripe_created_at').eq('guard_id',guardId).order('stripe_created_at',{ascending:false}).limit(50);
    if(result.error){setError('Bank payout records could not be loaded.');return;}
    setRows(result.data||[]);
  },[guardId]);
  const refresh=useCallback(async()=>{
    setRefreshing(true);setError('');
    try{
      const {data,error:syncError}=await supabase.functions.invoke('sync-guard-bank-payouts',{body:{}});
      if(syncError||data?.error)setError('Stripe refresh failed. Previously recorded bank statuses are shown below.');
      setPartialHistory(Boolean(data?.olderHistoryRemaining));
      await load();
    }catch{setError('Bank payout refresh failed. Please try again.');}
    finally{setRefreshing(false);}
  },[load]);
  useEffect(()=>{
    void refresh();
    // The webhook updates the ledger without requiring this page to stay open.
    const timer=setInterval(()=>{void load();},30000);
    return()=>clearInterval(timer);
  },[refresh,load]);
  return <section aria-label="Bank payouts" className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-6 mb-6">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bank payouts</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track deposits from your Stripe balance to your bank. A deposit may include earnings from several jobs.</p></div>
      <button onClick={()=>void refresh()} disabled={refreshing} className="text-sm font-medium text-teal-600 dark:text-teal-400 disabled:opacity-50">{refreshing?'Refreshing…':'Refresh'}</button>
    </div>
    {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
    {partialHistory&&<p className="text-sm text-slate-500 mt-3">Your most recent deposits have been refreshed. Contact support for older payout history.</p>}
    {!rows.length?<p className="text-sm text-slate-500 dark:text-slate-400 mt-4">{refreshing?'Loading bank payouts…':'No bank payouts have been recorded yet.'}</p>:<div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left">
      <thead className="text-slate-500 dark:text-slate-400"><tr><th className="py-2">Amount</th><th>Bank</th><th>Status</th><th>Expected arrival</th></tr></thead>
      <tbody>{rows.map(p=><tr key={p.id} className="border-t border-slate-200 dark:border-[#1e2d4d] text-slate-800 dark:text-slate-200">
        <td className="py-3 pr-3 font-medium">{money(p)}{!p.livemode&&<span className="ml-2 text-xs text-slate-500">Test</span>}</td>
        <td className="pr-3">{p.bank_last4?`Ending ${p.bank_last4}`:'Bank account'}</td>
        <td className="pr-3"><span className={p.status==='failed'?'text-red-600 dark:text-red-400':p.status==='paid'?'text-emerald-600 dark:text-emerald-400':''}>{labels[p.status]||p.status}</span>{p.status==='failed'&&<p className="text-xs mt-1 max-w-md">{p.failure_message||'Stripe could not complete this deposit. Check your bank settings or contact support.'}</p>}</td>
        <td>{p.arrival_date?new Date(p.arrival_date).toLocaleDateString('en-GB'):'Unavailable'}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
