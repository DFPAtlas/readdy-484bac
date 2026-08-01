
'use client';

import { useMemo } from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '', bgColor: '' };

    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      longLength: password.length >= 12
    };

    if (checks.length) score++;
    if (checks.lowercase) score++;
    if (checks.uppercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    if (checks.longLength) score++;

    if (score <= 2) {
      return { score, label: 'Weak', color: 'text-red-600', bgColor: 'bg-red-500', checks };
    } else if (score <= 4) {
      return { score, label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-500', checks };
    } else {
      return { score, label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500', checks };
    }
  }, [password]);

  if (!password) return null;

  const percentage = (strength.score / 6) * 100;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${strength.bgColor} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${strength.color} min-w-[50px]`}>
          {strength.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className={`flex items-center gap-1.5 ${strength.checks?.length ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.length ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>8+ characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${strength.checks?.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.uppercase ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>Uppercase letter</span>
        </div>
        <div className={`flex items-center gap-1.5 ${strength.checks?.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.lowercase ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>Lowercase letter</span>
        </div>
        <div className={`flex items-center gap-1.5 ${strength.checks?.number ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.number ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>Number</span>
        </div>
        <div className={`flex items-center gap-1.5 ${strength.checks?.special ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.special ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>Special character</span>
        </div>
        <div className={`flex items-center gap-1.5 ${strength.checks?.longLength ? 'text-green-600' : 'text-gray-400'}`}>
          <i className={`${strength.checks?.longLength ? 'ri-check-line' : 'ri-close-line'} w-3 h-3 flex items-center justify-center`}></i>
          <span>12+ characters</span>
        </div>
      </div>
    </div>
  );
}
