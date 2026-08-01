'use client';

import Link from 'next/link';

export default function QGLaunchRewardsTermsPage() {
  return (
    <div className="min-h-screen bg-[#0B1933] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/qg-launch-rewards" className="inline-flex items-center gap-2 text-slate-400 hover:text-teal-400 text-sm mb-8 transition-colors cursor-pointer">
          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
          Back to Launch Rewards
        </Link>

        <h1 className="text-3xl font-bold mb-2">QG Launch Rewards Terms</h1>
        <p className="text-slate-400 mb-10">Last updated: July 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Programme Overview</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              QG Launch Rewards is QuickGuard&apos;s referral programme. It rewards verified QuickGuard users for referring genuine security guards and businesses to the platform. The programme is designed to help grow the QuickGuard network through trusted, verified connections.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. QG Tokens</h2>
            <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
              <p>QG Tokens are discount credits only. They are <strong>not</strong> a currency, cryptocurrency, stored value, or financial instrument.</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li>100 QG Tokens = £10 QuickGuard credit.</li>
                <li>Tokens have <strong className="text-slate-300">no cash value</strong>.</li>
                <li>Tokens <strong className="text-slate-300">cannot be withdrawn</strong> as money.</li>
                <li>Tokens <strong className="text-slate-300">cannot be transferred</strong> to another person or account.</li>
                <li>Tokens <strong className="text-slate-300">cannot be sold</strong>, traded, or exchanged for money or other assets.</li>
                <li>Tokens can only be used as discounts on approved QuickGuard services.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How Tokens Are Earned</h2>
            <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
              <p>Tokens are earned through single-level referrals:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li>250 QG Tokens per verified guard referral.</li>
                <li>500 QG Tokens per verified client referral.</li>
                <li>50 QG Tokens for completing your own profile (one-time).</li>
              </ul>
              <p className="text-slate-400 mt-2">Tokens only activate once the referred person creates a <strong className="text-slate-300">verified QuickGuard account</strong>. Unverified, incomplete, or rejected accounts do not earn tokens.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Single-Level Referrals Only</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              QG Launch Rewards is a single-level referral programme. You earn tokens only when someone you directly refer creates a verified account. You <strong>do not</strong> earn tokens from referrals made by people you referred. There are no multi-level, downline, or network-based rewards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. What Is a Verified Account?</h2>
            <div className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <p>A verified account means:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-slate-300">For guards:</strong> Complete profile with valid SIA licence verified by QuickGuard&apos;s admin team.</li>
                <li><strong className="text-slate-300">For clients:</strong> Complete business profile with verified contact information and admin approval.</li>
              </ul>
              <p>The verification process is managed by QuickGuard and decisions are final.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Fraud and Abuse</h2>
            <div className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <p>QuickGuard actively monitors for fraudulent activity. The following are prohibited:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Self-referrals (referring yourself).</li>
                <li>Creating fake, duplicate, or automated accounts.</li>
                <li>Using disposable or temporary email addresses.</li>
                <li>Sharing referral links with the intent to defraud.</li>
                <li>Any activity designed to artificially generate tokens.</li>
              </ul>
              <p className="text-slate-300">QuickGuard may <strong>reject, cancel, or claw back</strong> tokens obtained through fraudulent or abusive activity. Accounts involved in fraud may be suspended or terminated.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Token Redemption</h2>
            <div className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <p>Tokens can be used to reduce costs on:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>QuickGuard subscription plans.</li>
                <li>Job posting fees.</li>
                <li>Profile boosts and featured listings.</li>
                <li>Future QuickGuard platform credits.</li>
              </ul>
              <p>The maximum discount per transaction is capped (typically 50% of the invoice). The final redemption value is calculated securely by QuickGuard at checkout. Tokens already converted to credit at checkout are final and cannot be reversed unless the transaction is refunded according to standard QuickGuard refund policies.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Token Expiry</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Unless stated otherwise, approved QG Tokens expire 12 months after they are granted. You can view your token balance and any upcoming expirations in your rewards dashboard. Expired tokens are removed from your account and cannot be reinstated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Programme Changes</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              QuickGuard reserves the right to modify, pause, or terminate the QG Launch Rewards programme at any time, with or without notice. Changes to reward amounts, token value, redemption rules, or programme eligibility may be made at QuickGuard&apos;s discretion. Approved tokens already in your account are not removed without cause (such as fraud or programme termination).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Limitation of Liability</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              QG Tokens have no cash value and are not redeemable for money. QuickGuard is not liable for any loss of tokens due to account inactivity, programme changes, fraud detection, or programme termination. Participation in QG Launch Rewards is voluntary and does not create any financial entitlement or obligation.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1a2b4a]">
          <p className="text-slate-500 text-xs">
            QG Launch Rewards is operated by QuickGuard. For questions about the programme, contact support through your dashboard or email support@quickguard.uk.
          </p>
        </div>
      </div>
    </div>
  );
}