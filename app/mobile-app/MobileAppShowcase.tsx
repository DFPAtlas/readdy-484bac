'use client';

import { useState } from 'react';
import Link from 'next/link';
import MobileGuardApp from './guard/MobileGuardApp';
import MobileSupervisorHome from './supervisor/MobileSupervisorHome';
import MobileAreaManagerHome from './area-manager/MobileAreaManagerHome';

const roles = [
  {
    id: 'guard',
    label: 'Guard',
    icon: 'ri-shield-user-line',
    color: 'from-teal-500 to-teal-700',
    accent: 'text-teal-400',
    border: 'border-teal-500',
    bg: 'bg-teal-500/10',
    description: 'View shifts, apply to jobs, track earnings',
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    icon: 'ri-user-star-line',
    color: 'from-blue-500 to-blue-700',
    accent: 'text-blue-400',
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    description: 'Manage team, log incidents, oversee sites',
  },
  {
    id: 'area-manager',
    label: 'Area Manager',
    icon: 'ri-building-4-line',
    color: 'from-purple-500 to-purple-700',
    accent: 'text-purple-400',
    border: 'border-purple-500',
    bg: 'bg-purple-500/10',
    description: 'Zone analytics, revenue, supervisor oversight',
  },
];

export default function MobileAppShowcase() {
  const [activeRole, setActiveRole] = useState<'guard' | 'supervisor' | 'area-manager'>('guard');

  const activeRoleData = roles.find((r) => r.id === activeRole)!;

  return (
    <div className="min-h-screen bg-[#060d1a]">
      {/* Top Bar */}
      <div className="border-b border-[#1e2d4d] bg-[#0B1933] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <img src="https://quickguard.uk/quickguard_logo_120x120.png" alt="QuickGuard" className="w-8 h-8 rounded-lg" />
              <span className="text-white font-bold text-lg font-[family-name:var(--font-pacifico)]">QuickGuard</span>
            </Link>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-sm">Mobile App Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-[#111d35] border border-[#1e2d4d] px-3 py-1.5 rounded-full">
              Design Preview Only
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#111d35] border border-[#1e2d4d] rounded-full px-4 py-2 mb-6">
            <i className="ri-smartphone-line text-teal-400 text-sm"></i>
            <span className="text-slate-300 text-sm font-medium">QuickGuard Mobile App</span>
          </div>
          <h1 className="text-white text-4xl font-bold mb-4">
            Mobile Experience for<br />
            <span className="bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Every Role
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Purpose-built mobile interfaces for guards, supervisors, and area managers — each tailored to their specific workflow.
          </p>
        </div>

        {/* Role Selector */}
        <div className="flex justify-center gap-4 mb-12">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id as any)}
              className={`flex flex-col items-center gap-3 px-8 py-5 rounded-2xl border-2 transition-all cursor-pointer ${
                activeRole === role.id
                  ? `${role.border} ${role.bg}`
                  : 'border-[#1e2d4d] bg-[#111d35] hover:border-slate-500'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center`}>
                <i className={`${role.icon} text-white text-2xl`}></i>
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${activeRole === role.id ? role.accent : 'text-white'}`}>{role.label}</p>
                <p className="text-slate-500 text-xs mt-0.5 max-w-[140px] leading-tight">{role.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Phone Mockup */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Phone Frame */}
            <div className="relative w-[390px] bg-[#111d35] rounded-[48px] border-4 border-[#1e2d4d] shadow-2xl overflow-hidden"
              style={{ height: '780px', boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(99,102,241,0.1)' }}>
              {/* Status Bar */}
              <div className="absolute top-0 left-0 right-0 h-10 bg-black/30 z-50 flex items-center justify-between px-6">
                <span className="text-white text-xs font-semibold">9:41</span>
                <div className="w-24 h-6 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-0"></div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-signal-wifi-3-line text-white text-xs"></i>
                  <i className="ri-battery-2-charge-line text-white text-xs"></i>
                </div>
              </div>

              {/* Screen Content */}
              <div className="absolute inset-0 overflow-hidden" style={{ paddingTop: '40px' }}>
                {activeRole === 'guard' && <MobileGuardApp />}
                {activeRole === 'supervisor' && <MobileSupervisorHome />}
                {activeRole === 'area-manager' && <MobileAreaManagerHome />}
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full z-50"></div>
            </div>

            {/* Glow Effect */}
            <div className={`absolute inset-0 rounded-[48px] blur-3xl opacity-20 -z-10 bg-gradient-to-br ${activeRoleData.color}`}></div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-16 grid grid-cols-3 gap-6">
          {[
            {
              role: 'Guard',
              icon: 'ri-shield-user-line',
              color: 'from-teal-500 to-teal-700',
              features: ['GPS Clock In / Clock Out', 'View & accept shifts', 'Apply to nearby jobs', 'Track weekly earnings', 'SIA verification status'],
            },
            {
              role: 'Supervisor',
              icon: 'ri-user-star-line',
              color: 'from-blue-500 to-blue-700',
              features: ['Live team status board', 'Incident logging', 'Shift management', 'Guard assignment', 'Broadcast messages'],
            },
            {
              role: 'Area Manager',
              icon: 'ri-building-4-line',
              color: 'from-purple-500 to-purple-700',
              features: ['Multi-zone overview', 'Revenue analytics', 'Supervisor performance', 'Coverage alerts', 'Deploy resources'],
            },
          ].map((item) => (
            <div key={item.role} className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
                <i className={`${item.icon} text-white text-2xl`}></i>
              </div>
              <h3 className="text-white font-bold text-lg mb-3">{item.role} App</h3>
              <ul className="space-y-2">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-slate-400 text-sm">
                    <i className="ri-check-line text-emerald-400 text-base flex-shrink-0"></i>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}