'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ClientMonitoringData {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  verified: boolean | null;
  profile_completed: boolean | null;
  is_suspended: boolean | null;
  subscription: {
    status: string;
    trial_end_date: string | null;
  } | null;
  jobCounts: {
    total: number;
    active: number;
  };
  paymentStatus: {
    total_spent: number;
    failed_payments: number;
  };
  supportStatus: {
    open_tickets: number;
    urgent_tickets: number;
  };
  healthScore: number;
  healthStatus: 'healthy' | 'warning' | 'needs_attention' | 'critical';
  alerts: string[];
  created_at: string | null;
  last_login: string | null;
}

interface TableProps {
  clients: ClientMonitoringData[];
  loading: boolean;
  onSelectClient: (client: ClientMonitoringData) => void;
}

export default function ClientMonitoringTable({ clients, loading, onSelectClient }: TableProps) {
  const [actionOpen, setActionOpen] = useState<string | null>(null);

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <i className="ri-checkbox-circle-fill text-xs"></i> Healthy
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <i className="ri-alert-line text-xs"></i> Warning
          </span>
        );
      case 'needs_attention':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-100">
            <i className="ri-error-warning-line text-xs"></i> Needs Attention
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-100">
            <i className="ri-close-circle-fill text-xs"></i> Critical
          </span>
        );
      default:
        return null;
    }
  };

  const getSubscriptionBadge = (client: ClientMonitoringData) => {
    if (client.is_suspended) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-100">
          <i className="ri-forbid-line text-xs"></i> Suspended
        </span>
      );
    }
    const status = client.subscription?.status;
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <i className="ri-vip-crown-line text-xs"></i> Active
        </span>
      );
    }
    if (status === 'trialing') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <i className="ri-timer-line text-xs"></i> Trial
        </span>
      );
    }
    if (status === 'past_due') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-100">
          <i className="ri-error-warning-line text-xs"></i> Past Due
        </span>
      );
    }
    if (status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 ring-1 ring-slate-200">
          <i className="ri-close-circle-line text-xs"></i> Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 ring-1 ring-slate-200">
        <i className="ri-zzz-line text-xs"></i> Free
      </span>
    );
  };

  const getSupportBadge = (client: ClientMonitoringData) => {
    if (client.supportStatus.urgent_tickets > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-100">
          <i className="ri-alarm-warning-line text-xs"></i> {client.supportStatus.urgent_tickets} urgent
        </span>
      );
    }
    if (client.supportStatus.open_tickets > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <i className="ri-message-3-line text-xs"></i> {client.supportStatus.open_tickets} open
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <i className="ri-check-line text-xs"></i> Clear
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 text-sm">Loading client data...</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">
        <div className="w-16 h-16 flex items-center justify-center bg-slate-50 rounded-full mx-auto mb-4">
          <i className="ri-building-line text-3xl text-slate-300"></i>
        </div>
        <p className="text-slate-600 font-medium">No clients found</p>
        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trial End</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jobs</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Support</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Health</th>
              <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => {
              const initials = (client.company_name || client.contact_name || 'U')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onSelectClient(client)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-teal-500 to-sky-600 rounded-xl text-white font-semibold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{client.company_name || 'No company'}</p>
                        <p className="text-xs text-slate-500 truncate">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-900">{client.contact_name || '—'}</p>
                    {client.last_login && (
                      <p className="text-xs text-slate-400">
                        Last login: {new Date(client.last_login).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">{getSubscriptionBadge(client)}</td>
                  <td className="px-5 py-4">
                    {client.subscription?.trial_end_date ? (
                      <p className="text-sm text-slate-700">
                        {new Date(client.subscription.trial_end_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{client.jobCounts.active}</span>
                      <span className="text-xs text-slate-400">active</span>
                      <span className="text-xs text-slate-300">|</span>
                      <span className="text-sm font-semibold text-slate-700">{client.jobCounts.total}</span>
                      <span className="text-xs text-slate-400">total</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        £{client.paymentStatus.total_spent.toLocaleString()}
                      </span>
                      {client.paymentStatus.failed_payments > 0 && (
                        <span className="text-xs text-red-500 font-medium">
                          {client.paymentStatus.failed_payments} failed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">{getSupportBadge(client)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {getHealthBadge(client.healthStatus)}
                      <span className="text-sm font-bold text-slate-700">{client.healthScore}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setActionOpen(actionOpen === client.id ? null : client.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-slate-500"
                      >
                        <i className="ri-more-2-fill text-lg"></i>
                      </button>
                      {actionOpen === client.id && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-10">
                          <button
                            onClick={() => { onSelectClient(client); setActionOpen(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                          >
                            <i className="ri-user-line text-slate-400"></i> View Client
                          </button>
                          <Link
                            href={`/admin/jobs?client_id=${client.id}`}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                          >
                            <i className="ri-briefcase-line text-slate-400"></i> View Jobs
                          </Link>
                          <Link
                            href={`/admin/payments?client_id=${client.id}`}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                          >
                            <i className="ri-money-pound-circle-line text-slate-400"></i> View Payments
                          </Link>
                          <Link
                            href={`/admin/support-tickets?client_id=${client.id}`}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                          >
                            <i className="ri-message-3-line text-slate-400"></i> View Tickets
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}