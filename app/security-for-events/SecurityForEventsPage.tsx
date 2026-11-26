import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import IndustryHero from '@/components/industry/IndustryHero';
import IndustryProblems from '@/components/industry/IndustryProblems';
import IndustrySolutions from '@/components/industry/IndustrySolutions';
import IndustryRoles from '@/components/industry/IndustryRoles';
import IndustryExample from '@/components/industry/IndustryExample';
import IndustryFaq from '@/components/industry/IndustryFaq';
import IndustryCta from '@/components/industry/IndustryCta';
import BookingSequence from './BookingSequence';
import LicensingScope from './LicensingScope';
import type { EventsContent } from './securityForEventsContent';

export default function SecurityForEventsPage({ content }: { content: EventsContent }) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      <IndustryHero
        mediaSlot="security-for-events-hero"
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
      <BookingSequence
        title={content.bookingTitle}
        intro={content.bookingIntro}
        steps={content.bookingSteps}
      />
      <IndustryExample example={content.example} />
      <LicensingScope
        title={content.complianceTitle}
        paragraphs={content.complianceParagraphs}
        points={content.compliancePoints}
        note={content.complianceNote}
      />
      <IndustryFaq faqs={content.faqs} />
      <IndustryCta
        headline={content.ctaHeadline}
        sub={content.ctaSub}
        primaryCta={content.primaryCta}
        secondaryCta={content.secondaryCta}
        relatedLinks={content.relatedLinks}
      />
      <Footer />
    </div>
  );
}