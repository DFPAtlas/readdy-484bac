'use client';

import { useState } from 'react';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileHeader from '../components/MobileHeader';

const upcomingShifts = [
  {
    id: '1',
    title: 'Door Supervisor',
    venue: 'Fabric Nightclub',
    location: 'Charterhouse St, London',
    date: 'Today',
    time: '21:00 – 03:00',
    pay: '£126.00',
    status: 'confirmed',
    color: 'emerald',
  },
  {
    id: '2',
    title: 'Event Security',
    venue: 'O2 Arena',
    location: 'Peninsula Square, London',
    date: 'Tomorrow',
    time: '17:00 – 23:00',
    pay: '£90.00',
    status: 'confirmed',
    color: 'blue',
  },
  {
    id: '3',
    title: 'Retail Security',
    venue: 'Westfield Stratford',
    location: 'Stratford, London',
    date: 'Sat 17 May',
    time: '09:00 – 17:00',
    pay: '£104.00',
    status: 'pending',
    color: 'amber',
  },
];

const nearbyJobs = [
  { id: '1', title: 'Door Supervisor', venue: 'XOYO Club', pay: '£18/hr', distance: '0.4 mi', date: 'Fri 16 May' },
  { id: '2', title: 'Corporate Security', venue: 'Canary Wharf Tower', pay: '£16/hr', distance: '1.2 mi', date: 'Mon 19 May' },
  { id: '3', title: 'Event Guard', venue: 'Roundhouse Camden', pay: '£17/hr', distance: '2.1 mi', date: 'Sat 17 May' },
];

export default function MobileGuardHome() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="flex flex-col h-full bg-[#0B1933] overflow-y-auto">
      <MobileHeader
        title="QuickGuard"
        subtitle="Good evening, James"
        role="guard"
        showNotification
        notificationCount={2}
      />

      <div className="flex-1 px-4 pb-24 space-y-5 pt-4">
        {/* Status Card */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-teal-100 text-xs font-medium uppercase tracking-wide">This Week</p>
              <p className="text-white text-3xl font-bold mt-0.5">£320.00</p>
              <p className="text-teal-200 text-sm mt-1">3 shifts completed</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="ri-money-pound-circle-line text-white text-3xl"></i>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">12</p>
              <p className="text-teal-200 text-xs">Total Jobs</p>
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">4.9</p>
              <p className="text-teal-200 text-xs">Rating</p>
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-lg font-bold">SIA</p>
              <p className="text-teal-200 text-xs">Verified</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: 'ri-search-line', label: 'Find Jobs', color: 'bg-blue-500/20 text-blue-400' },
            { icon: 'ri-calendar-check-line', label: 'My Shifts', color: 'bg-emerald-500/20 text-emerald-400' },
            { icon: 'ri-wallet-3-line', label: 'Earnings', color: 'bg-purple-500/20 text-purple-400' },
            { icon: 'ri-user-line', label: 'Profile', color: 'bg-amber-500/20 text-amber-400' },
          ].map((action) => (
            <button key={action.label} className="flex flex-col items-center gap-2 cursor-pointer">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${action.color}`}>
                <i className={`${action.icon} text-xl`}></i>
              </div>
              <span className="text-slate-400 text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Upcoming Shifts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Upcoming Shifts</h2>
            <button className="text-teal-400 text-sm font-medium cursor-pointer whitespace-nowrap">See all</button>
          </div>
          <div className="space-y-3">
            {upcomingShifts.map((shift) => (
              <div key={shift.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        shift.status === 'confirmed' ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}></span>
                      <p className="text-white font-semibold text-sm truncate">{shift.title}</p>
                    </div>
                    <p className="text-slate-400 text-xs">{shift.venue}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-teal-400 font-bold text-sm">{shift.pay}</p>
                    <p className={`text-xs mt-0.5 ${shift.status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {shift.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line"></i>
                    {shift.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    {shift.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-map-pin-line"></i>
                    {shift.location.split(',')[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nearby Jobs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base">Jobs Near You</h2>
            <button className="text-teal-400 text-sm font-medium cursor-pointer whitespace-nowrap">Browse all</button>
          </div>
          <div className="space-y-2">
            {nearbyJobs.map((job) => (
              <div key={job.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 flex items-center justify-between cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{job.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{job.venue} · {job.distance}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{job.date}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-teal-400 font-bold text-sm">{job.pay}</span>
                  <div className="w-8 h-8 bg-teal-500/20 rounded-xl flex items-center justify-center">
                    <i className="ri-arrow-right-line text-teal-400 text-sm"></i>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} role="guard" />
    </div>
  );
}