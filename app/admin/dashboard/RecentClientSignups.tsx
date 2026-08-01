'use client';

import { useState } from 'react';

interface SignupItem {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  plan_slug: string | null;
  plan_name: string | null;
  created_at: string;
  subscription_status: string | null;
  verification_status: string | null;
}

interface Props {
  signups: SignupItem[];
  loading: boolean;
  error: string | null;
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 px-6 py-4">
      <div className="w-40 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-32 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-48 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-28 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-20 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-24 h-4 bg-[#1a2b4a] rounded"></div>
      <div className="w-16 h-4 bg-[#1a2b4a] rounded"></div>
    </div>
  );
}

export default function RecentClientSignups({ signups, loading, error }: Props) {
  return (
    <div className="bg-[#111d35] rounded-2xl shadow-sm border border-[#1a2b4a] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-building-line text-emerald-400 text-sm"></i>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Client Signups</h3>
            <p className="text-[11px] text-slate-500">Latest client accounts created</p>
          </div>
        </div>
        <a
          href="/admin/accounts?tab=clients"
          className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1"
        >
          View All
          <div className="w-3 h-3 flex items-center justify-center">
            <i className="ri-arrow-right-line"></i>
          </div>
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0e1a2d]">
            <tr>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Company</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Signup Date</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td colSpan={8}><SkeletonRow /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/10 mx-auto mb-3">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <i className="ri-error-warning-line text-red-400 text-xl"></i>
                    </div>
                  </div>
                  <p className="text-sm text-red-400 font-medium">Failed to load</p>
                  <p className="text-xs text-slate-500 mt-1">{error}</p>
                </td>
              </tr>
            ) : signups.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-14 text-center">
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#1a2b4a] mx-auto mb-4">
                    <div className="w-7 h-7 flex items-center justify-center">
                      <i className="ri-building-line text-2xl text-slate-500"></i>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-400">No client signups yet.</p>
                  <p className="text-xs text-slate-500 mt-1">New client registrations will appear here.</p>
                </td>
              </tr>
            ) : (
              signups.map((s) => {
                const initials = (s.contact_name || '?')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <tr key={s.id} className="hover:bg-[#0e1a2d] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full text-white font-semibold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <span className="text-sm font-medium text-white">
                          {s.company_name || s.contact_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{s.contact_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{s.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{s.phone || '-'}</td>
                    <td className="px-6 py-4">
                      {s.plan_name ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20">
                          {s.plan_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {s.subscription_status === 'active' || s.subscription_status === 'trialing' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          {s.subscription_status === 'trialing' ? 'Trial' : 'Active'}
                        </span>
                      ) : s.subscription_status === 'incomplete' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          Setup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20">
                          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                          {s.subscription_status || 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`/admin/accounts?tab=clients&view=${s.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#1a2b4a] text-slate-300 hover:bg-[#243a5e] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                          <i className="ri-eye-line"></i>
                        </div>
                        View
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}