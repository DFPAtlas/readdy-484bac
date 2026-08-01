'use client';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  role: 'guard' | 'supervisor' | 'area-manager';
  showNotification?: boolean;
  notificationCount?: number;
  showBack?: boolean;
  onBack?: () => void;
}

const roleColors = {
  guard: 'from-teal-600 to-teal-800',
  supervisor: 'from-blue-600 to-blue-800',
  'area-manager': 'from-purple-600 to-purple-800',
};

const roleAccents = {
  guard: 'text-teal-300',
  supervisor: 'text-blue-300',
  'area-manager': 'text-purple-300',
};

export default function MobileHeader({
  title,
  subtitle,
  role,
  showNotification,
  notificationCount = 0,
  showBack,
  onBack,
}: MobileHeaderProps) {
  return (
    <div className={`bg-gradient-to-r ${roleColors[role]} px-4 pt-10 pb-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={onBack}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center cursor-pointer"
            >
              <i className="ri-arrow-left-line text-white text-lg"></i>
            </button>
          ) : (
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-shield-check-line text-white text-lg"></i>
            </div>
          )}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${roleAccents[role]}`}>
              {role === 'guard' ? 'Guard Portal' : role === 'supervisor' ? 'Supervisor Portal' : 'Area Manager Portal'}
            </p>
            <h1 className="text-white font-bold text-lg leading-tight">{subtitle || title}</h1>
          </div>
        </div>
        {showNotification && (
          <button className="relative w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center cursor-pointer">
            <i className="ri-notification-3-line text-white text-xl"></i>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}