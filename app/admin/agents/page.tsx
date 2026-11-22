"use client";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import { CreditCard, ShieldCheck, Briefcase, Play, Loader2 } from "lucide-react";
import { parseAgentResult, type AgentKey, type AgentStatus, type AgentResult } from "@/lib/admin-agent-result";

type S = AgentStatus;

const AGENTS = [
 { key: "payments", label: "Payments", desc: "Charges, payouts and reconciliation", Icon: CreditCard },
 { key: "sia", label: "SIA Badges", desc: "Queue, expired and expiring licences", Icon: ShieldCheck },
 { key: "jobs", label: "Jobs", desc: "Adverts and stalled checkout", Icon: Briefcase },
] as const;
const DOT: Record<S, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", fail: "bg-red-500" };
const TXT: Record<S, string> = { ok: "text-emerald-400", warn: "text-amber-400", fail: "text-red-400" };
const WORD: Record<S, string> = { ok: "Healthy", warn: "Attention", fail: "Failed" };

export default function AgentsPage() {
 const [res, setRes] = useState<Partial<Record<AgentKey, AgentResult>>>({});
 const [run, setRun] = useState<Partial<Record<AgentKey, boolean>>>({});
 const [err, setErr] = useState<Partial<Record<AgentKey, string>>>({});
 const mounted = useRef(true);
 const lifetime = useRef(0);
 const inFlight = useRef<Partial<Record<AgentKey, boolean>>>({});
 useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; lifetime.current += 1; inFlight.current = {}; };
 }, []);

 async function runAgent(k: AgentKey) {
  if (!mounted.current || inFlight.current[k]) return;
  inFlight.current[k] = true;
  const generation = lifetime.current;
  const current = () => mounted.current && lifetime.current === generation;
  setRes((r) => ({ ...r, [k]: undefined }));
  setRun((r) => ({ ...r, [k]: true })); setErr((e) => ({ ...e, [k]: "" }));
  try {
   const { data, error } = await supabase.functions.invoke("agent-health-check", { body: { agent: k } });
   if (error) throw error;
   const result = parseAgentResult(data, k);
   if (current()) setRes((s) => ({ ...s, [k]: result }));
  } catch (error) {
   if (current()) setErr((x) => ({ ...x, [k]: error instanceof Error && error.message.trim() ? error.message : 'The agent check failed. Please retry.' }));
  } finally {
   if (current()) { inFlight.current[k] = false; setRun((r) => ({ ...r, [k]: false })); }
  }
 }

 return (
  <div className="min-h-screen bg-[#0B1933]">
    <div className="mx-auto max-w-5xl p-6">
   <h1 className="text-2xl font-semibold text-white">Agents</h1>
   <p className="mt-1 mb-6 text-sm text-slate-400">Read-only monitors. Data checks and worker heartbeats are reported separately.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {AGENTS.map((a) => {
     const r = res[a.key]; const isRun = run[a.key]; const e = err[a.key]; const Icon = a.Icon;
     return (
      <div key={a.key} className="flex flex-col rounded-xl border border-[#1a2b4a] bg-[#111d35] p-5">
       <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
         <div className="rounded-lg bg-[#1a2b4a] p-2"><Icon className="h-5 w-5 text-slate-400" /></div>
         <div><h2 className="font-semibold text-white">{a.label}</h2><p className="text-xs text-slate-400">{a.desc}</p></div>
        </div>
        <span className={`h-3 w-3 shrink-0 rounded-full ${isRun ? "animate-pulse bg-slate-500" : e ? DOT.fail : r ? DOT[r.status] : "bg-slate-600"}`} title={isRun ? "Checking" : e ? "Check failed" : r ? WORD[r.status] : "Not run yet"} />
       </div>
       <div className="mt-4 min-h-[44px] text-sm">
        {e ? <p role="alert" className="text-red-400">{e}</p> : r ? <p className={TXT[r.status]}><span className="font-medium">{WORD[r.status]}.</span> {r.summary}</p> : <p className="text-slate-500">{isRun ? "Checking current evidence…" : "Not run yet."}</p>}
       </div>
       {r && (
        <ul className="mt-1 space-y-2 border-t border-[#1a2b4a] pt-3">
         {r.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-xs">
           <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[c.status]}`} />
           <div><p className="font-medium text-slate-300">{c.label}</p><p className="text-slate-400">{c.detail}</p></div>
          </li>
         ))}
        </ul>
       )}
       <div className="mt-4 flex justify-end border-t border-[#1a2b4a] pt-3">
        <button onClick={() => runAgent(a.key)} disabled={isRun} aria-label={`${a.label}: ${e ? 'Retry check' : 'Run check'}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a2b4a] px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-50 cursor-pointer">
         {isRun ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {isRun ? "Running" : e ? "Retry" : "Run test"}
        </button>
       </div>
      </div>
     );
    })}
   </div>
   </div>
  </div>
 );
}
