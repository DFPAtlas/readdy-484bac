interface Tab {
  id: string;
  icon: string;
  activeIcon: string;
  label: string;
  badge?: number;
}

interface BottomNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F1A2E]/95 backdrop-blur-xl border-t border-[#1e2d4d]/60 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around max-w-md mx-auto px-2 pt-2 pb-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 px-3 py-1 cursor-pointer min-w-[56px]"
            >
              <div className={`relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 ${isActive ? 'bg-teal-500/20 shadow-lg shadow-teal-500/10' : ''}`}>
                <i className={`${isActive ? tab.activeIcon : tab.icon} text-xl transition-colors duration-300 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold transition-colors duration-300 ${isActive ? 'text-teal-400' : 'text-slate-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}