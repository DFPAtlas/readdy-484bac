import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import IndustryHero from '@/components/industry/IndustryHero';
import IndustryProblems from '@/components/industry/IndustryProblems';
import IndustrySolutions from '@/components/industry/IndustrySolutions';
import IndustryRoles from '@/components/industry/IndustryRoles';
import IndustryExample from '@/components/industry/IndustryExample';
import IndustryFeatureBanner from '@/components/industry/IndustryFeatureBanner';
import IndustryFaq from '@/components/industry/IndustryFaq';
import IndustryCta from '@/components/industry/IndustryCta';
import EventCoverTiming from './EventCoverTiming';
import EventBookingSequence from './EventBookingSequence';
import EventCompliance from './EventCompliance';
import type { EventContent } from './eventContent';

export default function EventSecurityPage({ content }: { content: EventContent }) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      <IndustryHero
        mediaSlot={content.slug + '-hero'}
        eyebrow={content.eyebrow}
        headline={content.headline}
        subheadline={content.subheadline}
        heroImage={content.heroImage}
        name={content.name}
        primaryCta={content.primaryCta}
        secondaryCta={content.secondaryCta}
      />
      <IndustryProblems
        title={content.problemsTitle}
        intro={content.problemsIntro}
        problems={content.problems}
      />
      <IndustrySolutions
        title={content.solutionsTitle}
        intro={content.solutionsIntro}
        solutions={content.solutions}
      />
      <IndustryRoles title={content.rolesTitle} intro={content.rolesIntro} roles={content.roles} />
      <EventCoverTiming
        title={content.coverTitle}
        intro={content.coverIntro}
        tiers={content.coverTiers}
      />
      <IndustryExample example={content.example} />
      <IndustryFeatureBanner
        mediaSlot={content.slug + '-feature'}
        message={content.featureMessage}
        sub={content.featureSub}
        image={content.featureImage}
      />
      <EventBookingSequence
        title={content.bookingTitle}
        intro={content.bookingIntro}
        steps={content.bookingSteps}
      />
      <EventCompliance
        paragraphs={content.complianceParagraphs}
        points={content.compliancePoints}
        note={content.complianceNote}
      />
      <IndustryFaq faqs={content.faqs} />
      <IndustryCta
        headline="Ready to check your event requirement?"
        sub={content.subheadline}
        primaryCta={content.primaryCta}
        secondaryCta={content.secondaryCta}
        relatedLinks={content.relatedLinks}
      />
      <Footer />
    </div>
  );
}