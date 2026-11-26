import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import BuildingSitesHero from './BuildingSitesHero';
import BuildingSitesSequence from './BuildingSitesSequence';
import BuildingSitesDuties from './BuildingSitesDuties';
import BuildingSitesScope from './BuildingSitesScope';
import BuildingSitesFaq from './BuildingSitesFaq';
import BuildingSitesCta from './BuildingSitesCta';

interface Faq {
  q: string;
  a: string;
}

interface Props {
  heroImage: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  faqs: Faq[];
}

export default function BuildingSitesPage({ heroImage, headline, subheadline, ctaLabel, faqs }: Props) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      <BuildingSitesHero
        eyebrow="Building site security"
        headline={headline}
        subheadline={subheadline}
        heroImage={heroImage}
        ctaLabel={ctaLabel}
      />
      <BuildingSitesSequence />
      <BuildingSitesDuties />
      <BuildingSitesScope />
      <BuildingSitesFaq faqs={faqs} />
      <BuildingSitesCta ctaLabel={ctaLabel} />
      <Footer />
    </div>
  );
}