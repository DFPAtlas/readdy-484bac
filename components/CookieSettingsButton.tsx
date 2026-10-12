 'use client';
export default function CookieSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event('quickguard:cookie-settings'))}
    className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">Cookie settings</button>;
}
