'use client';

import { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'What are QG Tokens?',
    a: 'QG Tokens are discount credits you earn through the QG Launch Rewards programme. They can be used to reduce your QuickGuard subscription costs, job posting fees, and other platform charges. Tokens have no cash value and cannot be withdrawn, transferred, sold, or exchanged for money.',
  },
  {
    q: 'How much are QG Tokens worth?',
    a: '100 QG Tokens = £10 QuickGuard credit. This means each token is worth approximately 10 pence in platform discounts. The exact conversion rate is applied by QuickGuard at checkout.',
  },
  {
    q: 'When do QG Tokens activate?',
    a: 'Tokens only become active once the person you referred creates a verified QuickGuard account. This means their profile must be complete, their identity verified, and (for guards) their SIA licence confirmed. No tokens are granted for unverified accounts.',
  },
  {
    q: 'Can I withdraw or transfer QG Tokens?',
    a: 'No. QG Tokens are discount credits only. They cannot be withdrawn as cash, transferred to another user, sold, traded, or exchanged for money. They exist exclusively to reduce your QuickGuard platform costs.',
  },
  {
    q: 'How does the referral programme work?',
    a: 'After creating your QuickGuard account, you get a unique referral link. Share this link with other security professionals or businesses. When they create a verified QuickGuard account, you earn QG Tokens. 250 tokens per verified guard and 500 tokens per verified client.',
  },
  {
    q: 'What happens if a referral is fake or fraudulent?',
    a: 'QuickGuard actively monitors for fake accounts, duplicate registrations, and self-referrals. We may reject, cancel, or claw back tokens gained through fraudulent activity. All referrals must be genuine people or businesses with verified QuickGuard accounts.',
  },
  {
    q: 'Can I earn tokens from referrals made by people I referred?',
    a: 'No. QG Launch Rewards is a single-level referral programme. You only earn tokens when someone you directly refer creates a verified account. You do not earn from referrals made by people you referred.',
  },
  {
    q: 'Do QG Tokens expire?',
    a: 'Yes. QG Tokens normally expire 12 months after they are approved, unless stated otherwise. You can see your token expiry dates in your rewards dashboard. Tokens already converted to credit at checkout are not affected.',
  },
  {
    q: 'Can the programme terms change?',
    a: 'QuickGuard reserves the right to modify, pause, or end the QG Launch Rewards programme at any time. Any changes will be communicated through the platform. Approved tokens already in your account will not be removed without cause.',
  },
  {
    q: 'Can QG Tokens be saved before I create an account?',
    a: 'Yes. If you receive a QuickGuard invite or earn launch rewards before creating an account, QG Tokens can be held against your email address. When you create a QuickGuard account using the same email, your eligible QG Tokens will be linked to your rewards dashboard. Tokens become usable after your account is verified.',
  },
  {
    q: 'Where can I use QG Tokens?',
    a: 'QG Tokens can be applied as discounts on QuickGuard subscriptions, job posting fees, profile boosts, featured listings, and future QuickGuard platform credits. The maximum discount per transaction is set by QuickGuard and shown at checkout.',
  },
];

export default function QGLaunchRewardsFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div key={i} className="bg-[#111d35] border border-[#1a2b4a] rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer hover:bg-[#1a2b4a]/50 transition-colors"
          >
            <span className="text-white text-sm font-semibold pr-8">{faq.q}</span>
            <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}>
              <i className="ri-arrow-down-s-line text-teal-400 text-base"></i>
            </div>
          </button>
          {openIndex === i && (
            <div className="px-5 pb-4">
              <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}