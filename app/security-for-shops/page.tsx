import UseCasePage from '@/components/UseCasePage';
import type { Metadata } from 'next';
import UseCaseSchema from '../security-for-building-sites/UseCaseSchema';

export const metadata: Metadata = {
  title: 'Security for Shops & Retail | Hire SIA Security Guards — QuickGuard',
  description: 'Hire SIA-licensed security guards for your shop or retail store directly through QuickGuard. Loss prevention, floor walking, overnight cover. No agency fees.',
  alternates: {
    canonical: 'https://quickguard.uk/security-for-shops',
  },
  openGraph: {
    title: 'Security for Shops & Retail | QuickGuard',
    description: 'Hire SIA-licensed security guards for your shop. Loss prevention, floor walking, overnight cover.',
    url: 'https://quickguard.uk/security-for-shops',
    siteName: 'QuickGuard',
    type: 'website',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20formal%20black%20uniform%20standing%20inside%20a%20bright%20modern%20retail%20clothing%20store%20with%20polished%20floors%20and%20elegant%20displays%2C%20calm%20and%20attentive%20posture%2C%20natural%20daylight%20streaming%20through%20large%20glass%20windows%20creating%20soft%20even%20illumination%2C%20clean%20minimalist%20interior%20design%20with%20neutral%20tones%20and%20subtle%20accent%20colours%2C%20left%20side%20of%20image%20features%20a%20clean%20pale%20background%20perfect%20for%20text%20overlay%2C%20professional%20corporate%20photography%20style%20with%20sharp%20realistic%20details%2C%20modern%20premium%20retail%20security%20aesthetic%2C%20high%20quality%20commercial%20photo%20composition&width=1200&height=630&seq=qg_retail_og_20260702&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard — Retail & Shop Security Guards UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security for Shops & Retail | QuickGuard',
    description: 'Hire SIA-licensed security guards for your shop. Loss prevention, floor walking, overnight cover.',
    images: ['https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20formal%20black%20uniform%20standing%20inside%20a%20bright%20modern%20retail%20clothing%20store%20with%20polished%20floors%20and%20elegant%20displays%2C%20calm%20and%20attentive%20posture%2C%20natural%20daylight%20streaming%20through%20large%20glass%20windows%20creating%20soft%20even%20illumination%2C%20clean%20minimalist%20interior%20design%20with%20neutral%20tones%20and%20subtle%20accent%20colours%2C%20left%20side%20of%20image%20features%20a%20clean%20pale%20background%20perfect%20for%20text%20overlay%2C%20professional%20corporate%20photography%20style%20with%20sharp%20realistic%20details%2C%20modern%20premium%20retail%20security%20aesthetic%2C%20high%20quality%20commercial%20photo%20composition&width=1200&height=630&seq=qg_retail_og_20260702&orientation=landscape'],
  },
};

const data = {
  slug: 'security-for-shops',
  title: 'Retail & Shop Security',
  headline: 'Retail Security Guards — Hire Direct, Pay Less',
  subheadline: 'Protect your stock, staff, and customers with verified SIA security guards. Book loss prevention officers and floor walkers for single shifts or ongoing cover.',
  heroImage: 'https://readdy.ai/api/search-image?query=Professional%20SIA-licensed%20security%20guard%20in%20formal%20black%20uniform%20standing%20inside%20a%20bright%20modern%20retail%20clothing%20store%20with%20polished%20floors%20and%20elegant%20displays%2C%20calm%20and%20attentive%20posture%2C%20natural%20daylight%20streaming%20through%20large%20glass%20windows%20creating%20soft%20even%20illumination%2C%20clean%20minimalist%20interior%20design%20with%20neutral%20tones%20and%20subtle%20accent%20colours%2C%20left%20side%20of%20image%20features%20a%20clean%20pale%20background%20perfect%20for%20text%20overlay%2C%20professional%20corporate%20photography%20style%20with%20sharp%20realistic%20details%2C%20modern%20premium%20retail%20security%20aesthetic%2C%20high%20quality%20commercial%20photo%20composition&width=1600&height=900&seq=qg_retail_hero_20260508&orientation=landscape',
  venueCategory: 'retail_shop',
  ctaLabel: 'Hire a Retail Guard',
  steps: [
    { icon: 'ri-file-list-line', title: 'Describe Your Store', desc: 'Tell us your shop address, opening hours, and the type of cover you need.' },
    { icon: 'ri-user-search-line', title: 'Guards See Your Job', desc: 'Verified security guards in your postcode area get instantly notified.' },
    { icon: 'ri-shield-check-line', title: 'Choose & Confirm', desc: 'Compare guard profiles, ratings, and experience. Pick the right fit.' },
    { icon: 'ri-lock-line', title: 'Held Job Payment', desc: 'Your payment is held safely with Stripe until the shift is completed successfully.' },
  ],
  faqs: [
    { q: 'Can I hire a guard for loss prevention specifically?', a: 'Yes. Many guards on QuickGuard specialise in retail loss prevention. You can mention this in your job description so the right guards apply.' },
    { q: 'Do guards have experience with shoplifters?', a: 'Most retail security guards have years of experience dealing with theft, aggressive behaviour, and difficult customers. Check their profile for retail-specific specialisations.' },
    { q: 'Can I book the same guard every week?', a: 'Absolutely. If a guard works well in your store, you can post recurring weekly shifts and invite them directly. Many retail clients build long-term relationships this way.' },
    { q: 'What if I only need cover for a few hours?', a: 'You set the shift length. Whether it is 4 hours or 12, you control the schedule and pay only for the time booked.' },
    { q: 'Is weekend and late-night cover available?', a: 'Yes. Guards set their own availability. When posting a job, you will only see guards who are free at the exact times you need.' },
  ],
  testimonialQuote: 'Our small boutique in Manchester had repeated stock loss issues. Through QuickGuard we found a guard who worked retail for 8 years. He cut our shrinkage by 70% in the first month. And we pay less than half what the agency charged.',
  testimonialAuthor: 'Priya K.',
  testimonialVenue: 'Boutique Owner, Manchester',
};

export default function ShopSecurityPage() {
  return (
    <>
      <UseCaseSchema
        title="Retail & Shop Security"
        slug="security-for-shops"
        description="Hire SIA-licensed security guards for your shop or retail store directly through QuickGuard. Loss prevention, floor walking, overnight cover."
      />
      <UseCasePage data={data} />
    </>
  );
}