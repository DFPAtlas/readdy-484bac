'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function CloseAccountSection() {
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<any>(null);
 async function close() {
  if (confirmation!=='CLOSE ACCOUNT') return;
  setBusy(true);setError('');
  try {
   const {data:{session}}=await supabase.auth.getSession();
   if(!session) throw new Error('Please sign in again.');
   const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/account-closure`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'close',confirmation})});
   const data=await response.json();
   if(!response.ok || data.success!==true) throw new Error(data.error || 'Account closure failed.');
   setResult(data);await supabase.auth.signOut();
  }catch(e:any){setError(e.message || 'Account closure failed.');}finally{setBusy(false);}
 }
 return <section className="rounded-xl border border-red-400/30 p-5 mt-6">
  <h3 className="font-semibold text-red-500">Close your account</h3>
  {result ? <div role="status"><p>Your account is closed and access is disabled.</p><p className="text-sm mt-2">Account profile cleanup is scheduled for {new Date(result.profile_purge_at).toLocaleDateString('en-GB')}; verification documents for {new Date(result.documents_purge_at).toLocaleDateString('en-GB')}. Records needed for financial or legal purposes are handled separately.</p></div> : <>
   <p className="text-sm text-slate-500 mt-2">Complete or cancel bookings, resolve outstanding payments and disputes, and finish cancelling any paid subscription first. Closure disables access. Our policy schedules profile cleanup after two years and verification documents after three years, unless a documented legal hold applies. You can still request earlier erasure by email.</p>
   <label className="block text-sm mt-3">Type CLOSE ACCOUNT to confirm<input aria-label="Account closure confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} className="block w-full border rounded-lg p-2 mt-1 bg-transparent" disabled={busy}/></label>
   <button type="button" onClick={close} disabled={busy || confirmation!=='CLOSE ACCOUNT'} className="mt-3 rounded-lg bg-red-600 text-white px-4 py-2 disabled:opacity-50">{busy?'Closing…':'Close account'}</button>
   {error && <p role="alert" className="text-sm text-red-500 mt-2">{error}</p>}
  </>}
 </section>;
}
