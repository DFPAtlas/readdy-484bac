
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type CookiePreferences = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
};

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      ...prefs,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    setPreferences(allAccepted);
    saveConsent(allAccepted);
  };

  const rejectNonEssential = () => {
    const essentialOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setPreferences(essentialOnly);
    saveConsent(essentialOnly);
  };

  const savePreferences = () => {
    saveConsent(preferences);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4 pointer-events-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full pointer-events-auto animate-slide-up">
        {!showPreferences ? (
          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-check-line text-2xl text-blue-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">We Value Your Privacy</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We use cookies to enhance your browsing experience, serve personalised content, and analyse our traffic. 
                  Under UK GDPR, we need your consent to use non-essential cookies.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={acceptAll}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Accept All Cookies
              </button>
              <button
                onClick={rejectNonEssential}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                Manage Preferences
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              By clicking "Accept All", you consent to our use of cookies. Read our{' '}
              <Link href="/privacy" prefetch={false} className="text-blue-600 hover:underline">Privacy Policy</Link> for more information.
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Cookie Preferences</h2>
              <button
                onClick={() => setShowPreferences(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl text-gray-500"></i>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <CookieCategory
                title="Strictly Necessary"
                description="Essential for the website to function. Cannot be disabled."
                checked={true}
                disabled={true}
                onChange={() => {}}
              />
              <CookieCategory
                title="Analytics Cookies"
                description="Help us understand how visitors interact with our website by collecting anonymous information."
                checked={preferences.analytics}
                disabled={false}
                onChange={(checked) => setPreferences({ ...preferences, analytics: checked })}
              />
              <CookieCategory
                title="Marketing Cookies"
                description="Used to track visitors across websites to display relevant advertisements."
                checked={preferences.marketing}
                disabled={false}
                onChange={(checked) => setPreferences({ ...preferences, marketing: checked })}
              />
              <CookieCategory
                title="Functional Cookies"
                description="Enable enhanced functionality and personalisation, such as remembering your preferences."
                checked={preferences.functional}
                disabled={false}
                onChange={(checked) => setPreferences({ ...preferences, functional: checked })}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={savePreferences}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Save Preferences
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Accept All
              </button>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function CookieCategory({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors ${
          disabled 
            ? 'bg-blue-600 cursor-not-allowed' 
            : checked 
              ? 'bg-blue-600' 
              : 'bg-gray-300'
        }`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}></div>
        </div>
      </label>
    </div>
  );
}
