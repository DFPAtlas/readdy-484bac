import { useState, useMemo } from 'react';
import { ApiSecretStatus } from './SecuritySOCClient';

interface TableRow {
  name: string;
  rls: boolean;
  policies: number;
  indexes: number;
  publicAccess: boolean;
  status: 'healthy' | 'warning' | 'critical';
}

interface BucketRow {
  id: string;
  name: string;
  public: boolean;
}

interface EdgeFunctionInfo {
  name: string;
  slug: string;
  version: number;
  status: string;
  verify_jwt: boolean;
  created_at: string;
  updated_at: string;
  source?: string;
}

function StatusDot({ status }: { status: string }) {
  if (status === 'healthy') return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>;
  if (status === 'warning') return <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>;
  return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse"></span>;
}

function getTableStatus(rls: boolean, policies: number, indexes: number): 'healthy' | 'warning' | 'critical' {
  if (!rls) return 'critical';
  if (policies === 0) return 'critical';
  if (indexes <= 1) return 'warning';
  if (policies === 1) return 'warning';
  return 'healthy';
}

function getFunctionStatus(fn: EdgeFunctionInfo): 'healthy' | 'warning' | 'critical' {
  if (fn.status !== 'ACTIVE') return 'warning';
  if (!fn.verify_jwt) return 'warning';
  return 'healthy';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return mins <= 1 ? 'Just now' : `${mins}m ago`;
}

interface Props {
  infrastructure: {
    tables?: { schema_name: string; table_name: string; rls_enabled: boolean; public_access: boolean }[];
    policies?: { schema_name: string; table_name: string; policy_count: number }[];
    indexes?: { schema_name: string; table_name: string; index_count: number }[];
    buckets?: BucketRow[];
  } | null;
  edgeFunctions: EdgeFunctionInfo[];
  edgeFunctionsError: string | null;
  apiSecrets: ApiSecretStatus[];
}

