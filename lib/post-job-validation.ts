export interface PostJobFormData {
  jobTitle: string;
  securityType: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  breakInfo: string;
  repeatShift: string;
  repeatFrequency: string;
  repeatEndDate: string;
  numberOfDays: string;
  numberOfGuards: string;
  siaLicenceRequired: string;
  specificLicences: string[];
  venue: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  siteContactName: string;
  siteContactPhone: string;
  siteInstructions: string;
  jobDescription: string;
  experienceLevel: string;
  uniformRequired: string;
  uniformDetails: string;
  drivingRequired: string;
  dressCode: string;
  specialInstructions: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  publishAt: string;
  expiresAt: string;
  isFeatured: boolean;
  isUrgent: boolean;
  autoCloseOnExpiry: boolean;
  featuredDuration: string;
  additionalRequirements: string;
  hourlyRate: string;
  savedSiteId: string;
  urgency: string;
}

export const stepFieldMap: Record<number, string[]> = {
  1: ['jobTitle', 'securityType', 'numberOfGuards', 'jobDescription'],
  2: ['venue', 'addressLine1', 'city', 'postcode'],
  3: ['startDate', 'endDate', 'startTime', 'endTime', 'numberOfDays'],
  4: ['experienceLevel', 'specificLicences'],
  5: ['hourlyRate', 'contactName', 'contactPhone', 'contactEmail'],
  6: ['publishAt', 'expiresAt'],
};

export function sanitiseTime(value: any): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
  return timeRegex.test(trimmed) ? trimmed : '';
}

export function getStepErrors(step: number, data: PostJobFormData): Record<string, string> {
  const newErrors: Record<string, string> = {};
  if (step === 1) {
    if (!data.jobTitle.trim()) newErrors.jobTitle = 'Job title is required';
    if (data.jobTitle.trim().length < 3 || data.jobTitle.trim().length > 160) newErrors.jobTitle = 'Job title must be between 3 and 160 characters';
    if (!data.securityType) newErrors.securityType = 'Job type is required';
    const numGuards = Number(data.numberOfGuards);
    if (!Number.isInteger(numGuards) || numGuards < 1 || numGuards > 100) {
      newErrors.numberOfGuards = 'Must be between 1 and 100';
    }
    if (data.jobDescription.trim().length < 10) newErrors.jobDescription = 'Describe the job in at least 10 characters';
    if (data.jobDescription.length > 500) newErrors.jobDescription = 'Max 500 characters';
  }
  if (step === 2) {
    if (!data.venue.trim()) newErrors.venue = 'Site name is required';
    if (data.venue.length > 255) newErrors.venue = 'Max 255 characters';
    if (!data.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
    if (!data.city.trim()) newErrors.city = 'City is required';
    if (!data.postcode.trim()) newErrors.postcode = 'Postcode is required';
    if (data.siteInstructions.length > 500) newErrors.siteInstructions = 'Max 500 characters';
  }
  if (step === 3) {
    if (!Number.isInteger(Number(data.numberOfDays)) || Number(data.numberOfDays) < 1 || Number(data.numberOfDays) > 365) newErrors.numberOfDays = 'Number of days must be between 1 and 365';
    if (!data.startDate || Number.isNaN(new Date(data.startDate).getTime())) newErrors.startDate = 'Start date is required';
    if (!data.endDate || Number.isNaN(new Date(data.endDate).getTime())) newErrors.endDate = 'End date is required';
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (!data.startTime) newErrors.startTime = 'Start time is required';
    if (!data.endTime) newErrors.endTime = 'End time is required';
    if (data.breakInfo.length > 255) newErrors.breakInfo = 'Max 255 characters';
  }
  if (step === 4) {
    if (data.siaLicenceRequired === 'yes' && data.specificLicences.length === 0) newErrors.specificLicences = 'Select at least one required SIA licence type';
    if (!data.experienceLevel) newErrors.experienceLevel = 'Experience level is required';
  }
  if (step === 5) {
    if (!data.hourlyRate) newErrors.hourlyRate = 'Hourly rate is required';
    const rate = parseFloat(data.hourlyRate);
    if (!Number.isFinite(rate) || rate < 10 || rate > 1000) newErrors.hourlyRate = 'Hourly rate must be between £10 and £1,000';
    if (!data.contactName.trim()) newErrors.contactName = 'Contact name is required';
    if (!data.contactPhone.trim()) newErrors.contactPhone = 'Contact phone is required';
    if (!data.contactEmail.trim()) newErrors.contactEmail = 'Contact email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.contactEmail && !emailRegex.test(data.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }
  }
  if (step === 6) {
    if (data.publishAt && Number.isNaN(new Date(data.publishAt).getTime())) newErrors.publishAt = 'Enter a valid publish date';
    if (data.expiresAt && Number.isNaN(new Date(data.expiresAt).getTime())) newErrors.expiresAt = 'Enter a valid expiry date';
    if (data.publishAt && data.expiresAt && new Date(data.expiresAt) <= new Date(data.publishAt)) newErrors.expiresAt = 'Expiry must be after publish time';
  }
  return newErrors;
}

export function validateAllSteps(data: PostJobFormData): { valid: boolean; firstInvalidStep: number | null; allErrors: Record<string, string> } {
  const allErrors: Record<string, string> = {};
  let firstInvalidStep: number | null = null;
  for (let step = 1; step <= 6; step++) {
    const stepErrors = getStepErrors(step, data);
    if (Object.keys(stepErrors).length > 0) {
      Object.assign(allErrors, stepErrors);
      if (!firstInvalidStep) firstInvalidStep = step;
    }
  }
  return { valid: !firstInvalidStep, firstInvalidStep, allErrors };
}