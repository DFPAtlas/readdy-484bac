'use client';

import NavSidebar from '../../components/NavSidebar';
import Footer from '../../components/Footer';
import Link from 'next/link';

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <section className="relative pt-32 pb-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center text-white">
          <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-check-line text-3xl text-teal-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Cookie Policy</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            How we use cookies, what they do, and how you can control them
          </p>
          <p className="text-sm text-slate-500 mt-4">
            Last updated: 18 June 2026
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8">

            <div className="mb-12 p-6 bg-[#0e1628] border border-slate-700/50 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-4">On This Page</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <ul className="space-y-2 text-sm">
                    <li><a href="#what-are-cookies" className="text-teal-400 hover:text-teal-300">1. What Are Cookies?</a></li>
                    <li><a href="#how-we-use" className="text-teal-400 hover:text-teal-300">2. How We Use Cookies</a></li>
                    <li><a href="#essential" className="text-teal-400 hover:text-teal-300">3. Strictly Necessary Cookies</a></li>
                    <li><a href="#functional" className="text-teal-400 hover:text-teal-300">4. Functional Cookies</a></li>
                    <li><a href="#analytics" className="text-teal-400 hover:text-teal-300">5. Analytics Cookies</a></li>
                    <li><a href="#marketing" className="text-teal-400 hover:text-teal-300">6. Marketing Cookies</a></li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-sm">
                    <li><a href="#third-party" className="text-teal-400 hover:text-teal-300">7. Third-Party Cookies</a></li>
                    <li><a href="#push-notifications" className="text-teal-400 hover:text-teal-300">8. Push Notifications</a></li>
                    <li><a href="#cookie-table" className="text-teal-400 hover:text-teal-300">9. Complete Cookie List</a></li>
                    <li><a href="#manage" className="text-teal-400 hover:text-teal-300">10. Managing Your Preferences</a></li>
                    <li><a href="#browser-controls" className="text-teal-400 hover:text-teal-300">11. Browser Controls</a></li>
                    <li><a href="#changes" className="text-teal-400 hover:text-teal-300">12. Changes to This Policy</a></li>
                    <li><a href="#contact" className="text-teal-400 hover:text-teal-300">13. Contact Us</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none space-y-12">

              <section id="what-are-cookies">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  1. What Are Cookies?
                </h2>
                <p className="text-slate-400 mb-4">
                  Cookies are small text files placed on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites work efficiently, remember your preferences, and provide information to the website owners.
                </p>
                <p className="text-slate-400 mb-4">
                  Cookies can be &quot;first-party&quot; (set by the website you are visiting) or &quot;third-party&quot; (set by a different domain). They can be &quot;session&quot; cookies (deleted when you close your browser) or &quot;persistent&quot; cookies (remain on your device until they expire or you delete them).
                </p>
                <p className="text-slate-400">
                  This policy explains what cookies QuickGuard uses, why we use them, how long they last, and how you can control them. It should be read alongside our <Link href="/privacy" className="text-teal-400 hover:text-teal-300 underline">Privacy Policy</Link>, which explains how we handle your personal data more broadly.
                </p>
              </section>

              <section id="how-we-use">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  2. How We Use Cookies
                </h2>
                <p className="text-slate-400 mb-4">
                  We use cookies for four purposes on our Platform. When you first visit, our cookie consent banner lets you choose which categories to allow:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { icon: 'ri-shield-check-line', color: 'text-green-400', bg: 'bg-green-500/10 border-green-400/20', title: 'Strictly Necessary', desc: 'Required for the Platform to function. These are always enabled and cannot be turned off.', always: true },
                    { icon: 'ri-settings-3-line', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-400/20', title: 'Functional', desc: 'Remember your preferences and choices to provide an enhanced, personalised experience.', always: false },
                    { icon: 'ri-bar-chart-line', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-400/20', title: 'Analytics', desc: 'Help us understand how visitors use the Platform through anonymous, aggregated data.', always: false },
                    { icon: 'ri-megaphone-line', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-400/20', title: 'Marketing', desc: 'Track your browsing across websites to display relevant advertising.', always: false },
                  ].map((cat) => (
                    <div key={cat.title} className={`${cat.bg} border p-4 rounded-xl`}>
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`${cat.icon} ${cat.color}`} />
                        <h4 className="font-semibold text-white text-sm">{cat.title}</h4>
                        {cat.always && (
                          <span className="px-2 py-0.5 bg-green-500/20 border border-green-400/30 rounded-full text-xs text-green-400">Always On</span>
                        )}
                        {!cat.always && (
                          <span className="px-2 py-0.5 bg-slate-500/20 border border-slate-400/30 rounded-full text-xs text-slate-400">Optional</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{cat.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-500/10 border border-teal-400/20 p-4 rounded-xl">
                  <p className="text-sm text-slate-400">
                    <strong className="text-teal-300">Important:</strong> We do not currently use any analytics or marketing cookies on our Platform. The options exist in our consent banner so you can make informed choices if we introduce them in the future. At present, only strictly necessary and functional cookies are active.
                  </p>
                </div>
              </section>

              <section id="essential">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-green-500/30 pb-2">
                  3. Strictly Necessary Cookies
                </h2>
                <p className="text-slate-400 mb-4">
                  These cookies are essential for the Platform to function securely and correctly. They enable core features such as user authentication, security, and session management. You cannot disable these cookies — the Platform would not work without them.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: 'ri-shield-keyhole-line',
                      title: 'Authentication & Session Management',
                      text: 'When you log in, Supabase (our authentication provider) sets a session token cookie that keeps you signed in across pages. This cookie contains a cryptographically signed JSON Web Token (JWT) that identifies your account and permissions. It expires when you log out or after the session timeout period.',
                      names: 'sb-{project-id}-auth-token, sb-{project-id}-auth-token-code-verifier',
                      duration: 'Session (expires on logout or timeout)',
                      domain: 'quickguard.uk (first-party)',
                    },
                    {
                      icon: 'ri-lock-line',
                      title: 'Security & CSRF Protection',
                      text: 'We use security tokens to prevent Cross-Site Request Forgery (CSRF) attacks. These tokens ensure that form submissions, payment requests, and other actions on our Platform genuinely come from you and not a malicious third-party site.',
                      names: 'CSRF token (embedded in page, not a persistent cookie)',
                      duration: 'Per-request (single-use tokens)',
                      domain: 'quickguard.uk (first-party)',
                    },
                    {
                      icon: 'ri-checkbox-circle-line',
                      title: 'Cookie Consent Storage',
                      text: 'When you make a choice on our cookie consent banner, we store your preferences in your browser\'s local storage so we can remember your decision and not show the banner again. This is stored locally on your device and is not transmitted to our servers.',
                      names: 'cookieConsent (localStorage key)',
                      duration: 'Persistent (until you clear browser data)',
                      domain: 'Stored locally on your device',
                    },
                    {
                      icon: 'ri-device-line',
                      title: 'Mobile Installation Reminder',
                      text: 'If you dismiss our mobile app installation prompt, we store this preference so we do not show it again on your current device.',
                      names: 'pwaPromptDismissed (localStorage key)',
                      duration: 'Persistent (until you clear browser data)',
                      domain: 'Stored locally on your device',
                    },
                  ].map((item) => (
                    <div key={item.title} className="bg-[#0e1628] border border-slate-700/50 rounded-xl p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-500/10 border border-green-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className={`${item.icon} text-green-400 text-xl`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{item.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">{item.text}</p>
                        </div>
                      </div>
                      <div className="ml-13 grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#111d35] p-3 rounded-lg">
                        <div>
                          <span className="text-xs text-slate-500 block">Cookie Names</span>
                          <span className="text-xs text-slate-300 font-mono">{item.names}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Duration</span>
                          <span className="text-xs text-slate-300">{item.duration}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Domain</span>
                          <span className="text-xs text-slate-300">{item.domain}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="functional">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-blue-500/30 pb-2">
                  4. Functional Cookies
                </h2>
                <p className="text-slate-400 mb-4">
                  Functional cookies allow the Platform to remember choices you make and provide enhanced, more personal features. These cookies are optional — you can decline them and the Platform will still work, but some convenience features may not be available.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: 'ri-sun-line',
                      title: 'Theme & Display Preferences',
                      text: 'If you switch between light and dark mode, your theme preference is stored locally so the correct theme is applied on your next visit.',
                      names: 'theme-preference (localStorage key)',
                      duration: 'Persistent (until you clear browser data)',
                      domain: 'Stored locally on your device',
                    },
                    {
                      icon: 'ri-dashboard-line',
                      title: 'Dashboard Layout Preferences',
                      text: 'If you customise your dashboard layout (such as collapsing or expanding panels, rearranging widgets, or setting default views), these preferences are stored to maintain your personalised layout across sessions.',
                      names: 'dashboard-layout-prefs (localStorage key)',
                      duration: 'Persistent (until you clear browser data)',
                      domain: 'Stored locally on your device',
                    },
                  ].map((item) => (
                    <div key={item.title} className="bg-[#0e1628] border border-slate-700/50 rounded-xl p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-500/10 border border-blue-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className={`${item.icon} text-blue-400 text-xl`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{item.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">{item.text}</p>
                        </div>
                      </div>
                      <div className="ml-13 grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#111d35] p-3 rounded-lg">
                        <div>
                          <span className="text-xs text-slate-500 block">Cookie Names</span>
                          <span className="text-xs text-slate-300 font-mono">{item.names}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Duration</span>
                          <span className="text-xs text-slate-300">{item.duration}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Domain</span>
                          <span className="text-xs text-slate-300">{item.domain}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="analytics">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-purple-500/30 pb-2">
                  5. Analytics Cookies
                </h2>
                <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500/10 border border-purple-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className="ri-information-line text-purple-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-slate-400 mb-3">
                        We do not currently use any analytics or tracking cookies on our Platform. We do not use Google Analytics, Facebook Pixel, Hotjar, Mixpanel, or any other third-party analytics service.
                      </p>
                      <p className="text-slate-400 mb-3">
                        We may introduce privacy-respecting analytics in the future to help us understand how the Platform is used and where we can improve. If we do, we will update this policy, add the specific cookie names and purposes to Section 9, and ask for your consent before setting any analytics cookies.
                      </p>
                      <p className="text-slate-400">
                        Any future analytics would use aggregated, anonymised data and would never track you across other websites or build a personal profile of your browsing habits.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section id="marketing">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-orange-500/30 pb-2">
                  6. Marketing Cookies
                </h2>
                <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 border border-orange-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className="ri-information-line text-orange-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-slate-400 mb-3">
                        We do not currently use any marketing, advertising, or targeting cookies on our Platform. We do not use Facebook Pixel, Google Ads, LinkedIn Insight Tag, retargeting pixels, or any third-party advertising networks.
                      </p>
                      <p className="text-slate-400 mb-3">
                        We do not track your browsing activity across other websites to serve you targeted advertisements. We do not build advertising profiles or share your data with ad networks.
                      </p>
                      <p className="text-slate-400">
                        If we introduce marketing cookies in the future, we will update this policy, provide specific details in Section 9, and ask for your explicit consent before setting any marketing cookies — as required by PECR.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section id="third-party">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  7. Third-Party Cookies
                </h2>
                <p className="text-slate-400 mb-4">
                  Some cookies on our Platform are set by third-party services that we use. These services have their own privacy and cookie policies:
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: 'ri-bank-card-line',
                      title: 'Stripe (Payment Processing)',
                      text: 'When you make a payment, Stripe may set cookies on their domain for fraud prevention, security, and to process your payment. These cookies are essential for secure payment processing. Stripe\'s use of cookies is governed by their own privacy and cookie policies.',
                      link: 'https://stripe.com/gb/privacy',
                      linkText: 'Stripe Privacy Policy',
                    },
                    {
                      icon: 'ri-robot-line',
                      title: 'Readdy AI (Chat Assistant)',
                      text: 'Our AI-powered chat assistant is provided by Readdy AI. The widget may set a session cookie to maintain your chat session while you browse the Platform. Readdy AI does not use these cookies for tracking or advertising purposes.',
                      link: 'https://readdy.ai/privacy',
                      linkText: 'Readdy AI Privacy Policy',
                    },
                    {
                      icon: 'ri-google-fill',
                      title: 'Google OAuth (Sign-In Only)',
                      text: 'If you choose to sign in with Google, Google may set cookies as part of the OAuth authentication flow. These cookies are controlled by Google and are subject to Google\'s privacy policy. QuickGuard does not receive or set these cookies — they operate entirely within the Google authentication domain.',
                      link: 'https://policies.google.com/privacy',
                      linkText: 'Google Privacy Policy',
                    },
                  ].map((item) => (
                    <div key={item.title} className="bg-[#0e1628] border border-slate-700/50 rounded-xl p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-teal-500/10 border border-teal-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className={`${item.icon} text-teal-400 text-xl`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{item.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">{item.text}</p>
                        </div>
                      </div>
                      <div className="ml-13">
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 text-sm underline">
                          {item.linkText} <i className="ri-external-link-line text-xs ml-1" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="push-notifications">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  8. Push Notifications
                </h2>
                <p className="text-slate-400 mb-4">
                  In addition to cookies, our Platform can send push notifications to your browser or device. While not technically cookies, push notifications involve storing data on your device and are covered by PECR consent requirements.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: 'ri-notification-3-line',
                      title: 'Browser Notification Permissions',
                      text: 'When you enable push notifications, your browser generates a unique subscription endpoint and encryption keys using the Web Push API. We store this subscription data in our database so we can send you job alerts, messages, application updates, and booking reminders. No notification content is stored by your browser vendor (e.g., Google, Apple) — only the delivery endpoint.',
                    },
                    {
                      icon: 'ri-smartphone-line',
                      title: 'Mobile Notification Permissions',
                      text: 'On mobile devices, push notifications are delivered through your device\'s operating system (iOS or Android). Both systems require explicit permission before any app can send notifications. You can manage these permissions at any time through your device settings.',
                    },
                    {
                      icon: 'ri-database-2-line',
                      title: 'Storage of Notification Tokens',
                      text: 'When you enable push notifications, we store the following in our database: your unique push subscription endpoint (a URL provided by your browser), encryption keys (p256dh and auth) used to secure notification content, your user ID, and your account role (Guard or Client). This data is encrypted at rest and is deleted when you disable notifications or close your account.',
                    },
                    {
                      icon: 'ri-toggle-line',
                      title: 'Managing Notification Preferences',
                      text: 'You can disable push notifications at any time through your notification settings page, or through your browser/device settings. When you disable notifications, your subscription data is automatically deleted from our database. You can also manage which types of notifications you receive (job alerts, messages, reminders) through your account settings.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-4 p-4 bg-[#0e1628] border border-slate-700/50 rounded-xl">
                      <div className="w-10 h-10 bg-teal-500/10 border border-teal-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className={`${item.icon} text-teal-400 text-xl`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.title}</h4>
                        <p className="text-sm text-slate-400">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="cookie-table">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  9. Complete Cookie List
                </h2>
                <p className="text-slate-400 mb-4">
                  The following table lists every cookie and local storage item used on our Platform, along with its purpose, type, duration, and whether it is first-party or third-party.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-teal-500/10 border-b border-teal-400/20">
                        <th className="p-3 text-left font-semibold text-teal-400">Name</th>
                        <th className="p-3 text-left font-semibold text-teal-400">Category</th>
                        <th className="p-3 text-left font-semibold text-teal-400">Purpose</th>
                        <th className="p-3 text-left font-semibold text-teal-400">Duration</th>
                        <th className="p-3 text-left font-semibold text-teal-400">Party</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'sb-*-auth-token', cat: 'Necessary', purpose: 'Supabase authentication session token — keeps you signed in', duration: 'Session', party: 'First-party' },
                        { name: 'sb-*-auth-token-code-verifier', cat: 'Necessary', purpose: 'PKCE code verifier for secure OAuth authentication flow', duration: 'Session', party: 'First-party' },
                        { name: 'cookieConsent', cat: 'Necessary', purpose: 'Stores your cookie consent preferences (localStorage)', duration: 'Persistent', party: 'First-party' },
                        { name: 'pwaPromptDismissed', cat: 'Necessary', purpose: 'Remembers if you dismissed the mobile install prompt (localStorage)', duration: 'Persistent', party: 'First-party' },
                        { name: 'theme-preference', cat: 'Functional', purpose: 'Stores your light/dark theme preference (localStorage)', duration: 'Persistent', party: 'First-party' },
                        { name: 'dashboard-layout-prefs', cat: 'Functional', purpose: 'Stores customised dashboard panel preferences (localStorage)', duration: 'Persistent', party: 'First-party' },
                        { name: 'Readdy AI session', cat: 'Necessary', purpose: 'Maintains chat assistant session during support conversations', duration: 'Session', party: 'Third-party (readdy.ai)' },
                        { name: 'Stripe cookies', cat: 'Necessary', purpose: 'Fraud prevention and secure payment processing', duration: 'Varies', party: 'Third-party (stripe.com)' },
                      ].map((row, i) => (
                        <tr key={i} className={`border-b border-slate-700/50 ${i % 2 === 1 ? 'bg-[#0e1628]/50' : ''}`}>
                          <td className="p-3 font-mono text-slate-300 text-xs">{row.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              row.cat === 'Necessary' ? 'bg-green-500/10 text-green-400 border border-green-400/20' : 'bg-blue-500/10 text-blue-400 border border-blue-400/20'
                            }`}>{row.cat}</span>
                          </td>
                          <td className="p-3 text-slate-400">{row.purpose}</td>
                          <td className="p-3 text-slate-400">{row.duration}</td>
                          <td className="p-3 text-slate-400">{row.party}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-teal-500/10 border border-teal-400/20 p-4 rounded-xl mt-4">
                  <p className="text-sm text-slate-400">
                    <strong className="text-teal-300">Note on localStorage:</strong> Items stored in localStorage are not technically cookies but serve a similar function. They are stored locally on your device and are never transmitted to our servers. Clearing your browser data will remove all localStorage items.
                  </p>
                </div>
              </section>

              <section id="manage">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  10. Managing Your Preferences
                </h2>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        icon: 'ri-check-double-line',
                        color: 'text-green-400',
                        bg: 'bg-green-500/10 border-green-400/20',
                        title: 'Accept All',
                        desc: 'Click "Accept All Cookies" on the consent banner to enable all cookie categories. This provides the fullest Platform experience with all features enabled.',
                        action: 'Available on first visit or via cookie settings button',
                      },
                      {
                        icon: 'ri-close-circle-line',
                        color: 'text-amber-400',
                        bg: 'bg-amber-500/10 border-amber-400/20',
                        title: 'Reject Non-Essential',
                        desc: 'Click "Essential Only" to accept only strictly necessary cookies. The Platform will still function but some preferences may not be remembered.',
                        action: 'Available on first visit or via cookie settings button',
                      },
                      {
                        icon: 'ri-settings-3-line',
                        color: 'text-blue-400',
                        bg: 'bg-blue-500/10 border-blue-400/20',
                        title: 'Customise',
                        desc: 'Click "Manage Preferences" to choose exactly which cookie categories to allow. You can toggle functional, analytics, and marketing cookies individually.',
                        action: 'Available on first visit or via cookie settings button',
                      },
                    ].map((opt) => (
                      <div key={opt.title} className={`${opt.bg} border p-5 rounded-xl text-center`}>
                        <div className="w-12 h-12 bg-[#0e1628] rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className={`${opt.icon} ${opt.color} text-2xl`} />
                        </div>
                        <h4 className="font-semibold text-white mb-2">{opt.title}</h4>
                        <p className="text-sm text-slate-400 mb-3">{opt.desc}</p>
                        <span className="text-xs text-slate-500">{opt.action}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className="ri-refresh-line text-teal-400 text-2xl" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-2">Changing Your Mind Later</h4>
                        <p className="text-sm text-slate-400 mb-3">
                          You can change your cookie preferences at any time by clicking the shield icon button in the bottom-left corner of any page on our Platform. This reopens the consent banner where you can update your choices.
                        </p>
                        <p className="text-sm text-slate-400">
                          Alternatively, you can clear all QuickGuard cookies and local storage through your browser settings. The next time you visit, the consent banner will appear again, allowing you to make a fresh choice.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="browser-controls">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  11. Browser Controls
                </h2>
                <p className="text-slate-400 mb-4">
                  Most web browsers allow you to control cookies through their settings. You can block all cookies, delete existing cookies, or set your browser to notify you when a cookie is set. Please note that blocking strictly necessary cookies will prevent the Platform from functioning correctly.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {[
                    { browser: 'Google Chrome', url: 'https://support.google.com/chrome/answer/95647', icon: 'ri-chrome-fill' },
                    { browser: 'Mozilla Firefox', url: 'https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer', icon: 'ri-firefox-fill' },
                    { browser: 'Apple Safari', url: 'https://support.apple.com/en-gb/guide/safari/sfri11471/mac', icon: 'ri-safari-fill' },
                    { browser: 'Microsoft Edge', url: 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09', icon: 'ri-edge-fill' },
                  ].map((b) => (
                    <a key={b.browser} href={b.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-[#0e1628] border border-slate-700/50 rounded-xl hover:border-teal-400/30 transition-colors">
                      <div className="w-10 h-10 bg-teal-500/10 border border-teal-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className={`${b.icon} text-teal-400 text-xl`} />
                      </div>
                      <div className="flex-1">
                        <span className="text-white text-sm">{b.browser}</span>
                      </div>
                      <i className="ri-external-link-line text-slate-500 text-sm" />
                    </a>
                  ))}
                </div>

                <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-xl">
                  <p className="text-sm text-slate-400">
                    <strong className="text-amber-400">Warning:</strong> Blocking all cookies on our Platform will prevent you from signing in, posting jobs, applying for work, processing payments, and using most Platform features. We recommend using our built-in cookie preferences manager rather than blanket browser blocking.
                  </p>
                </div>
              </section>

              <section id="changes">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  12. Changes to This Policy
                </h2>
                <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
                  <p className="text-slate-400 mb-3">
                    We may update this Cookie Policy from time to time to reflect changes in the cookies we use, new Platform features, or legal requirements. When we make material changes, we will:
                  </p>
                  <div className="space-y-2 text-slate-400 text-sm mb-3">
                    <p className="flex items-start gap-2">
                      <i className="ri-notification-3-line text-teal-400 flex-shrink-0 mt-0.5" />
                      Update the &quot;Last updated&quot; date at the top of this page.
                    </p>
                    <p className="flex items-start gap-2">
                      <i className="ri-refresh-line text-teal-400 flex-shrink-0 mt-0.5" />
                      Re-display the cookie consent banner on your next visit if we add new cookie categories.
                    </p>
                    <p className="flex items-start gap-2">
                      <i className="ri-mail-send-line text-teal-400 flex-shrink-0 mt-0.5" />
                      Notify registered users by email if the changes materially affect how cookies are used.
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">
                    We encourage you to review this page periodically. This Cookie Policy was last updated on 18 June 2026.
                  </p>
                </div>
              </section>

              <section id="contact">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  13. Contact Us
                </h2>

                <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl mb-6">
                  <p className="text-slate-400 mb-4">
                    If you have questions about this Cookie Policy, our use of cookies, or wish to exercise your data protection rights, please contact us:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-teal-400 mb-3">Data Protection Officer</h4>
                      <div className="space-y-2 text-slate-400">
                        <p className="flex items-center gap-2">
                          <i className="ri-mail-line" />
                          <a href="mailto:privacy@quickguard.uk" className="hover:text-teal-400">privacy@quickguard.uk</a>
                        </p>
                        <p className="flex items-center gap-2">
                          <i className="ri-phone-line" />
                          01992 217019
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-teal-400 mb-3">Regulator</h4>
                      <p className="text-slate-400 text-sm">
                        Information Commissioner&apos;s Office (ICO)<br />
                        <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 underline text-sm">ico.org.uk/make-a-complaint</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-teal-500/10 border border-teal-400/20 p-6 rounded-xl">
                  <h4 className="font-semibold text-teal-300 mb-3 text-lg">Legal Framework</h4>
                  <p className="text-sm text-slate-400">
                    This Cookie Policy complies with the Privacy and Electronic Communications Regulations 2003 (PECR), as amended in 2019 and 2021, which implement the EU ePrivacy Directive (2002/58/EC) in UK law. It should be read alongside our <Link href="/privacy" className="text-teal-400 hover:text-teal-300 underline">Privacy Policy</Link> and <Link href="/terms" className="text-teal-400 hover:text-teal-300 underline">Terms of Service</Link>.
                  </p>
                </div>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <p className="text-sm text-slate-500">
                  Last updated: 18 June 2026 &bull; QuickGuard Ltd, Registered in England and Wales
                </p>
                <div className="flex gap-4">
                  <Link href="/privacy" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors text-sm">
                    <i className="ri-shield-keyhole-line mr-2" />
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors text-sm">
                    <i className="ri-file-text-line mr-2" />
                    Terms of Service
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}