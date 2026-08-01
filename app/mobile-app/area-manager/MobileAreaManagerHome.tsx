'use client';

import { useState } from 'react';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileHeader from '../components/MobileHeader';

const sites = [
  { id: '1', name: 'Central London Zone', guards: 24, supervisors: 3, coverage: 100, revenue: '£4,320', status: 'optimal' },
  { id: '2', name: 'East London Zone', guards: 18, supervisors: 2, coverage: 89, revenue: '£3,150', status: 'warning' },
  { id: '3', name: 'South London Zone', guards: 15, supervisors: 2, coverage: 100, revenue: '£2,890', status: 'optimal' },
  { id: '4', name: 'North London Zone', guards: 12, supervisors: 1, coverage: 75, revenue: '£2,100', status: 'critical' },
];

const supervisors = [
  { id: '1', name: 'Rachel Chen', zone: 'Central London', guardsManaged: 24, performance: 97, avatar: 'RC' },
  { id: '2', name: 'James Obi', zone: 'East London', guardsManaged: 18, performance: 88, avatar: 'JO' },
  { id: '3', name: 'Fatima Al-Hassan', zone: 'South London', guardsManaged: 15, performance: 95, avatar: 'FA' },
  { id: '4', name: 'Tom Bradley', zone: 'North London', guardsManaged: 12, performance: 72, avatar: 'TB' },
];

const alerts = [
  { id: '1', type: 'Understaffed', site: 'North London Zone', message: '3 guards short for tonight', severity: 'critical', time: '5m ago' },
  { id: '2', type: 'Late Check-in', site: 'East London Zone', message: '2 guards not checked in', severity: 'warning', time: '12m ago' },
  { id: '3', type: 'Incident Report', site: 'Central London', message: 'Altercation logged at Fabric', severity: 'info', time: '1h ago' },
];

export default function MobileAreaManagerHome() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="flex flex-col h-full bg-[#0d0a1e] overflow-y-auto">
      <MobileHeader
        title="Area Manager"
        subtitle="Good evening, Director"
        role="area-manager"
        showNotification
        notificationCount={5}
      />

      <div className="flex-1 px-4 pb-24 space-y-5 pt-4">
        {/* Revenue Overview */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-900 rounded-2xl p-5 shadow-lg">
          <p className="text-purple-200 text-xs font-semibold uppercase tracking-wide mb-1">Today's Revenue</p>
          <p className="text-white text-4xl font-bold">£12,460</p>
          <p className="text-purple-300 text-sm mt-1">+8.4% vs yesterday</p>
          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">69</p>
              <p className="text-purple-200 text-xs">Guards Active</p>
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">4</p>
              <p className="text-purple-200 text-xs">Zones</p>
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">91%</p>
              <p className="text-purple-200 text-xs">Coverage</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-base">Alerts</h2>
              <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">3</span>
            </div>
            <button className="text-purple-400 text-sm font-medium cursor-pointer whitespace-nowrap">Dismiss all</button>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl p-4 border cursor-pointer ${
                alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500/20' :
                    alert.severity === 'warning' ? 'bg-amber-500/20' :
                    'bg-blue-500/20'
                  }`}>
                    <i className={`text-sm ${
                      alert.severity === 'critical' ? 'ri-error-warning-line text-red-400' :
                      alert.severity === 'warning' ? 'ri-alert-line text-amber-400' :
                      'ri-information-line text-blue-400'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${
                        alert.severity === 'critical' ? 'text-red-300' :
                        alert.severity === 'warning' ? 'text-amber-300' :
                        'text-blue-300'
                      }`}>{alert.type}</p>
                      <span className="text-slate-500 text-xs flex-shrink-0 ml-2">{alert.time}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{alert.site}</p>
                    <p className="text-slate-300 text-xs mt-1">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Zone Overview</h2>
            <button className="text-purple-400 text-sm font-medium cursor-pointer whitespace-nowrap">Map view</button>
          </div>
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="bg-[#1a1030] border border-[#2d1f4d] rounded-2xl p-4 cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        site.status === 'optimal' ? 'bg-emerald-400' :
                        site.status === 'warning' ? 'bg-amber-400' :
                        'bg-red-400'
                      }`}></span>
                      <p className="text-white font-semibold text-sm truncate">{site.name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{site.guards} guards</span>
                      <span>{site.supervisors} supervisors</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-purple-400 font-bold text-sm">{site.revenue}</p>
                    <p className="text-slate-500 text-xs">today</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#0d0a1e] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        site.coverage >= 95 ? 'bg-emerald-400' :
                        site.coverage >= 80 ? 'bg-amber-400' :
                        'bg-red-400'
                      }`}
                      style={{ width: `${site.coverage}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ${
                    site.coverage >= 95 ? 'text-emerald-400' :
                    site.coverage >= 80 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>{site.coverage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supervisor Performance */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Supervisors</h2>
            <button className="text-purple-400 text-sm font-medium cursor-pointer whitespace-nowrap">Full report</button>
          </div>
          <div className="space-y-2">
            {supervisors.map((sup) => (
              <div key={sup.id} className="bg-[#1a1030] border border-[#2d1f4d] rounded-xl p-3 flex items-center gap-3 cursor-pointer">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 text-xs font-bold">{sup.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{sup.name}</p>
                  <p className="text-slate-500 text-xs">{sup.zone} · {sup.guardsManaged} guards</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${
                    sup.performance >= 90 ? 'text-emerald-400' :
                    sup.performance >= 80 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>{sup.performance}%</p>
                  <p className="text-slate-600 text-xs">perf.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1a1030] border border-[#2d1f4d] rounded-2xl p-4">
          <p className="text-white font-semibold text-sm mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: 'ri-user-add-line', label: 'Deploy Guard', color: 'bg-purple-500/20 text-purple-400' },
              { icon: 'ri-file-chart-2-line', label: 'Generate Report', color: 'bg-blue-500/20 text-blue-400' },
              { icon: 'ri-message-3-line', label: 'Broadcast Alert', color: 'bg-red-500/20 text-red-400' },
              { icon: 'ri-settings-3-line', label: 'Zone Settings', color: 'bg-emerald-500/20 text-emerald-400' },
            ].map((action) => (
              <button key={action.label} className="flex items-center gap-3 p-3 bg-[#0d0a1e] rounded-xl cursor-pointer">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  <i className={`${action.icon} text-base`}></i>
                </div>
                <span className="text-slate-300 text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} role="area-manager" />
    </div>
  );
}