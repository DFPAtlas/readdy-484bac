import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IndustryHero from './IndustryHero';
import IndustryProblems from './IndustryProblems';
import IndustrySolutions from './IndustrySolutions';
import IndustryRoles from './IndustryRoles';
import IndustryUseCases from './IndustryUseCases';
import IndustryExample from './IndustryExample';
import IndustryFeatureBanner from './IndustryFeatureBanner';
import IndustryHowItWorks from './IndustryHowItWorks';
import IndustryCompliance from './IndustryCompliance';
import IndustryFaq from './IndustryFaq';
import IndustryCta from './IndustryCta';
import type { IndustryData } from './types';

export default function IndustryPage({ data }: { data: IndustryData }) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <Header />
      <IndustryHero
        eyebrow={data.eyebrow}
        headline={data.headline}
        subheadline={data.subheadline}
        heroImage={data.heroImage}
        name={data.name}
        primaryCta={data.primaryCta}
        secondaryCta={data.secondaryCta}
      />
      <IndustryProblems title={data.problemsTitle} intro={data.problemsIntro} problems={data.problems} />
      <IndustrySolutions title={data.solutionsTitle} intro={data.solutionsIntro} solutions={data.solutions} />
      <IndustryRoles title={data.rolesTitle} intro={data.rolesIntro} roles={data.roles} />
      <IndustryUseCases useCases={data.useCases} />
      {data.example && <IndustryExample example={data.example} />}
      <IndustryFeatureBanner message={data.featureMessage} sub={data.featureSub} image={data.featureImage} />
      <IndustryHowItWorks />
      <IndustryCompliance note={data.complianceNote} />
      <IndustryFaq faqs={data.faqs} />
      <IndustryCta
        headline={`Ready to get started?`}
        sub={data.subheadline}
        primaryCta={data.primaryCta}
        secondaryCta={data.secondaryCta}
        relatedLinks={data.relatedLinks}
      />
      <Footer />
    </div>
  );
}