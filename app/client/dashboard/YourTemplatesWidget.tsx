'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface DashboardTemplate {
  id: string;
  template_name: string;
  job_title: string;
  security_type: string;
  venue: string;
  city: string;
  hourly_rate: string;
  number_of_guards: number;
  use_count: number;
  created_at: string;
}

const securityTypeLabels: Record<string, string> = {
  'door-supervisor': 'Door Supervisor',
  'event-security': 'Event Security',
  'retail-security': 'Retail Security',
  'close-protection': 'Close Protection',
  'cctv-operator': 'CCTV Operator',
  'security-guard': 'Security Guard',
};

interface YourTemplatesWidgetProps {
  clientId: string;
  limit?: number;
}

export default function YourTemplatesWidget({ clientId, limit = 4 }: YourTemplatesWidgetProps) {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!clientId) return;

    const fetchTemplates = async () => {
      const { data } = await supabase
        .schema('app')
        .from('job_templates')
        .select('id, template_name, job_title, security_type, venue, city, hourly_rate, number_of_guards, use_count, created_at')
        .eq('client_id', clientId)
        .order('use_count', { ascending: false })
        .limit(limit);

      setTemplates((data || []) as DashboardTemplate[]);
      setLoading(false);
    };

    fetchTemplates();
  }, [clientId, limit]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="h-5 bg-[#162036] rounded w-32 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#162036] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-indigo-500/15 rounded-lg">
            <i className="ri-file-copy-line text-indigo-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Your Templates</h2>
        </div>
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-[#162036] rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-file-copy-line text-xl text-slate-600"></i>
          </div>
          <p className="text-sm text-slate-400 mb-1">No templates saved yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Save a job as a template when posting to reuse it later
          </p>
          <Link
            href="/client/post-job"
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Post a Job
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-indigo-500/15 rounded-lg">
            <i className="ri-file-copy-line text-indigo-400 text-sm"></i>
          </div>
          <h2 className="text-base font-semibold text-white">Your Templates</h2>
          <span className="text-xs text-slate-500 bg-[#162036] px-2 py-0.5 rounded-full">{templates.length}</span>
        </div>
        <Link
          href="/client/templates"
          className="text-sm text-indigo-400 font-semibold hover:text-indigo-300 cursor-pointer whitespace-nowrap"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 hover:border-indigo-500/30 transition-all group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-indigo-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                <i className="ri-file-copy-line text-indigo-400 text-sm"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white truncate">{t.template_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Used {t.use_count} time{t.use_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="space-y-1 mb-3">
              {t.job_title && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <i className="ri-briefcase-line text-slate-600 flex-shrink-0"></i>
                  <span className="truncate">{t.job_title}</span>
                </p>
              )}
              {t.security_type && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <i className="ri-shield-line text-slate-600 flex-shrink-0"></i>
                  {securityTypeLabels[t.security_type] || t.security_type}
                </p>
              )}
              {(t.venue || t.city) && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <i className="ri-map-pin-line text-slate-600 flex-shrink-0"></i>
                  <span className="truncate">{[t.venue, t.city].filter(Boolean).join(', ')}</span>
                </p>
              )}
              {t.hourly_rate && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <i className="ri-money-pound-circle-line text-slate-600 flex-shrink-0"></i>
                  £{t.hourly_rate}/hr
                  {t.number_of_guards ? ` · ${t.number_of_guards} guard${t.number_of_guards !== 1 ? 's' : ''}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/client/post-job?template=${t.id}`)}
                className="flex-1 bg-teal-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
              >
                <i className="ri-send-plane-line text-xs"></i>
                Use Template
              </button>
              <button
                onClick={() => router.push(`/client/post-job?template=${t.id}`)}
                className="w-8 h-8 flex items-center justify-center border border-[#1e2d4d] rounded-lg text-slate-400 hover:bg-[#0B1933] hover:text-slate-300 transition-colors cursor-pointer"
                title="Edit then post"
              >
                <i className="ri-edit-line text-sm"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}