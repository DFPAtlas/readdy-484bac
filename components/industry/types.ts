export interface IndustryCtaLink {
  label: string;
  href: string;
}

export interface IndustryCard {
  icon: string;
  title: string;
  desc: string;
}

export interface IndustryRole {
  icon: string;
  name: string;
  desc: string;
}

export interface IndustryUseCases {
  planned: string[];
  shortNotice: string[];
  emergency: string[];
}

export interface IndustryExample {
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  note?: string;
}

export interface IndustryFaq {
  q: string;
  a: string;
}

export interface IndustryData {
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  primaryCta: IndustryCtaLink;
  secondaryCta?: IndustryCtaLink;
  problemsTitle: string;
  problemsIntro: string;
  problems: IndustryCard[];
  solutionsTitle: string;
  solutionsIntro: string;
  solutions: IndustryCard[];
  rolesTitle: string;
  rolesIntro: string;
  roles: IndustryRole[];
  useCases: IndustryUseCases;
  example?: IndustryExample;
  featureMessage: string;
  featureSub: string;
  featureImage: string;
  complianceNote?: string;
  faqs: IndustryFaq[];
  relatedLinks: IndustryCtaLink[];
}