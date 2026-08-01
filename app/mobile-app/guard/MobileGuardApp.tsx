'use client';

import { useState } from 'react';
import MobileGuardHome from './MobileGuardHome';
import ClockInScreen from './ClockInScreen';
import MobileBottomNav from '../components/MobileBottomNav';

export default function MobileGuardApp() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="flex flex-col h-full bg-[#0B1933] overflow-hidden relative">
      <div className="flex-1 overflow-hidden">
        {activeTab === 'home' && <MobileGuardHome />}
        {activeTab === 'clock' && <ClockInScreen />}
        {activeTab !== 'home' && activeTab !== 'clock' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <i className="ri-tools-line text-4xl"></i>
            <p className="text-sm">Coming soon</p>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-[#111d35] border-t border-[#1e2d4d] px-2 pb-5 pt-2 z-50">
        <div className="flex items-center justify-around">
          {[
            { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
            { id: 'jobs', icon: 'ri-briefcase-line', activeIcon: 'ri-briefcase-fill', label: 'Jobs' },
            { id: 'clock', icon: 'ri-fingerprint-line', activeIcon: 'ri-fingerprint-fill', label: 'Clock' },
            { id: 'earnings', icon: 'ri-wallet-3-line', activeIcon: 'ri-wallet-3-fill', label: 'Earnings' },
            { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 px-3 py-1 cursor-pointer"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`${isActive ? tab.activeIcon : tab.icon} text-xl ${isActive ? 'text-teal-400' : 'text-slate-500'}`}></i>
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-teal-400' : 'text-slate-500'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}