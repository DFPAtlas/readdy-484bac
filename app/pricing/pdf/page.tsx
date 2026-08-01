import type { Metadata } from 'next';
import PricingPDFClient from './PricingPDFClient';

export const metadata: Metadata = {
  title: 'QuickGuard Pricing PDF',
  description: 'Download the complete QuickGuard pricing guide for clients and security guards.',
};

export default function PricingPDFPage() {
  return <PricingPDFClient />;
}