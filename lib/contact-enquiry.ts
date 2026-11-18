export interface ContactEnquiry {
  subject: string;
  category: string;
}

const COMPANY_ENQUIRIES: Record<string, ContactEnquiry> = {
  'company-dashboard': { subject: 'Company dashboard assistance', category: 'Technical Issue' },
  'company-site-setup': { subject: 'Company site setup request', category: 'Client Support' },
  'company-staff-setup': { subject: 'Company staff setup request', category: 'Client Support' },
  'company-profile': { subject: 'Company profile change request', category: 'Client Support' },
  'company-notifications': { subject: 'Company notification settings enquiry', category: 'Technical Issue' },
  'company-security': { subject: 'Company account security assistance', category: 'Technical Issue' },
  'company-integrations': { subject: 'Company integration enquiry', category: 'Partnership' },
  'company-messages': { subject: 'Company messages assistance', category: 'Client Support' },
  'company-reports': { subject: 'Company reports enquiry', category: 'Client Support' },
  'company-billing': { subject: 'Company billing enquiry', category: 'Billing' },
};

// Query values select known support topics only; they never populate personal data.
export function getContactEnquiry(topic: unknown): ContactEnquiry {
  if (typeof topic === 'string' && Object.prototype.hasOwnProperty.call(COMPANY_ENQUIRIES, topic)) {
    return { ...COMPANY_ENQUIRIES[topic] };
  }
  return { subject: '', category: '' };
}
