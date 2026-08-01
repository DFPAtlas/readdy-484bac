'use client';

import { useState } from 'react';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileHeader from '../components/MobileHeader';

const teamMembers = [
  { id: '1', name: 'Marcus Thompson', role: 'Door Supervisor', status: 'on-shift', location: 'Fabric Nightclub', checkIn: '21:00', avatar: 'MT' },
  { id: '2', name: 'Sarah Williams', role: 'Event Guard', status: 'on-shift', location: 'O2 Arena', checkIn: '17:30', avatar: 'SW' },
  { id: '3', name: 'Daniel Okafor', role: 'Retail Security', status: 'standby', location: 'Westfield', checkIn: '—', avatar: 'DO' },
  { id: '4', name: 'Priya Patel', role: 'Door Supervisor', status: 'off-duty', location: '—', checkIn: '—', avatar: 'PP' },
];

const incidents = [
  { id: '1', type: 'Altercation', location: 'Fabric Nightclub', time: '22:47', severity: 'medium', guard: 'Marcus T.' },
  { id: '2', type: 'Suspicious Activity', location: 'O2 Arena', time: '19:15', severity: 'low', guard: 'Sarah W.' },
];

const todayShifts = [
  { id: '1', site: 'Fabric Nightclub', guards: 3, start: '21:00', end: '03:00', status: 'active' },
  { id: '2', site: 'O2 Arena', guards: 5, start: '17:00', end: '23:00', status: 'active' },
  { id: '3', site: 'Westfield Stratford', guards: 2, start: '09:00', end: '17:00', status: 'completed' },
];

export default function MobileSupervisorHome() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="flex flex-col h-full bg-[#0a1628] overflow-y-auto">
      <MobileHeader
        title="Supervisor"
        subtitle="Good evening, Rachel"
        role="supervisor"
        showNotification
        notificationCount={3}
      />

      <div className="flex-1 px-4 pb-24 space-y-5 pt-4">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3">
              <i className="ri-team-line text-blue-400 text-xl"></i>
            </div>
            <p className="text-white text-2xl font-bold">8</p>
            <p className="text-slate-400 text-xs mt-0.5">Guards On Duty</p>
            <p className="text-blue-400 text-xs mt-1 font-medium">2 on standby</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
              <i className="ri-map-pin-2-line text-emerald-400 text-xl"></i>
            </div>
            <p className="text-white text-2xl font-bold">3</p>
            <p className="text-slate-400 text-xs mt-0.5">Active Sites</p>
            <p className="text-emerald-400 text-xs mt-1 font-medium">All covered</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-3">
              <i className="ri-alert-line text-amber-400 text-xl"></i>
            </div>
            <p className="text-white text-2xl font-bold">2</p>
            <p className="text-slate-400 text-xs mt-0.5">Incidents Today</p>
            <p className="text-amber-400 text-xs mt-1 font-medium">1 unresolved</p>
          </div>
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-3">
              <i className="ri-time-line text-purple-400 text-xl"></i>
            </div>
            <p className="text-white text-2xl font-bold">94%</p>
            <p className="text-slate-400 text-xs mt-0.5">Attendance Rate</p>
            <p className="text-purple-400 text-xs mt-1 font-medium">This week</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4">
          <p className="text-white font-semibold text-sm mb-3">Quick Actions</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: 'ri-user-add-line', label: 'Assign Guard', color: 'bg-blue-500/20 text-blue-400' },
              { icon: 'ri-alarm-warning-line', label: 'Log Incident', color: 'bg-red-500/20 text-red-400' },
              { icon: 'ri-message-3-line', label: 'Broadcast', color: 'bg-emerald-500/20 text-emerald-400' },
            ].map((action) => (
              <button key={action.label} className="flex flex-col items-center gap-2 p-3 bg-[#0a1628] rounded-xl cursor-pointer">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
                  <i className={`${action.icon} text-lg`}></i>
                </div>
                <span className="text-slate-400 text-xs text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Today's Shifts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Today's Shifts</h2>
            <button className="text-blue-400 text-sm font-medium cursor-pointer whitespace-nowrap">Manage</button>
          </div>
          <div className="space-y-2">
            {todayShifts.map((shift) => (
              <div key={shift.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${shift.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                      <p className="text-white font-semibold text-sm truncate">{shift.site}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <i className="ri-team-line"></i>
                        {shift.guards} guards
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {shift.start} – {shift.end}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${
                    shift.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {shift.status === 'active' ? 'Active' : 'Done'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Status */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Team Status</h2>
            <button className="text-blue-400 text-sm font-medium cursor-pointer whitespace-nowrap">View all</button>
          </div>
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div key={member.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 flex items-center gap-3 cursor-pointer">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">{member.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{member.name}</p>
                  <p className="text-slate-500 text-xs">{member.status === 'on-shift' ? member.location : member.role}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  member.status === 'on-shift' ? 'bg-emerald-500/20 text-emerald-400' :
                  member.status === 'standby' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {member.status === 'on-shift' ? 'On Shift' : member.status === 'standby' ? 'Standby' : 'Off Duty'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Recent Incidents</h2>
            <button className="text-blue-400 text-sm font-medium cursor-pointer whitespace-nowrap">All reports</button>
          </div>
          <div className="space-y-2">
            {incidents.map((incident) => (
              <div key={incident.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      incident.severity === 'medium' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                    }`}>
                      <i className={`ri-alert-line text-base ${incident.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'}`}></i>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{incident.type}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{incident.location} · {incident.guard}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-slate-400 text-xs">{incident.time}</p>
                    <span className={`text-xs font-semibold ${incident.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'}`}>
                      {incident.severity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} role="supervisor" />
    </div>
  );
}