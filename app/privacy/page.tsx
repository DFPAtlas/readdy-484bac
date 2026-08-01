'use client';

import NavSidebar from '../../components/NavSidebar';
import Footer from '../../components/Footer';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <section className="relative pt-32 pb-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center text-white">
          <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-keyhole-line text-3xl text-teal-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Privacy Policy</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            How we collect, use, and protect your personal information
          </p>
          <p className="text-sm text-slate-500 mt-4">
            Last updated: January 2024
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8">

            <div className="mb-12 p-6 bg-[#0e1628] border border-slate-700/50 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-4">Table of Contents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <ul className="space-y-2 text-sm">
                    <li><a href="#introduction" className="text-teal-400 hover:text-teal-300">1. Introduction</a></li>
                    <li><a href="#data-collection" className="text-teal-400 hover:text-teal-300">2. Data We Collect</a></li>
                    <li><a href="#google-oauth" className="text-teal-400 hover:text-teal-300">3. Google OAuth & Third-Party Login</a></li>
                    <li><a href="#how-we-use" className="text-teal-400 hover:text-teal-300">4. How We Use Your Data</a></li>
                    <li><a href="#legal-basis" className="text-teal-400 hover:text-teal-300">5. Legal Basis for Processing</a></li>
                    <li><a href="#data-sharing" className="text-teal-400 hover:text-teal-300">6. Data Sharing & Disclosure</a></li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-sm">
                    <li><a href="#data-retention" className="text-teal-400 hover:text-teal-300">7. Data Retention</a></li>
                    <li><a href="#your-rights" className="text-teal-400 hover:text-teal-300">8. Your Rights (UK GDPR)</a></li>
                    <li><a href="#cookies" className="text-teal-400 hover:text-teal-300">9. Cookies & Tracking</a></li>
                    <li><a href="#security" className="text-teal-400 hover:text-teal-300">10. Data Security</a></li>
                    <li><a href="#contact" className="text-teal-400 hover:text-teal-300">11. Contact Us</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none space-y-12">

              <section id="introduction">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  1. Introduction
                </h2>
                <p className="text-slate-400 mb-4">
                  QuickGuard.uk ("we", "our", "us") is committed to protecting and respecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our platform.
                </p>
                <div className="bg-teal-500/10 border border-teal-400/20 p-4 my-4 rounded-xl">
                  <p className="text-teal-400">
                    <strong className="text-teal-300">Data Controller:</strong> QuickGuard Ltd is the data controller responsible for your personal data. We are registered with the Information Commissioner's Office (ICO) under registration number ZA123456.
                  </p>
                </div>
                <p className="text-slate-400">
                  This policy applies to all users of our platform, including security guards ("Guards") and clients ("Clients") who use our services to connect and book security services across the United Kingdom.
                </p>
              </section>

              <section id="data-collection">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  2. Data We Collect
                </h2>

                <h3 className="text-xl font-semibold text-white mb-3">Information You Provide:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { icon: 'ri-user-line', color: 'text-teal-400', title: 'Account Information', items: ['Full name and contact details', 'Email address and phone number', 'Password (encrypted)', 'Profile photo'] },
                    { icon: 'ri-shield-check-line', color: 'text-teal-400', title: 'Verification Data (Guards)', items: ['SIA license number and details', 'Identity documents', 'Right to work documentation', 'Professional certifications'] },
                    { icon: 'ri-building-line', color: 'text-teal-400', title: 'Business Information (Clients)', items: ['Company name and registration', 'Business address', 'VAT number (if applicable)', 'Billing information'] },
                    { icon: 'ri-bank-card-line', color: 'text-teal-400', title: 'Payment Information', items: ['Payment card details (via Stripe)', 'Bank account details (Guards)', 'Transaction history', 'Billing address'] },
                  ].map((box) => (
                    <div key={box.title} className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        <i className={`${box.icon} ${box.color}`} />
                        {box.title}
                      </h4>
                      <ul className="text-sm text-slate-400 space-y-1">
                        {box.items.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Information Collected Automatically:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>Device information (browser type, operating system, device ID)</li>
                  <li>IP address and approximate location</li>
                  <li>Usage data (pages visited, features used, time spent)</li>
                  <li>Cookies and similar tracking technologies</li>
                  <li>Log data and error reports</li>
                </ul>
              </section>

              <section id="google-oauth">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  3. Google OAuth & Third-Party Login
                </h2>

                <div className="bg-teal-500/10 border border-teal-400/20 p-6 mb-6 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#0e1628] border border-teal-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className="ri-google-fill text-teal-400 text-2xl" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Sign in with Google</h3>
                      <p className="text-slate-400">
                        We offer Google Sign-In as a convenient authentication option. When you choose to sign in with Google:
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">What Data We Receive from Google:</h3>
                <p className="text-slate-400 mb-4">
                  When you choose to sign in with Google, we request access to the following information from your Google account:
                </p>

                <div className="space-y-4 mb-6">
                  {[
                    { icon: 'ri-mail-line', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-400/20', title: 'Email Address', text: 'We collect your Google email address to create your QuickGuard account, send you important notifications, and enable account recovery.', scope: 'userinfo.email' },
                    { icon: 'ri-user-line', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-400/20', title: 'Profile Information', text: 'We collect your name and profile picture from Google to personalize your QuickGuard profile and display your identity to other users when booking services.', scope: 'userinfo.profile' },
                  ].map((item) => (
                    <div key={item.title} className={`flex items-start gap-4 p-4 bg-[#0e1628] border rounded-xl ${item.bg}`}>
                      <div className={`w-10 h-10 bg-[#0B1933] rounded-full flex items-center justify-center flex-shrink-0`}>
                        <i className={`${item.icon} ${item.color} text-xl`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.title}</h4>
                        <p className="text-sm text-slate-400">{item.text}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          <strong className="text-slate-400">OAuth Scope:</strong> {item.scope}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">How We Use Google OAuth Data:</h3>
                <div className="space-y-3 mb-6">
                  {[
                    { title: 'Account Creation', text: 'Create your QuickGuard account without requiring a separate password' },
                    { title: 'Authentication', text: 'Verify your identity when you sign in to our platform' },
                    { title: 'Profile Setup', text: 'Pre-fill your name and profile picture to speed up registration' },
                    { title: 'Communication', text: 'Send you booking confirmations, job alerts, and important account updates' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <i className="ri-checkbox-circle-fill text-teal-400 text-xl flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-slate-400">
                          <strong className="text-slate-300">{item.title}:</strong> {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Important Information About Google OAuth:</h3>
                <div className="space-y-4">
                  <div className="bg-teal-500/10 border border-teal-400/20 p-4 rounded-xl">
                    <h4 className="font-semibold text-teal-400 mb-2 flex items-center gap-2">
                      <i className="ri-shield-check-line" />
                      What We DO:
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>✓ Only request the minimum data needed (email and basic profile)</li>
                      <li>✓ Store your Google data securely in our encrypted database</li>
                      <li>✓ Use your email only for QuickGuard-related communications</li>
                      <li>✓ Allow you to disconnect Google OAuth at any time</li>
                      <li>✓ Comply with Google's API Services User Data Policy</li>
                    </ul>
                  </div>

                  <div className="bg-red-500/10 border border-red-400/20 p-4 rounded-xl">
                    <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                      <i className="ri-close-circle-line" />
                      What We DO NOT Do:
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>✗ Access your Gmail, Google Drive, or other Google services</li>
                      <li>✗ Read, send, or delete your emails</li>
                      <li>✗ Access your Google Calendar or contacts</li>
                      <li>✗ Share your Google data with advertisers</li>
                      <li>✗ Use your Google data for purposes unrelated to QuickGuard</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl mt-6">
                  <h4 className="font-semibold text-white mb-2">Revoking Google OAuth Access</h4>
                  <p className="text-sm text-slate-400 mb-3">
                    You can revoke QuickGuard's access to your Google account at any time by visiting your Google Account settings.
                  </p>
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm">
                    <i className="ri-external-link-line" />
                    Manage Google Account Permissions
                  </a>
                </div>

                <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-xl mt-4">
                  <h4 className="font-semibold text-amber-400 mb-2">Google API Services User Data Policy</h4>
                  <p className="text-sm text-slate-400">
                    QuickGuard's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-400 mx-1">Google API Services User Data Policy</a>, including the Limited Use requirements.
                  </p>
                </div>
              </section>

              <section id="how-we-use">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  4. How We Use Your Data
                </h2>
                <p className="text-slate-400 mb-4">We use your personal data for the following purposes:</p>

                <div className="space-y-4">
                  {[
                    { icon: 'ri-check-line', color: 'text-teal-400', title: 'Service Delivery', text: 'To provide, maintain, and improve our platform services, process bookings, and facilitate connections between guards and clients.' },
                    { icon: 'ri-check-line', color: 'text-teal-400', title: 'Identity Verification', text: 'To verify SIA licenses, conduct background checks, and ensure all guards meet our professional standards.' },
                    { icon: 'ri-check-line', color: 'text-teal-400', title: 'Payment Processing', text: 'To process payments, manage held job payment services, handle refunds, and maintain financial records.' },
                    { icon: 'ri-check-line', color: 'text-teal-400', title: 'Communication', text: 'To send service updates, booking confirmations, security alerts, and respond to your enquiries.' },
                    { icon: 'ri-check-line', color: 'text-teal-400', title: 'Legal Compliance', text: 'To comply with legal obligations, prevent fraud, and protect the rights and safety of our users.' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-4 p-4 bg-[#0e1628] border border-slate-700/50 rounded-xl">
                      <div className="w-10 h-10 bg-teal-500/10 border border-teal-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className={`${item.icon} ${item.color} text-xl`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.title}</h4>
                        <p className="text-sm text-slate-400">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="legal-basis">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  5. Legal Basis for Processing
                </h2>
                <p className="text-slate-400 mb-4">
                  Under UK GDPR, we process your personal data based on the following legal grounds:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-teal-500/10 border-b border-teal-400/20">
                        <th className="p-3 text-left font-semibold text-teal-400">Legal Basis</th>
                        <th className="p-3 text-left font-semibold text-teal-400">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { basis: 'Contract Performance', purpose: 'Processing bookings, payments, and service delivery' },
                        { basis: 'Legal Obligation', purpose: 'SIA verification, tax records, fraud prevention' },
                        { basis: 'Legitimate Interests', purpose: 'Platform security, analytics, service improvement' },
                        { basis: 'Consent', purpose: 'Marketing communications, optional cookies' },
                      ].map((row, i) => (
                        <tr key={row.basis} className={`border-b border-slate-700/50 ${i % 2 === 1 ? 'bg-[#0e1628]/50' : ''}`}>
                          <td className="p-3 font-medium text-slate-300">{row.basis}</td>
                          <td className="p-3 text-slate-400">{row.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="data-sharing">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  6. Data Sharing & Disclosure
                </h2>
                <p className="text-slate-400 mb-4">We may share your personal data with:</p>

                <div className="space-y-4">
                  {[
                    { title: 'Service Providers', items: ['Stripe: Payment processing and financial services', 'Supabase: Database and authentication services', 'Google: OAuth authentication (only email and profile data)', 'SIA: License verification and compliance checks', 'Email providers: Transactional email delivery'] },
                    { title: 'Other Users', items: ['When you book a service, relevant information is shared between guards and clients to facilitate the booking (e.g., contact details, job location, service requirements).'] },
                    { title: 'Legal Requirements', items: ['We may disclose data to law enforcement, regulatory authorities, or courts when required by law or to protect our legal rights and the safety of our users.'] },
                  ].map((section) => (
                    <div key={section.title} className="border border-slate-700/50 rounded-xl p-4">
                      <h4 className="font-semibold text-white mb-2">{section.title}</h4>
                      <ul className="text-sm text-slate-400 space-y-1">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="bg-red-500/10 border border-red-400/20 p-4 rounded-xl mt-4">
                  <h4 className="font-semibold text-red-400 mb-2">We Never:</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Sell your personal data to third parties</li>
                    <li>• Share your Google OAuth data with advertisers</li>
                    <li>• Share data for unrelated marketing purposes</li>
                    <li>• Transfer data outside the UK/EEA without adequate safeguards</li>
                  </ul>
                </div>
              </section>

              <section id="data-retention">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  7. Data Retention
                </h2>
                <p className="text-slate-400 mb-4">
                  We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: 'ri-time-line', title: 'Active Accounts', text: 'Data retained while account is active plus 2 years after closure' },
                    { icon: 'ri-file-text-line', title: 'Financial Records', text: '7 years as required by UK tax law' },
                    { icon: 'ri-shield-check-line', title: 'Verification Documents', text: 'Duration of account plus 3 years' },
                    { icon: 'ri-chat-3-line', title: 'Support Communications', text: '2 years from last interaction' },
                  ].map((item) => (
                    <div key={item.title} className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`${item.icon} text-teal-400`} />
                        <h4 className="font-semibold text-white">{item.title}</h4>
                      </div>
                      <p className="text-sm text-slate-400">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="your-rights">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  8. Your Rights (UK GDPR)
                </h2>
                <p className="text-slate-400 mb-4">
                  Under UK GDPR, you have the following rights regarding your personal data:
                </p>

                <div className="space-y-3">
                  {[
                    { icon: 'ri-eye-line', title: 'Right of Access', text: 'Request a copy of your personal data we hold' },
                    { icon: 'ri-edit-line', title: 'Right to Rectification', text: 'Correct inaccurate or incomplete data' },
                    { icon: 'ri-delete-bin-line', title: 'Right to Erasure', text: 'Request deletion of your data ("right to be forgotten")' },
                    { icon: 'ri-pause-circle-line', title: 'Right to Restrict Processing', text: 'Limit how we use your data in certain circumstances' },
                    { icon: 'ri-download-line', title: 'Right to Data Portability', text: 'Receive your data in a machine-readable format' },
                    { icon: 'ri-close-circle-line', title: 'Right to Object', text: 'Object to processing based on legitimate interests' },
                    { icon: 'ri-settings-3-line', title: 'Rights Related to Automated Decisions', text: 'Not be subject to solely automated decision-making' },
                  ].map((right) => (
                    <div key={right.title} className="flex items-start gap-3 p-3 border border-slate-700/50 rounded-xl hover:bg-[#0e1628] transition-colors">
                      <div className="w-8 h-8 bg-teal-500/10 border border-teal-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`${right.icon} text-teal-400`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{right.title}</h4>
                        <p className="text-sm text-slate-400">{right.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-xl mt-6">
                  <h4 className="font-semibold text-amber-400 mb-2">How to Exercise Your Rights</h4>
                  <p className="text-sm text-slate-400">
                    To exercise any of these rights, please contact our Data Protection Officer at <a href="mailto:privacy@quickguard.uk" className="text-teal-400 hover:text-teal-300">privacy@quickguard.uk</a>. We will respond within 30 days.
                  </p>
                </div>
              </section>

              <section id="cookies">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  9. Cookies & Tracking
                </h2>
                <p className="text-slate-400 mb-4">
                  We use cookies and similar technologies to enhance your experience on our platform:
                </p>

                <div className="space-y-4">
                  {[
                    { color: 'border-green-500', title: 'Essential Cookies', text: 'Required for basic platform functionality, authentication, and security. Cannot be disabled.' },
                    { color: 'border-blue-500', title: 'Functional Cookies', text: 'Remember your preferences, language settings, and login status.' },
                    { color: 'border-purple-500', title: 'Analytics Cookies', text: 'Help us understand how users interact with our platform to improve services.' },
                    { color: 'border-orange-500', title: 'Marketing Cookies', text: 'Used to deliver relevant advertisements and measure campaign effectiveness.' },
                  ].map((cookie) => (
                    <div key={cookie.title} className={`border-l-4 ${cookie.color} pl-4`}>
                      <h4 className="font-semibold text-white">{cookie.title}</h4>
                      <p className="text-sm text-slate-400">{cookie.text}</p>
                    </div>
                  ))}
                </div>

                <p className="text-slate-400 mt-4">
                  You can manage your cookie preferences through your browser settings or our cookie consent banner.
                </p>
              </section>

              <section id="security">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  10. Data Security
                </h2>
                <p className="text-slate-400 mb-4">
                  We implement robust security measures to protect your personal data:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: 'ri-lock-line', color: 'text-green-400', bg: 'bg-green-500/10 border-green-400/20', title: 'Encryption', text: '256-bit SSL/TLS encryption for all data transmission' },
                    { icon: 'ri-server-line', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-400/20', title: 'Secure Storage', text: 'Data stored in UK/EU data centres with ISO 27001 certification' },
                    { icon: 'ri-shield-user-line', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-400/20', title: 'Access Controls', text: 'Strict access controls and regular security audits' },
                  ].map((item) => (
                    <div key={item.title} className="text-center p-6 bg-[#0e1628] border rounded-lg">
                      <div className={`w-14 h-14 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-3`}>
                        <i className={`${item.icon} ${item.color} text-2xl`} />
                      </div>
                      <h4 className="font-semibold text-white mb-2">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl mt-6">
                  <h4 className="font-semibold text-white mb-2">Data Breach Notification</h4>
                  <p className="text-sm text-slate-400">
                    In the unlikely event of a data breach that poses a risk to your rights and freedoms, we will notify you and the ICO within 72 hours as required by UK GDPR.
                  </p>
                </div>
              </section>

              <section id="contact">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  11. Contact Us
                </h2>
                <p className="text-slate-400 mb-4">
                  If you have any questions about this Privacy Policy or how we handle your data, please contact us:
                </p>

                <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
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
                      <h4 className="font-semibold text-teal-400 mb-3">Postal Address</h4>
                      <p className="text-slate-400">
                        QuickGuard Ltd<br />
                        Data Protection Officer<br />
                        123 Security Street<br />
                        London, EC1A 1AA<br />
                        United Kingdom
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/50">
                    <h4 className="font-semibold text-teal-400 mb-2">Supervisory Authority</h4>
                    <p className="text-sm text-slate-400">
                      You have the right to lodge a complaint with the Information Commissioner's Office (ICO) if you believe your data protection rights have been violated.
                    </p>
                    <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 mt-2 text-sm">
                      <i className="ri-external-link-line" />
                      Visit ICO Website
                    </a>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <p className="text-sm text-slate-500">
                  This Privacy Policy was last updated on January 2024.
                </p>
                <div className="flex gap-4">
                  <Link href="/terms" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors text-sm">
                    <i className="ri-file-text-line mr-2" />
                    Terms of Service
                  </Link>
                  <Link href="/contact" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors text-sm">
                    <i className="ri-mail-line mr-2" />
                    Contact Us
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