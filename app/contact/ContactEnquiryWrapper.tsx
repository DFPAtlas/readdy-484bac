'use client';

import { useSearchParams } from 'next/navigation';
import ContactClient from './ContactClient';
import { getContactEnquiry } from '@/lib/contact-enquiry';

export default function ContactEnquiryWrapper() {
  const searchParams = useSearchParams();
  const enquiry = getContactEnquiry(searchParams?.get('subject'));

  return <ContactClient key={`${enquiry.subject}-${enquiry.category}`} initialEnquiry={enquiry} />;
}