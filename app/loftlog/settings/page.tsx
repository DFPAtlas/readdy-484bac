import Link from 'next/link';

const sections = [
  { label: 'Property & Loft Details', icon: 'ri-home-4-line', href: '/loftlog/settings/property' },
  { label: 'Units & Date Formats', icon: 'ri-ruler-line', href: '/loftlog/settings/units' },
  { label: 'Code Format', icon: 'ri-barcode-line', href: '/loftlog/settings/codes' },
  { label: 'Categories & Colours', icon: 'ri-palette-line', href: '/loftlog/settings/categories' },
  { label: 'Label Templates', icon: 'ri-file-text-line', href: '/loftlog/settings/labels' },
  { label: 'AI & Privacy', icon: 'ri-shield-keyhole-line', href: '/loftlog/settings/ai' },
  { label: 'Offline & Sync', icon: 'ri-cloud-line', href: '/loftlog/settings/sync' },
  { label: 'Notifications', icon: 'ri-notification-3-line', href: '/loftlog/settings/notifications' },
  { label: 'Users & Access', icon: 'ri-user-settings-line', href: '/loftlog/settings/users' },
  { label: 'Data Export & Backup', icon: 'ri-database-2-line', href: '/loftlog/settings/backup' },
  { label: 'Integrations', icon: 'ri-plug-line', href: '/loftlog/settings/integrations' },
  { label: 'Appearance & Accessibility', icon: 'ri-contrast-2-line', href: '/loftlog/settings/appearance' },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-teal-300 transition-all group"
          >
            <span className="w-10 h-10 bg-gray-100 group-hover:bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
              <i className={`${s.icon} text-gray-500 group-hover:text-teal-600 transition-colors`}></i>
            </span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-teal-700 transition-colors">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}