"use client";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { CreditCard, ShieldCheck, Briefcase, Play, Loader2 } from "lucide-react";

type S = "ok" | "warn" | "fail";
interface Check { key: string; label: string; status: S; detail: string; }
interface Result { agent: string; label: string; status: S; summary: string; checks: Check[]; }

const AGENTS = [
 { key: "payments", label: "Payments", desc: "Webhooks, failed charges, payouts, subs", Icon: CreditCard },
 { key: "sia", label: "SIA Badges", desc: "Backlog, expired & expiring licences", Icon: ShieldCheck },
 { key: "jobs", label: "Jobs", desc: "Expiry, stuck payments, matching", Icon: Briefcase },
];
const DOT: Record<S, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", fail: "bg-red-500" };
const TXT: Record<S, string> = { ok: "text-emerald-700", warn: "text-amber-700", fail: "text-red-700" };
const WORD: Record<S, string> = { ok: "Healthy", warn: "Attention", fail: "Failed" };

export default function AgentsPage() {
 const [res, setRes] = useState<Record<string, Result>>({});
 const [run, setRun] = useState<Record<string, boolean>>({});
 const [err, setErr] = useState<Record<string, string>>({});

 async function runAgent(k: string) {
  setRun((r) => ({ ...r, [k]: true })); setErr((e) => ({ ...e, [k]: "" }));
  try {
   const { data, error } = await supabase.functions.invoke("agent-health-check", { body: { agent: k } });
   if (error) throw error;
   if (data?.error) throw new Error(data.error);
   const r: Result | undefined = data?.results?.[0];
   if (!r) throw new Error("No result returned.");
   setRes((s) => ({ ...s, [k]: r }));
  } catch (e) { setErr((x) => ({ ...x, [k]: (e as Error).message })); }
  finally { setRun((r) => ({ ...r, [k]: false })); }
 }

 return (
  <div className="min-h-screen bg-[#0B1933]">
    <div className="mx-auto max-w-5xl p-6">
   <h1 className="text-2xl font-semibold text-white">Agents</h1>
   <p className="mt-1 mb-6 text-sm text-slate-400">Live monitors. Green is OK, amber needs attention, red is a failure.</p>
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
        <span className={`h-3 w-3 shrink-0 rounded-full ${isRun ? "animate-pulse bg-slate-500" : r ? DOT[r.status] : "bg-slate-600"}`} title={r ? WORD[r.status] : "Not run yet"} />
       </div>
       <div className="mt-4 min-h-[44px] text-sm">
        {e ? <p className="text-red-400">{e}</p> : r ? <p className={TXT[r.status]}><span className="font-medium">{WORD[r.status]}.</span> {r.summary}</p> : <p className="text-slate-500">Not run yet.</p>}
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
        <button onClick={() => runAgent(a.key)} disabled={isRun} className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a2b4a] px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-50 cursor-pointer">
         {isRun ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {isRun ? "Running" : "Run test"}
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