'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function FinancialOperationsPanel() {
  const [rows,setRows]=useState<any[]>([]), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);setError('');const result=await supabase.from('financial_operations').select('id,job_id,kind,state,result,created_at').in('state',['processing','reconciliation_required']).order('created_at',{ascending:false}).limit(100);if(result.error)setError('Financial operation review could not be loaded. Check that the backend repair is deployed.');else setRows(result.data || []);setLoading(false);};
  useEffect(()=>{void load();},[]);
  return <section className="mt-6 rounded-xl border border-[#1e2d4d] bg-[#111d35] p-5"><div className="flex justify-between gap-3"><h2 className="text-lg font-bold text-white">Financial operations needing review</h2><button onClick={()=>void load()} disabled={loading} className="text-teal-300">Refresh</button></div><p className="mt-2 text-sm text-slate-300">Processing or uncertain operations block another refund or payout for that booking. Verify Stripe and the shared audit before recovery.</p>{loading?<p className="mt-3 text-slate-300">Loading…</p>:error?<p role="alert" className="mt-3 text-rose-300">{error}</p>:rows.length===0?<p className="mt-3 text-slate-300">No operations currently require review.</p>:<ul className="mt-3 divide-y divide-[#1e2d4d]">{rows.map(r=><li key={r.id} className="py-3 text-sm text-slate-300"><strong className="text-white">{r.kind} · {r.state.replaceAll('_',' ')}</strong><p>Job {r.job_id} · {new Date(r.created_at).toLocaleString('en-GB')}</p><p>Operation {r.id}</p></li>)}</ul>}</section>;
}