export default function InfrastructureSecurityPanel({ infrastructure, edgeFunctions, edgeFunctionsError, apiSecrets }: Props) {
  const [activeTab, setActiveTab] = useState<'database' | 'storage' | 'functions' | 'secrets'>('database');

  const tables: TableRow[] = useMemo(() => {
    if (!infrastructure?.tables) return [];

    const policyMap = new Map<string, number>();
    (infrastructure.policies || []).forEach((p: any) => {
      policyMap.set(`${p.schema_name}.${p.table_name}`, Number(p.policy_count));
    });

    const indexMap = new Map<string, number>();
    (infrastructure.indexes || []).forEach((i: any) => {
      indexMap.set(`${i.schema_name}.${i.table_name}`, Number(i.index_count));
    });

    const rows = infrastructure.tables
      .filter((t: any) => t.schema_name === 'app')
      .map((t: any) => {
        const key = `${t.schema_name}.${t.table_name}`;
        const policies = policyMap.get(key) || 0;
        const indexes = indexMap.get(key) || 0;
        return {
          name: t.table_name,
          rls: t.rls_enabled,
          policies,
          indexes,
          publicAccess: t.public_access,
          status: getTableStatus(t.rls_enabled, policies, indexes),
        };
      })
      .sort((a, b) => {
        const severityA = a.status === 'critical' ? 0 : a.status === 'warning' ? 1 : 2;
        const severityB = b.status === 'critical' ? 0 : b.status === 'warning' ? 1 : 2;
        return severityA - severityB || a.name.localeCompare(b.name);
      });

    return rows;
  }, [infrastructure]);

  const buckets: BucketRow[] = infrastructure?.buckets || [];
  const isLoading = !infrastructure;
  const funcWarnings = edgeFunctions.filter(f => !f.verify_jwt || f.status !== 'ACTIVE').length;
  const hasLiveFunctions = edgeFunctions.length > 0;
  const hasLiveSecrets = apiSecrets.length > 0;

  const jwtProtected = edgeFunctions.filter(f => f.verify_jwt).length;
  const jwtPct = hasLiveFunctions ? Math.round((jwtProtected / edgeFunctions.length) * 100) : 0;

  const secretChecks = hasLiveSecrets ? apiSecrets : [
    { service: 'Supabase', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'Stripe', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'SMTP (Resend)', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'Google Maps', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'OpenAI', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'Google Gemini', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
    { service: 'reCAPTCHA', configured: false, status: 'warning' as const, last_checked: new Date().toISOString() },
  ];

  const secretMissingCount = hasLiveSecrets ? apiSecrets.filter(s => !s.configured).length : secretChecks.filter(s => !s.configured).length;

  const tabs = [
    { key: 'database' as const, label: 'Database', icon: 'ri-database-2-line', count: tables.filter(t => t.status === 'critical' || t.status === 'warning').length },
    { key: 'storage' as const, label: 'Storage', icon: 'ri-hard-drive-2-line', count: buckets.filter(b => b.public).length },
    { key: 'functions' as const, label: 'Edge Functions', icon: 'ri-function-line', count: hasLiveFunctions ? funcWarnings : 2 },
    { key: 'secrets' as const, label: 'API Config', icon: 'ri-key-2-line', count: secretMissingCount },
  ];

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a2b4a] flex items-center gap-1">
        <div className="w-7 h-7 flex items-center justify-center bg-teal-500/10 rounded-lg mr-2">
          <i className="ri-server-line text-teal-400 text-sm"></i>
        </div>
        <h2 className="text-base font-semibold text-white mr-4">Infrastructure Security</h2>
        <div className="flex items-center gap-1 bg-[#0a1628] rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.key ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <i className={`${tab.icon} text-xs`}></i>
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.count > 2 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mb-3"></div>
            <p className="text-sm">Loading infrastructure audit...</p>
          </div>
        )}

        {activeTab === 'database' && !isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2b4a]">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Table</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">RLS</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Policies</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Indexes</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Public</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2b4a]/50">
                {tables.map((t) => (
                  <tr key={t.name} className={`hover:bg-[#0a1628] transition-colors ${t.status === 'critical' ? 'bg-red-500/5' : t.status === 'warning' ? 'bg-amber-500/5' : ''}`}>
                    <td className="py-2 px-3">
                      <span className="text-xs font-medium text-slate-200 font-mono">{t.name}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.rls ? <i className="ri-checkbox-circle-fill text-emerald-400 text-sm"></i> : <i className="ri-close-circle-fill text-red-400 text-sm"></i>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs font-medium ${t.policies === 0 ? 'text-red-400' : t.policies === 1 ? 'text-amber-400' : 'text-slate-300'}`}>{t.policies}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs font-medium ${t.indexes <= 1 ? 'text-amber-400' : 'text-slate-300'}`}>{t.indexes}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.publicAccess ? <i className="ri-global-line text-red-400 text-sm"></i> : <i className="ri-lock-line text-emerald-400 text-sm"></i>}
                    </td>
                    <td className="py-2 px-3 text-center"><StatusDot status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tables.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">No tables found in app schema</div>
            )}
          </div>
        )}

        {activeTab === 'storage' && !isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2b4a]">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Bucket</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Visibility</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">ID</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2b4a]/50">
                {buckets.map((b) => (
                  <tr key={b.id} className="hover:bg-[#0a1628] transition-colors">
                    <td className="py-2 px-3">
                      <span className="text-xs font-medium text-slate-200 font-mono">{b.name}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.public ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {b.public ? 'Public' : 'Private'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-xs text-slate-500 font-mono">{b.id}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <StatusDot status={b.public ? 'warning' : 'healthy'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {buckets.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">No storage buckets found</div>
            )}
          </div>
        )}

        {activeTab === 'functions' && !isLoading && (
          <div className="overflow-x-auto">
            {!hasLiveFunctions && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
                <i className="ri-information-line text-amber-400"></i>
                <p className="text-xs text-amber-300">
                  {edgeFunctionsError || 'Edge function data unavailable.'}
                </p>
              </div>
            )}

            {hasLiveFunctions && (
              <div className="mb-3 flex items-center justify-between bg-[#0a1628] border border-[#1a2b4a] rounded-lg px-4 py-2.5">
                <p className="text-xs text-slate-300">
                  <span className="font-semibold text-emerald-400">{jwtProtected}</span> of <span className="font-semibold text-slate-200">{edgeFunctions.length}</span> functions JWT-protected
                  <span className="text-slate-500 ml-1">(public webhooks use signature verification)</span>
                </p>
                <span className={`text-sm font-bold ${jwtPct >= 90 ? 'text-emerald-400' : jwtPct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{jwtPct}%</span>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2b4a]">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Function</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">JWT</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Version</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Deployed</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2b4a]/50">
                {hasLiveFunctions ? (
                  edgeFunctions.map((f) => {
                    const status = getFunctionStatus(f);
                    return (
                      <tr key={f.slug} className={`hover:bg-[#0a1628] transition-colors ${status === 'warning' ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-2 px-3">
                          <span className="text-xs font-medium text-slate-200 font-mono">{f.slug}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {f.verify_jwt ? <i className="ri-shield-check-fill text-emerald-400 text-sm"></i> : <i className="ri-shield-line text-amber-400 text-sm"></i>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs text-slate-400 font-mono">v{f.version}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs text-slate-500">{timeAgo(f.updated_at)}</span>
                        </td>
                        <td className="py-2 px-3 text-center"><StatusDot status={status} /></td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                      No live function data available — connect Management API token to see real-time function status
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'secrets' && !isLoading && (
          <div>
            {!hasLiveSecrets && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
                <i className="ri-information-line text-amber-400"></i>
                <p className="text-xs text-amber-300">API secret status unavailable — edge function check pending</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {secretChecks.map((s) => (
                <div key={s.service} className={`bg-[#0a1628] rounded-xl border p-4 ${s.configured ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg mb-3 ${s.configured ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <i className={`${s.service === 'Supabase' ? 'ri-database-2-line' : s.service === 'Stripe' ? 'ri-bank-card-line' : s.service === 'SMTP (Resend)' ? 'ri-mail-send-line' : s.service === 'Google Maps' ? 'ri-map-pin-line' : s.service === 'OpenAI' ? 'ri-robot-line' : s.service === 'Google Gemini' ? 'ri-sparkling-line' : 'ri-shield-check-line'} ${s.configured ? 'text-emerald-400' : 'text-red-400'} text-sm`}></i>
                  </div>
                  <p className="text-sm font-medium text-slate-200">{s.service}</p>
                  <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium ${s.configured ? 'text-emerald-400' : 'text-red-400'}`}>
                    <i className={`${s.configured ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-xs`}></i>
                    {s.configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}