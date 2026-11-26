import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import IndustryHero from '@/components/industry/IndustryHero';
import IndustryProblems from '@/components/industry/IndustryProblems';
import IndustrySolutions from '@/components/industry/IndustrySolutions';
import IndustryRoles from '@/components/industry/IndustryRoles';
import IndustryFeatureBanner from '@/components/industry/IndustryFeatureBanner';
import IndustryFaq from '@/components/industry/IndustryFaq';
import IndustryCta from '@/components/industry/IndustryCta';
import type { IndustryData } from '@/components/industry/types';
import HotelDuties from './HotelDuties';
import HotelBookingSequence from './HotelBookingSequence';
import HotelCoverWindows from './HotelCoverWindows';
import HotelLicensingNote from './HotelLicensingNote';

type OwnedData = Omit<IndustryData, 'useCases' | 'complianceNote'>;

export default function HotelSecurityPage({ data }: { data: OwnedData }) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      <IndustryHero
        mediaSlot="hotel-security-hero"
        eyebrow={data.eyebrow}
        headline={data.headline}
        subheadline={data.subheadline}
        heroImage={data.heroImage}
        name={data.name}
        primaryCta={data.primaryCta}
        secondaryCta={data.secondaryCta}
      />
      <IndustryProblems title={data.problemsTitle} intro={data.problemsIntro} problems={data.problems} />
      <HotelDuties />
      <IndustrySolutions title={data.solutionsTitle} intro={data.solutionsIntro} solutions={data.solutions} />
      <IndustryRoles title={data.rolesTitle} intro={data.rolesIntro} roles={data.roles} />
      <HotelBookingSequence />
      <HotelCoverWindows />
      <IndustryFeatureBanner
        mediaSlot="hotel-security-feature"
        message={data.featureMessage}
        sub={data.featureSub}
        image={data.featureImage}
      />
      <HotelLicensingNote />
      <IndustryFaq faqs={data.faqs} />
      <IndustryCta
        headline="Ready to post a hotel requirement?"
        sub={data.subheadline}
        primaryCta={data.primaryCta}
        secondaryCta={data.secondaryCta}
        relatedLinks={data.relatedLinks}
      />
      <Footer />
    </div>
  );
}