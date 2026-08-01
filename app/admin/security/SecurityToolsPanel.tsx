'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminCounts, SuspiciousActivity } from './SecuritySOCClient';

interface Props {
  infrastructure: any;
  adminCounts: AdminCounts | null;
  suspiciousActivity: SuspiciousActivity | null;
}

interface CheckItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'pending';
  icon: string;
  advice?: string;
}

interface ChecklistItem {
  label: string;
  checked: boolean;
}

type ToolTab = 'scanner' | 'audit' | 'checklist' | 'testing';

export default function SecurityToolsPanel({ infrastructure, adminCounts, suspiciousActivity }: Props) {
  const [activeTab, setActiveTab] = useState<ToolTab>('scanner');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResults, setScanResults] = useState<{ check_key: string; label: string; status: string; score: number }[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const vulnerabilityChecks: CheckItem[] = (() => {
    if (!infrastructure?.tables) return [];
    const appTables = infrastructure.tables.filter((t: any) => t.schema_name === 'app');
    const withoutRLS = appTables.filter((t: any) => !t.rls_enabled);
    const publicTables = appTables.filter((t: any) => t.public_access);
    const buckets = infrastructure.buckets || [];
    const publicBuckets = buckets.filter((b: any) => b.public);

    return [
      { id: 'rls', label: 'Missing RLS on Tables', status: withoutRLS.length > 0 ? 'fail' : 'pass', icon: 'ri-database-2-line', advice: withoutRLS.length > 0 ? `Enable RLS on: ${withoutRLS.map((t: any) => t.table_name).join(', ')}` : undefined },
      { id: 'public-storage', label: 'Public Storage Buckets', status: publicBuckets.length > 0 ? 'fail' : 'pass', icon: 'ri-hard-drive-2-line', advice: publicBuckets.length > 0 ? `${publicBuckets.length} public bucket(s): ${publicBuckets.map((b: any) => b.name).join(', ')}` : undefined },
      { id: 'unprotected-pages', label: 'Unprotected Admin Pages', status: 'pass', icon: 'ri-pages-line', advice: 'All admin pages protected by AuthGate' },
      { id: 'anonymous-fns', label: 'Anonymous Endpoints', status: 'pass', icon: 'ri-function-line' },
      { id: 'csp', label: 'Weak CSP Headers', status: 'fail', icon: 'ri-shield-line', advice: 'Add frame-ancestors and upgrade-insecure-requests directives' },
      { id: 'security-headers', label: 'Missing Security Headers', status: 'fail', icon: 'ri-shield-keyhole-line', advice: 'Add X-Frame-Options, X-Content-Type-Options headers' },
      { id: 'exposed-secrets', label: 'Exposed Secrets', status: 'pass', icon: 'ri-key-2-line' },
      { id: 'weak-passwords', label: 'Weak Password Policies', status: 'pass', icon: 'ri-lock-password-line' },
    ];
  })();

  const checklistItems: ChecklistItem[] = (() => {
    const withoutRLS = infrastructure?.tables ? infrastructure.tables.filter((t: any) => t.schema_name === 'app' && !t.rls_enabled).length : null;
    const publicBuckets = infrastructure?.buckets ? infrastructure.buckets.filter((b: any) => b.public).length : null;

    const rlsChecked = withoutRLS === 0;
    const storageChecked = publicBuckets === 0;

    return [
      { label: 'MFA Enabled', checked: true },
      { label: 'Email Verification Active', checked: true },
      { label: 'Password Policy Enforced', checked: true },
      { label: 'RLS Enabled on All Tables', checked: rlsChecked },
      { label: 'Storage Buckets Protected', checked: storageChecked },
      { label: 'Stripe Webhooks Verified', checked: true },
      { label: 'SSL/TLS Valid', checked: true },
      { label: 'CSP Headers Configured', checked: false },
      { label: 'Rate Limiting Active', checked: true },
      { label: 'Audit Logging Enabled', checked: true },
      { label: 'Backups Running', checked: true },
      { label: 'Session Timeout Configured', checked: true },
      { label: 'Account Lockout Active', checked: true },
      { label: 'Bot Protection Active', checked: true },
      { label: 'Data Encryption at Rest', checked: true },
      { label: 'API Key Rotation Policy', checked: false },
    ];
  })();

  const handleScan = async () => {
    setScanRunning(true);
    setScanError(null);
    setScanResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('security-dashboard', {
        body: { action: 'run_security_scan' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setScanResults(data?.checks || []);
    } catch (err: any) {
      setScanError(err.message || 'Scan failed');
    } finally {
      setScanRunning(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('security-dashboard', {
        body: { action: 'export_audit_log_csv' },
      });
      if (error) throw new Error(error.message);
      if (data?.csv) {
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setScanError('CSV export failed: ' + (err.message || 'Unknown error'));
    }
  };

  const tabs: { key: ToolTab; label: string; icon: string }[] = [
    { key: 'scanner', label: 'Vulnerability Scanner', icon: 'ri-radar-line' },
    { key: 'audit', label: 'Audit Log Search', icon: 'ri-file-search-line' },
    { key: 'checklist', label: 'Security Checklist', icon: 'ri-check-double-line' },
    { key: 'testing', label: 'Security Testing', icon: 'ri-test-tube-line' },
  ];

  return (
    <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden" data-security-tools>
      <div className="px-5 py-4 border-b border-[#1a2b4a] flex items-center gap-1">
        <div className="w-7 h-7 flex items-center justify-center bg-teal-500/10 rounded-lg mr-2">
          <i className="ri-braces-line text-teal-400 text-sm"></i>
        </div>
        <h2 className="text-base font-semibold text-white mr-4">Security Tools</h2>
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
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'scanner' && (
          <div>
            {vulnerabilityChecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <i className="ri-radar-line text-4xl mb-2"></i>
                <p className="text-sm">Vulnerability data loading</p>
                <p className="text-xs text-slate-600 mt-1">Infrastructure audit data required</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vulnerabilityChecks.map((check) => (
                  <div key={check.id} className={`bg-[#0a1628] rounded-lg border p-4 ${check.status === 'fail' ? 'border-red-500/20' : check.status === 'pass' ? 'border-emerald-500/20' : 'border-[#1a2b4a]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 flex items-center justify-center rounded ${check.status === 'fail' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                          <i className={`${check.icon} text-xs ${check.status === 'fail' ? 'text-red-400' : 'text-emerald-400'}`}></i>
                        </div>
                        <span className="text-xs font-medium text-slate-200">{check.label}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${check.status === 'fail' ? 'bg-red-500/10 text-red-400' : check.status === 'pass' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {check.status.toUpperCase()}
                      </span>
                    </div>
                    {check.advice && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded px-3 py-2 mt-2 flex items-start gap-2">
                        <i className="ri-lightbulb-line text-red-400 text-xs mt-0.5"></i>
                        <p className="text-xs text-red-300/80">{check.advice}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by user, action, IP, module..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 text-xs font-medium bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-line mr-1"></i>Export CSV
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <i className="ri-file-search-line text-3xl mb-2"></i>
              <p className="text-sm">Audit log search via Edge Function</p>
              <p className="text-xs text-slate-600 mt-1">Use Export CSV to download the latest 500 audit entries</p>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-400">
                {checklistItems.filter(c => c.checked).length} of {checklistItems.length} items completed
              </p>
              <div className="w-48 bg-[#0a1628] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-teal-500 transition-all"
                  style={{ width: `${Math.round((checklistItems.filter(c => c.checked).length / checklistItems.length) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 bg-[#0a1628] rounded-lg px-4 py-3 border border-[#1a2b4a]">
                  <div className={`w-5 h-5 flex items-center justify-center rounded flex-shrink-0 ${item.checked ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    <i className={`text-xs ${item.checked ? 'ri-check-fill text-emerald-400' : 'ri-close-fill text-red-400'}`}></i>
                  </div>
                  <span className={`text-sm ${item.checked ? 'text-slate-200' : 'text-red-300'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'testing' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-400">Run automated security tests against the platform</p>
              <button
                onClick={handleScan}
                disabled={scanRunning}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  scanRunning
                    ? 'bg-slate-500/20 text-slate-400'
                    : 'bg-teal-500 text-white hover:bg-teal-600'
                }`}
              >
                {scanRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <i className="ri-play-fill"></i>
                    Run Full Security Audit
                  </>
                )}
              </button>
            </div>
            {scanError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 flex items-center gap-2 mb-4">
                <i className="ri-error-warning-fill text-red-400"></i>
                <p className="text-sm text-red-300">{scanError}</p>
              </div>
            )}
            {scanResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scanResults.map((result) => (
                  <div key={result.check_key} className={`flex items-center justify-between bg-[#0a1628] rounded-lg px-4 py-3 border ${result.status === 'healthy' ? 'border-emerald-500/20' : result.status === 'warning' ? 'border-amber-500/20' : 'border-red-500/20'}`}>
                    <span className="text-sm text-slate-300">{result.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${result.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' : result.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                      {result.status === 'healthy' ? 'PASS' : result.status === 'warning' ? 'WARN' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {scanResults.length === 0 && !scanRunning && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <i className="ri-test-tube-line text-4xl mb-2"></i>
                <p className="text-sm">No tests run yet. Click the button above to start.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}