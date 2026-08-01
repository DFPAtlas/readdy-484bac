'use client';

import NavSidebar from '../../components/NavSidebar';
import Footer from '../../components/Footer';
import Link from 'next/link';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <section className="relative pt-32 pb-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">Terms of Service</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Legal terms and conditions for using the QuickGuard platform
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
                    <li><a href="#agreement" className="text-teal-400 hover:text-teal-300">1. Agreement to Terms</a></li>
                    <li><a href="#platform" className="text-teal-400 hover:text-teal-300">2. Platform Description</a></li>
                    <li><a href="#registration" className="text-teal-400 hover:text-teal-300">3. User Registration</a></li>
                    <li><a href="#services" className="text-teal-400 hover:text-teal-300">4. Services & Booking</a></li>
                    <li><a href="#payments" className="text-teal-400 hover:text-teal-300">5. Payment Terms</a></li>
                    <li><a href="#stripe-tc" className="text-teal-400 hover:text-teal-300">6. Stripe Payment Terms</a></li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-sm">
                    <li><a href="#third-party" className="text-teal-400 hover:text-teal-300">7. Third-Party Services</a></li>
                    <li><a href="#conduct" className="text-teal-400 hover:text-teal-300">8. User Conduct</a></li>
                    <li><a href="#liability" className="text-teal-400 hover:text-teal-300">9. Liability & Insurance</a></li>
                    <li><a href="#privacy" className="text-teal-400 hover:text-teal-300">10. Privacy Policy</a></li>
                    <li><a href="#termination" className="text-teal-400 hover:text-teal-300">11. Termination</a></li>
                    <li><a href="#legal" className="text-teal-400 hover:text-teal-300">12. Legal Provisions</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none space-y-12">

              <section id="agreement">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  1. Agreement to Terms
                </h2>
                <p className="text-slate-400 mb-4">
                  By accessing and using QuickGuard.uk ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use our Platform.
                </p>
                <div className="bg-teal-500/10 border border-teal-400/20 p-4 my-4 rounded-xl">
                  <p className="text-teal-400">
                    <strong className="text-teal-300">Important:</strong> These Terms apply to both security guards ("Guards") and clients ("Clients") using our platform to connect and book security services.
                  </p>
                </div>
              </section>

              <section id="platform">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  2. Platform Description
                </h2>
                <p className="text-slate-400 mb-4">
                  QuickGuard.uk is an online platform that connects professional security guards with clients who require security services. We facilitate:
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Profile creation and verification for security guards</li>
                  <li>Job posting and booking system for clients</li>
                  <li>Secure payment processing and held job payment services</li>
                  <li>Rating and review system for quality assurance</li>
                  <li>Customer support and dispute resolution</li>
                </ul>
                <p className="text-slate-400">
                  QuickGuard.uk acts as an intermediary platform and does not directly provide security services.
                </p>
              </section>

              <section id="registration">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  3. User Registration
                </h2>
                <h3 className="text-xl font-semibold text-white mb-3">For Security Guards:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Must possess valid SIA (Security Industry Authority) license</li>
                  <li>Provide accurate identification and background verification</li>
                  <li>Maintain professional insurance coverage</li>
                  <li>Complete platform onboarding and training modules</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3">For Clients:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Provide valid business registration details</li>
                  <li>Verify payment method and billing information</li>
                  <li>Agree to platform booking and payment terms</li>
                  <li>Maintain accurate contact and location information</li>
                </ul>
              </section>

              <section id="services">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  4. Services & Booking
                </h2>
                <h3 className="text-xl font-semibold text-white mb-3">Service Categories:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { title: 'Event Security', text: 'Corporate events, private parties, concerts' },
                    { title: 'Retail Security', text: 'Store protection, loss prevention' },
                    { title: 'Construction Security', text: 'Site protection, equipment security' },
                    { title: 'Personal Protection', text: 'Executive protection, bodyguard services' },
                  ].map((cat) => (
                    <div key={cat.title} className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl">
                      <h4 className="font-semibold text-white mb-2">{cat.title}</h4>
                      <p className="text-sm text-slate-400">{cat.text}</p>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Booking Process:</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-400">
                  <li>Client posts job requirements and budget</li>
                  <li>Qualified guards submit proposals</li>
                  <li>Client reviews and selects preferred guard</li>
                  <li>Booking confirmed with payment held with Stripe</li>
                  <li>Service completed and payment released</li>
                </ol>
              </section>

              <section id="payments">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  5. Payment Terms
                </h2>
                <h3 className="text-xl font-semibold text-white mb-3">Platform Fees:</h3>
                <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-xl mb-4">
                  <ul className="space-y-2 text-slate-400">
                    <li><strong className="text-slate-300">Guard Subscription:</strong> Monthly fee for platform access</li>
                    <li><strong className="text-slate-300">Client Booking Fee:</strong> 5% of total booking value</li>
                    <li><strong className="text-slate-300">Payment Processing:</strong> 2.9% + £0.30 per transaction</li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Payment Schedule:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>Payment held with Stripe upon booking confirmation</li>
                  <li>Released to guard upon successful service completion</li>
                  <li>Refunds processed within 5-10 business days</li>
                  <li>Monthly subscription fees charged automatically</li>
                </ul>
              </section>

              <section id="stripe-tc">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  6. Stripe Payment Terms
                </h2>
                <p className="text-slate-400 mb-4">
                  All payments processed through QuickGuard.uk are handled by Stripe, Inc. and its affiliates ("Stripe"). By making a payment on our Platform, you agree to these Stripe-specific terms in addition to our general Payment Terms.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3">Payment Authorisation:</h3>
                <div className="bg-emerald-500/10 border border-emerald-400/20 p-4 rounded-xl mb-4">
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• You authorise Stripe to charge your nominated payment method for all fees, subscriptions, and bookings placed through the Platform</li>
                    <li>• For recurring subscriptions (guard membership and client plans), you authorise Stripe to automatically charge your payment method on each billing cycle</li>
                    <li>• You agree to provide current, complete, and accurate billing information and promptly update this information if it changes</li>
                    <li>• If automatic charging fails for any reason, we reserve the right to suspend your account until payment is successfully processed</li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Recurring Billing & Subscriptions:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Guard membership plans (£10, £20, £35/month) and client subscription plans (£49, £149/month) are billed automatically via Stripe on a recurring basis</li>
                  <li>Annual plans are charged once upfront for the 12-month period</li>
                  <li>You may cancel recurring subscriptions at any time through your account dashboard; cancellations take effect at the end of the current billing period</li>
                  <li>No partial refunds are issued for unused portions of a billing cycle unless required by law</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3">Refunds, Disputes & Chargebacks:</h3>
                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl mb-4">
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• Refund requests must be submitted to QuickGuard support within 30 days of the disputed charge</li>
                    <li>• Approved refunds are processed through Stripe and may take 5-10 business days to appear on your statement</li>
                    <li>• Chargebacks initiated directly with your bank may result in immediate account suspension pending investigation</li>
                    <li>• We reserve the right to dispute illegitimate chargebacks and provide Stripe with transaction evidence</li>
                    <li>• Excessive chargebacks may result in permanent account termination and referral to collections</li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Failed Payments & Retries:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>If a recurring payment fails, Stripe will automatically retry the charge according to their standard retry schedule</li>
                  <li>You will receive email notifications from both Stripe and QuickGuard regarding failed payments</li>
                  <li>Accounts with repeated failed payments may be downgraded to a free tier or suspended after 3 unsuccessful attempts</li>
                  <li>A £5 late payment fee may apply to accounts more than 7 days overdue</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3">Data Security & PCI Compliance:</h3>
                <div className="bg-purple-500/10 border border-purple-400/20 p-4 rounded-xl mb-4">
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• QuickGuard does not store your full credit or debit card details on our servers</li>
                    <li>• All card data is encrypted and processed through Stripe's PCI DSS Level 1 certified infrastructure</li>
                    <li>• Stripe handles all payment authentication, including 3D Secure where required by your bank</li>
                    <li>• You agree to Stripe's <a href="https://stripe.com/gb/legal/consumer" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400">Consumer Terms of Service</a> and <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400">Privacy Policy</a></li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Currency & VAT:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>All prices on QuickGuard.uk are displayed and charged in Pound Sterling (GBP)</li>
                  <li>VAT at the applicable UK rate is included in all displayed prices unless otherwise stated</li>
                  <li>International cards may be subject to foreign transaction fees charged by your card issuer; QuickGuard and Stripe do not control these fees</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3">Stripe Account Responsibility:</h3>
                <p className="text-slate-400 mb-4">
                  QuickGuard.uk relies on Stripe to process all financial transactions. While we maintain a commercial relationship with Stripe, we are not responsible for Stripe's service availability, processing errors, or changes to Stripe's own terms and policies. Any disputes regarding Stripe's core payment services should be directed to Stripe support in the first instance.
                </p>

                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl">
                  <p className="text-slate-400 text-sm">
                    <strong className="text-slate-300">Stripe Contact:</strong> For payment-specific issues, you may also contact Stripe directly at <a href="https://support.stripe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-400">support.stripe.com</a>. For platform-related billing questions, contact QuickGuard support at <a href="mailto:support@quickguard.uk" className="underline hover:text-teal-400">support@quickguard.uk</a>.
                  </p>
                </div>
              </section>

              <section id="third-party">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  7. Third-Party Services
                </h2>
                <p className="text-slate-400 mb-4">
                  QuickGuard.uk integrates with trusted third-party services to enhance your experience and provide secure, reliable functionality. By using our platform, you acknowledge and agree to our use of these services.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3">Authentication Services:</h3>
                <div className="bg-teal-500/10 border border-teal-400/20 p-4 rounded-xl mb-4">
                  <h4 className="font-semibold text-teal-400 mb-2">Google OAuth 2.0</h4>
                  <p className="text-slate-400 mb-3">
                    We offer Google Sign-In as a convenient authentication option. When you choose to sign in with Google:
                  </p>
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• We receive your email address and basic profile information (name, profile photo)</li>
                    <li>• This data is used solely for account creation, authentication, and platform communication</li>
                    <li>• We do not access your Gmail, Google Drive, Calendar, or other Google services</li>
                    <li>• You can revoke QuickGuard's access anytime via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-400">Google Account permissions</a></li>
                    <li>• By using Google Sign-In, you also agree to Google's <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-400">Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-400">Privacy Policy</a></li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Payment Processing:</h3>
                <div className="bg-emerald-500/10 border border-emerald-400/20 p-4 rounded-xl mb-4">
                  <h4 className="font-semibold text-emerald-400 mb-2">Stripe Payment Gateway</h4>
                  <p className="text-slate-400 mb-3">
                    All payment transactions are securely processed through Stripe, a PCI-compliant payment processor:
                  </p>
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• QuickGuard does not store your full credit card details on our servers</li>
                    <li>• Payment information is encrypted and handled by Stripe's secure infrastructure</li>
                    <li>• Stripe's services are subject to their <a href="https://stripe.com/gb/legal/consumer" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-400">Terms of Service</a></li>
                    <li>• Transaction data is processed in accordance with Stripe's <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-400">Privacy Policy</a></li>
                  </ul>
                  <p className="text-slate-400 mt-3 text-sm">
                    Full Stripe-specific terms are detailed in Section 6 above.
                  </p>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Data Storage & Infrastructure:</h3>
                <div className="bg-purple-500/10 border border-purple-400/20 p-4 rounded-xl mb-4">
                  <h4 className="font-semibold text-purple-400 mb-2">Supabase</h4>
                  <p className="text-slate-400 mb-3">
                    Our platform data is securely hosted on Supabase infrastructure:
                  </p>
                  <ul className="space-y-2 text-slate-400 text-sm">
                    <li>• User profiles, job postings, and platform data are stored on secure cloud servers</li>
                    <li>• Data is encrypted in transit and at rest</li>
                    <li>• Regular backups ensure data integrity and availability</li>
                    <li>• Compliant with UK GDPR and data protection regulations</li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Third-Party Responsibilities:</h3>
                <p className="text-slate-400 mb-4">
                  While we carefully select trusted service providers, QuickGuard is not responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>Third-party service outages or technical issues</li>
                  <li>Changes to third-party terms, policies, or pricing</li>
                  <li>Data breaches occurring within third-party systems (though we maintain contractual safeguards)</li>
                  <li>Third-party service discontinuation or feature changes</li>
                </ul>

                <div className="bg-[#0e1628] border border-slate-700/50 p-4 mt-4 rounded-xl">
                  <p className="text-slate-400">
                    <strong className="text-slate-300">Note:</strong> We will notify users of any significant changes to our third-party integrations that may affect your use of the platform or your data privacy.
                  </p>
                </div>
              </section>

              <section id="conduct">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  8. User Conduct
                </h2>
                <div className="bg-red-500/10 border border-red-400/20 p-4 rounded-xl mb-4">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">Prohibited Activities:</h3>
                  <ul className="space-y-1 text-slate-400 text-sm">
                    <li>• Providing false information or fraudulent documentation</li>
                    <li>• Circumventing platform booking and payment systems</li>
                    <li>• Harassment, discrimination, or unprofessional behavior</li>
                    <li>• Sharing login credentials or account access</li>
                    <li>• Posting inappropriate or offensive content</li>
                  </ul>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Professional Standards:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                  <li>Maintain professional appearance and conduct</li>
                  <li>Arrive punctually and prepared for assignments</li>
                  <li>Communicate effectively with all parties</li>
                  <li>Follow all relevant laws and regulations</li>
                  <li>Respect confidentiality and privacy</li>
                </ul>
              </section>

              <section id="liability">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  9. Liability & Insurance
                </h2>
                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Insurance Requirements:</h3>
                  <ul className="space-y-2 text-slate-400">
                    <li><strong className="text-slate-300">Guards:</strong> Must maintain professional liability insurance (minimum £1,000,000)</li>
                    <li><strong className="text-slate-300">Clients:</strong> Responsible for providing safe working environment</li>
                    <li><strong className="text-slate-300">Platform:</strong> Technology errors and omissions coverage</li>
                  </ul>
                </div>

                <p className="text-slate-400 mb-4">
                  <strong className="text-slate-300">Limitation of Liability:</strong> QuickGuard.uk acts as an intermediary platform and is not liable for disputes between guards and clients, service quality issues, or incidents occurring during security services.
                </p>
              </section>

              <section id="privacy">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  10. Privacy Policy
                </h2>
                <p className="text-slate-400 mb-4">
                  We are committed to protecting your privacy and personal data in accordance with UK GDPR regulations. Our comprehensive Privacy Policy covers:
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Data collection and processing practices</li>
                  <li>Cookie usage and tracking technologies</li>
                  <li>Third-party integrations and data sharing</li>
                  <li>User rights and data control options</li>
                  <li>Security measures and data protection</li>
                </ul>
                <p className="text-slate-400">
                  Full Privacy Policy available at: <Link href="/privacy" className="text-teal-400 hover:text-teal-300">QuickGuard.uk/privacy</Link>
                </p>
              </section>

              <section id="termination">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  11. Termination
                </h2>
                <h3 className="text-xl font-semibold text-white mb-3">Account Termination:</h3>
                <ul className="list-disc list-inside space-y-2 text-slate-400 mb-4">
                  <li>Users may terminate accounts at any time with 30 days notice</li>
                  <li>Platform may suspend accounts for Terms violations</li>
                  <li>Pending bookings must be completed before termination</li>
                  <li>Refunds processed according to cancellation policy</li>
                </ul>

                <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-xl">
                  <h3 className="text-lg font-semibold text-amber-400 mb-2">Suspension Conditions:</h3>
                  <ul className="space-y-1 text-slate-400 text-sm">
                    <li>• Repeated customer complaints or poor ratings</li>
                    <li>• Failure to maintain required licenses or insurance</li>
                    <li>• Violation of platform Terms of Service</li>
                    <li>• Fraudulent activity or misrepresentation</li>
                  </ul>
                </div>
              </section>

              <section id="tax-responsibility">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  12. Tax Responsibility
                </h2>
                <div className="bg-amber-500/10 border border-amber-400/20 p-5 rounded-xl mb-4">
                  <h3 className="text-lg font-semibold text-amber-400 mb-3">Important Legal Notice — Tax & Compliance</h3>
                  <p className="text-slate-400 mb-3">
                    QuickGuard is a marketplace platform that connects security guards with clients. QuickGuard is <strong className="text-white">not an employer</strong> of any guard, and <strong className="text-white">not responsible for paying</strong> or deducting any tax on behalf of guards or clients unless required by law.
                  </p>
                  <div className="space-y-2 text-slate-400 text-sm">
                    <div className="flex items-start gap-2">
                      <i className="ri-shield-user-line text-amber-400 mt-0.5 flex-shrink-0"></i>
                      <p><strong className="text-amber-300">Security Guards:</strong> You are responsible for reporting and paying your own Income Tax, National Insurance Contributions (NIC), VAT (if applicable), and any other taxes due on earnings received through QuickGuard. QuickGuard does not operate PAYE on your behalf.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="ri-building-line text-amber-400 mt-0.5 flex-shrink-0"></i>
                      <p><strong className="text-amber-300">Clients:</strong> You are responsible for your own business tax obligations including Corporation Tax, VAT, and any compliance requirements relating to contractor payments. Job payments made through QuickGuard are for guard services; only the platform service fee is QuickGuard revenue.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="ri-bank-line text-amber-400 mt-0.5 flex-shrink-0"></i>
                      <p><strong className="text-amber-300">QuickGuard:</strong> QuickGuard only collects platform service fees as its revenue. Funds held with Stripe for job payments are not QuickGuard revenue and are not subject to QuickGuard tax obligations. Stripe processes payments as a third-party processor and is not responsible for any user's tax obligations.</p>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">Stripe Processing Fees:</h3>
                <p className="text-slate-400 mb-4">
                  Stripe charges a processing fee for each transaction. Depending on your subscription plan, this fee may be paid by the client, deducted from the guard payout, shared between both parties, or absorbed by QuickGuard. Your specific plan terms will indicate who pays the Stripe fee. QuickGuard is not responsible for Stripe's fee structure changes.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3">VAT:</h3>
                <p className="text-slate-400 mb-4">
                  QuickGuard's platform service fee may be subject to UK VAT at the applicable rate. Guard services are provided by the guards directly; VAT obligations on those services are the guard's responsibility. VAT estimates shown in dashboards are indicative only and not a substitute for professional accounting advice.
                </p>

                <div className="bg-[#0e1628] border border-slate-700/50 p-4 rounded-xl">
                  <p className="text-sm text-slate-400">
                    <strong className="text-slate-300">Professional Advice:</strong> We strongly recommend that all guards and clients seek independent tax and accounting advice from a qualified professional (such as a UK accountant or HMRC-registered agent). Nothing in these Terms constitutes tax or legal advice.
                  </p>
                </div>
              </section>

              <section id="legal">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-teal-500/30 pb-2">
                  12. Legal Provisions
                </h2>
                <h3 className="text-xl font-semibold text-white mb-3">Governing Law:</h3>
                <p className="text-slate-400 mb-4">
                  These Terms are governed by the laws of England and Wales. Any disputes will be resolved through UK courts with jurisdiction in London.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3">Dispute Resolution:</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-400 mb-4">
                  <li>Initial resolution through platform customer support</li>
                  <li>Mediation through approved third-party service</li>
                  <li>Binding arbitration if mediation unsuccessful</li>
                  <li>Court proceedings as final resort</li>
                </ol>

                <h3 className="text-xl font-semibold text-white mb-3">Changes to Terms:</h3>
                <p className="text-slate-400">
                  We reserve the right to modify these Terms at any time. Users will be notified of significant changes via email and platform notifications. Continued use constitutes acceptance of updated Terms.
                </p>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="bg-[#0e1628] border border-slate-700/50 p-6 rounded-xl">
                <h3 className="text-xl font-semibold text-teal-400 mb-4">Questions About These Terms?</h3>
                <p className="text-slate-400 mb-4">
                  If you have any questions about these Terms of Service, please contact our legal team:
                </p>
                <div className="space-y-2 text-slate-400">
                  <p><strong className="text-slate-300">Email:</strong> legal@quickguard.uk</p>
                  <p><strong className="text-slate-300">Phone:</strong> 01992 217019</p>
                  <p><strong className="text-slate-300">Address:</strong> QuickGuard Legal Department, 123 Security Street, London, EC1A 1AA</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <Link href="/contact" className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors">
                    <i className="ri-mail-line mr-2" />
                    Contact Support Team
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