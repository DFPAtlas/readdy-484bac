'use client';

import { SITE_URL } from '@/lib/seo-helpers';

interface JobSchemaProps {
  job: {
    id: string;
    title: string;
    description: string | null;
    location: string;
    postcode?: string | null;
    hourly_rate: number;
    start_date: string;
    end_date?: string | null;
    created_at: string;
    sia_licence_required?: boolean;
    clients?: {
      company_name: string;
    } | null;
  };
}

export function JobPostingSchema({ job }: JobSchemaProps) {
  const validThrough = job.end_date || job.start_date;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": job.title,
    "description": job.description || `Security guard position in ${job.location}`,
    "identifier": {
      "@type": "PropertyValue",
      "name": "QuickGuard",
      "value": job.id
    },
    "datePosted": new Date(job.created_at).toISOString().split('T')[0],
    "validThrough": new Date(validThrough).toISOString(),
    "employmentType": "TEMPORARY",
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.clients?.company_name || "QuickGuard Client",
      "sameAs": SITE_URL
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location,
        "postalCode": job.postcode || undefined,
        "addressCountry": "GB"
      }
    },
    "baseSalary": {
      "@type": "MonetaryAmount",
      "currency": "GBP",
      "value": {
        "@type": "QuantitativeValue",
        "value": job.hourly_rate,
        "unitText": "HOUR"
      }
    },
    "industry": "Security Services",
    "occupationalCategory": "33-9032.00",
    "qualifications": job.sia_licence_required ? "SIA Licence Required" : undefined,
    "directApply": true
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface JobListSchemaProps {
  jobs: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string;
    postcode?: string | null;
    hourly_rate: number;
    start_date: string;
    end_date?: string | null;
    created_at: string;
    sia_licence_required?: boolean;
    clients?: {
      company_name: string;
    };
  }>;
}

export function JobListSchema({ jobs }: JobListSchemaProps) {
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": jobs.slice(0, 10).map((job, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "JobPosting",
        "title": job.title,
        "description": job.description || `Security guard position in ${job.location}`,
        "url": `${SITE_URL}/jobs/${job.id}`,
        "datePosted": new Date(job.created_at).toISOString().split('T')[0],
        "validThrough": new Date(job.end_date || job.start_date).toISOString(),
        "employmentType": "TEMPORARY",
        "hiringOrganization": {
          "@type": "Organization",
          "name": job.clients?.company_name || "QuickGuard Client",
          "sameAs": SITE_URL
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": job.location,
            "postalCode": job.postcode || undefined,
            "addressCountry": "GB"
          }
        },
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "GBP",
          "value": {
            "@type": "QuantitativeValue",
            "value": job.hourly_rate,
            "unitText": "HOUR"
          }
        }
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
    />
  );
}