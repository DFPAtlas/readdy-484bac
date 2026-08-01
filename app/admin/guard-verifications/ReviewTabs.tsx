'use client';

type Tab = 'overview' | 'licence' | 'documents' | 'professional' | 'availability' | 'account';

interface ReviewTabsProps {
  activeTab: Tab;
  hasLicenceImages: boolean;
  hasDocuments: boolean;
  onTabChange: (tab: Tab) => void;
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-file-list-line' },
  { key: 'licence', label: 'SIA Licence', icon: 'ri-shield-check-line' },
  { key: 'documents', label: 'Documents', icon: 'ri-file-list-3-line' },
  { key: 'professional', label: 'Professional', icon: 'ri-briefcase-line' },
  { key: 'availability', label: 'Availability', icon: 'ri-calendar-check-line' },
  { key: 'account', label: 'Account', icon: 'ri-settings-3-line' },
];

export default function ReviewTabs({ activeTab, hasLicenceImages, hasDocuments, onTabChange }: ReviewTabsProps) {
  return (
    <div className="sticky top-[88px] bg-[#111d35] border-b border-[#1a2b4a] px-8 z-10">
      <div className="flex items-center gap-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${
              activeTab === tab.key
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`${tab.icon} mr-1.5`}></i>
            {tab.label}
            {tab.key === 'licence' && hasLicenceImages && (
              <span className="absolute top-2 right-0 w-2 h-2 bg-emerald-500 rounded-full"></span>
            )}
            {tab.key === 'documents' && hasDocuments && (
              <span className="absolute top-2 right-0 w-2 h-2 bg-emerald-500 rounded-full"></span>
            )}
            {(tab.key === 'licence' && !hasLicenceImages) && (
              <span className="absolute top-2 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
            {(tab.key === 'documents' && !hasDocuments) && (
              <span className="absolute top-2 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}