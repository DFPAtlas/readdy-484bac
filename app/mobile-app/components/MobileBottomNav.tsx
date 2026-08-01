'use client';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: 'guard' | 'supervisor' | 'area-manager';
}

const guardTabs = [
  { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
  { id: 'jobs', icon: 'ri-briefcase-line', activeIcon: 'ri-briefcase-fill', label: 'Jobs' },
  { id: 'shifts', icon: 'ri-calendar-line', activeIcon: 'ri-calendar-fill', label: 'Shifts' },
  { id: 'earnings', icon: 'ri-wallet-3-line', activeIcon: 'ri-wallet-3-fill', label: 'Earnings' },
  { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
];

const supervisorTabs = [
  { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
  { id: 'team', icon: 'ri-team-line', activeIcon: 'ri-team-fill', label: 'Team' },
  { id: 'shifts', icon: 'ri-calendar-line', activeIcon: 'ri-calendar-fill', label: 'Shifts' },
  { id: 'reports', icon: 'ri-file-chart-line', activeIcon: 'ri-file-chart-fill', label: 'Reports' },
  { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
];

const areaManagerTabs = [
  { id: 'home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home' },
  { id: 'sites', icon: 'ri-map-pin-line', activeIcon: 'ri-map-pin-fill', label: 'Sites' },
  { id: 'staff', icon: 'ri-group-line', activeIcon: 'ri-group-fill', label: 'Staff' },
  { id: 'analytics', icon: 'ri-bar-chart-line', activeIcon: 'ri-bar-chart-fill', label: 'Analytics' },
  { id: 'profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' },
];

const accentColors = {
  guard: 'text-teal-400',
  supervisor: 'text-blue-400',
  'area-manager': 'text-purple-400',
};

export default function MobileBottomNav({ activeTab, setActiveTab, role }: MobileBottomNavProps) {
  const tabs = role === 'guard' ? guardTabs : role === 'supervisor' ? supervisorTabs : areaManagerTabs;
  const accent = accentColors[role];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#111d35] border-t border-[#1e2d4d] px-2 pb-5 pt-2 z-50" style={{ maxWidth: '390px', margin: '0 auto' }}>
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1 px-3 py-1 cursor-pointer"
            >
              <div className={`w-6 h-6 flex items-center justify-center`}>
                <i className={`${isActive ? tab.activeIcon : tab.icon} text-xl ${isActive ? accent : 'text-slate-500'}`}></i>
              </div>
              <span className={`text-[10px] font-medium ${isActive ? accent : 'text-slate-500'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}