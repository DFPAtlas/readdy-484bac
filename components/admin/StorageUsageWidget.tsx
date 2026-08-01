'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnywjfpkepjgclkbcmsj.supabase.co';

interface BucketData {
  name: string;
  public: boolean;
  file_count: number;
  total_bytes: number;
  file_size_limit: number | null;
  allowed_mime_types: string[];
  percentage_used: number | null;
  has_rls_policies: boolean;
  warnings: string[];
}

interface StorageSummary {
  total_files: number;
  total_bytes: number;
  largest_bucket: string | null;
  largest_bucket_bytes: number;
  buckets_without_policies: string[];
  public_buckets: string[];
  public_bucket_warnings: string[];
}

interface StorageUsageData {
  buckets: BucketData[];
  summary: StorageSummary;
  queried_at: string;
  queried_by: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatMimeTypes(types: string[]): string {
  if (!types || types.length === 0) return 'All types';
  return types.map((t) => t.replace('image/', '').replace('application/', '')).join(', ');
}

function BucketCardSkeleton() {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-28 h-4 bg-[#1a2b4a] rounded"></div>
        <div className="w-16 h-5 bg-[#1a2b4a] rounded-full"></div>
      </div>
      <div className="space-y-3">
        <div className="w-full h-2 bg-[#1a2b4a] rounded-full"></div>
        <div className="flex justify-between">
          <div className="w-16 h-3 bg-[#1a2b4a] rounded"></div>
          <div className="w-12 h-3 bg-[#1a2b4a] rounded"></div>
        </div>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="w-20 h-3 bg-[#1a2b4a] rounded"></div>
        <div className="w-16 h-3 bg-[#1a2b4a] rounded"></div>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#1a2b4a]"></div>
        <div className="w-36 h-4 bg-[#1a2b4a] rounded"></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="w-10 h-3 bg-[#1a2b4a] rounded mb-1.5"></div>
            <div className="w-16 h-5 bg-[#1a2b4a] rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  standalone?: boolean;
}

export default function StorageUsageWidget({ standalone = false }: Props) {
  const [data, setData] = useState<StorageUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWarningBuckets, setExpandedWarningBuckets] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-storage-usage`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Request failed (${res.status})`);
      }

      const result: StorageUsageData = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load storage usage');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleWarnings = (bucketName: string) => {
    setExpandedWarningBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketName)) {
        next.delete(bucketName);
      } else {
        next.add(bucketName);
      }
      return next;
    });
  };

  const getBucketIcon = (name: string) => {
    if (name === 'avatars') return 'ri-user-smile-line';
    if (name === 'guard-profiles') return 'ri-profile-line';
    if (name === 'guard-documents') return 'ri-file-text-line';
    if (name === 'sia-licences') return 'ri-shield-check-line';
    if (name === 'ID-images') return 'ri-id-card-line';
    if (name === 'quickguard-email-assets') return 'ri-mail-settings-line';
    return 'ri-folder-line';
  };

  const getProgressColor = (pct: number | null) => {
    if (pct === null) return 'bg-teal-500';
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-teal-500';
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Bucket', 'Public', 'Files', 'Total Size', 'Size Limit', 'Usage %', 'RLS Policies', 'Warnings'];
    const rows = data.buckets.map((b) => [
      b.name,
      b.public ? 'Yes' : 'No',
      b.file_count.toString(),
      formatBytes(b.total_bytes),
      b.file_size_limit ? formatBytes(b.file_size_limit) : 'None',
      b.percentage_used !== null ? `${b.percentage_used}%` : 'N/A',
      b.has_rls_policies ? 'Yes' : 'No',
      b.warnings.join('; '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const containerClass = standalone
    ? 'min-h-screen bg-[#0B1933]'
    : '';

  const content = (
    <>
      {error && (
        <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 shadow-sm bg-[#111d35] flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
            <i className="ri-error-warning-line text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Failed to load storage usage</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => fetchData(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 shadow-sm bg-red-600 hover:bg-red-500 text-white cursor-pointer whitespace-nowrap"
          >
            Retry
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line text-sm"></i>
            </div>
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-6">
          <SummarySkeleton />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <BucketCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {!standalone && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Supabase Storage</h2>
                <span className="text-[10px] font-medium text-slate-600">
                  Queried {new Date(data.queried_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {data.queried_by ? ` by ${data.queried_by}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-download-line text-xs"></i>
                  </div>
                  CSV
                </button>
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <div className={`w-3 h-3 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
                    <i className="ri-refresh-line text-xs"></i>
                  </div>
                  Refresh
                </button>
              </div>
            </div>
          )}

          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <i className="ri-database-2-line text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Storage Summary</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Last updated {new Date(data.queried_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {refreshing && (
                <div className="ml-auto w-4 h-4 flex items-center justify-center text-teal-400">
                  <i className="ri-loader-4-line animate-spin text-sm"></i>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500">Total Files</p>
                <p className="text-xl font-extrabold text-white mt-0.5">{data.summary.total_files.toLocaleString('en-GB')}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">Total Used</p>
                <p className="text-xl font-extrabold text-white mt-0.5">{formatBytes(data.summary.total_bytes)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">Largest Bucket</p>
                <p className="text-xl font-extrabold text-white mt-0.5">{data.summary.largest_bucket || '—'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{data.summary.largest_bucket_bytes > 0 ? formatBytes(data.summary.largest_bucket_bytes) : ''}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">Alerts</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {data.summary.public_bucket_warnings.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                      {data.summary.public_bucket_warnings.length} public
                    </span>
                  )}
                  {data.summary.buckets_without_policies.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">
                      {data.summary.buckets_without_policies.length} no RLS
                    </span>
                  )}
                  {data.summary.public_bucket_warnings.length === 0 && data.summary.buckets_without_policies.length === 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                      All clear
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.buckets.map((bucket) => {
              const progressColor = getProgressColor(bucket.percentage_used);
              const hasWarnings = bucket.warnings.length > 0;
              const expanded = expandedWarningBuckets.has(bucket.name);

              return (
                <div
                  key={bucket.name}
                  className={`bg-[#111d35] rounded-2xl border transition-all ${
                    hasWarnings ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-[#1a2b4a] hover:border-teal-500/30'
                  } p-5`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 ${
                        hasWarnings ? 'bg-amber-500/10 text-amber-400' : 'bg-[#0a1628] text-teal-400'
                      }`}>
                        <i className={`${getBucketIcon(bucket.name)} text-lg`}></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{bucket.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {bucket.public ? 'Public' : 'Private'}
                          {' · '}
                          {bucket.has_rls_policies ? 'RLS protected' : 'No RLS'}
                        </p>
                      </div>
                    </div>
                    {hasWarnings && (
                      <button
                        onClick={() => toggleWarnings(bucket.name)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer flex-shrink-0"
                      >
                        <i className={`ri-error-warning-line ${expanded ? 'text-sm' : 'text-sm'}`}></i>
                      </button>
                    )}
                  </div>

                  {bucket.percentage_used !== null && (
                    <div className="mb-3">
                      <div className="w-full h-2 bg-[#0a1628] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(bucket.percentage_used, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-medium text-slate-500">
                          {formatBytes(bucket.total_bytes)} used
                        </span>
                        <span className={`text-[10px] font-bold ${
                          bucket.percentage_used >= 90 ? 'text-red-400' : bucket.percentage_used >= 70 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {bucket.percentage_used}%
                        </span>
                      </div>
                    </div>
                  )}

                  {bucket.percentage_used === null && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-slate-500">
                        {formatBytes(bucket.total_bytes)} used
                      </span>
                      <span className="text-[10px] font-medium text-slate-600">No limit set</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-file-line text-[10px]"></i>
                      </div>
                      {bucket.file_count} files
                    </span>
                    {bucket.file_size_limit && (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-ruler-line text-[10px]"></i>
                        </div>
                        {formatBytes(bucket.file_size_limit)}
                      </span>
                    )}
                  </div>

                  {bucket.allowed_mime_types && bucket.allowed_mime_types.length > 0 && (
                    <p className="mt-2 text-[10px] text-slate-600 truncate">
                      {formatMimeTypes(bucket.allowed_mime_types)}
                    </p>
                  )}

                  {expanded && bucket.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1a2b4a] space-y-1.5">
                      {bucket.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <div className="w-3.5 h-3.5 flex items-center justify-center text-amber-400 flex-shrink-0 mt-px">
                            <i className="ri-error-warning-line text-[11px]"></i>
                          </div>
                          <span className="text-[10px] text-amber-300 leading-relaxed">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  if (standalone) {
    return (
      <div className={containerClass}>
        <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                  <i className="ri-hard-drive-2-line text-xl"></i>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Storage Usage</h1>
                  <p className="text-[11px] text-slate-500 font-medium">Supabase bucket storage monitoring</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-download-line text-base"></i>
                  </div>
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <div className={`w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
                    <i className="ri-refresh-line text-base"></i>
                  </div>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
          {content}
        </main>
      </div>
    );
  }

  return <section>{content}</section>;
}