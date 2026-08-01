import type { PostJobFormData } from './post-job-validation';

export function formatTimeForJob(time: string): string | null {
  if (!time) return null;
  const trimmed = time.trim();
  const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
  if (!timeRegex.test(trimmed)) return null;
  return trimmed.split(':').length === 2 ? `${trimmed}:00` : trimmed;
}

export function buildFullAddress(formData: PostJobFormData): string {
  return [formData.addressLine1, formData.city, formData.postcode, 'UK'].filter(Boolean).join(', ');
}

export function buildJobPayload(formData: PostJobFormData, clientId: string, geo: { latitude: number; longitude: number } | null) {
  return {
    client_id: clientId,
    job_title: formData.jobTitle.trim(),
    security_type: formData.securityType,
    job_description: formData.jobDescription.trim(),
    venue_name: formData.venue.trim(),
    venue_address_line1: formData.addressLine1.trim(),
    venue_address_line2: formData.addressLine2.trim() || null,
    venue_city: formData.city.trim(),
    venue_postcode: formData.postcode.trim(),
    number_of_guards: parseInt(formData.numberOfGuards),
    number_of_days: parseInt(formData.numberOfDays),
    start_date: formData.startDate,
    end_date: formData.endDate || formData.startDate,
    start_time: formatTimeForJob(formData.startTime),
    end_time: formatTimeForJob(formData.endTime),
    hourly_rate: parseFloat(formData.hourlyRate),
    sia_licence_required: formData.siaLicenceRequired === 'yes',
    required_licence_types: formData.specificLicences.length > 0 ? formData.specificLicences : null,
    uniform_required: formData.uniformRequired === 'yes',
    uniform_details: formData.uniformDetails.trim() || null,
    experience_level: formData.experienceLevel,
    dress_code: formData.dressCode.trim() || null,
    special_instructions: formData.specialInstructions.trim() || null,
    additional_requirements: formData.additionalRequirements.trim() || null,
    urgency: formData.urgency,
    contact_name: formData.contactName,
    contact_phone: formData.contactPhone,
    contact_email: formData.contactEmail,
    status: formData.publishAt && new Date(formData.publishAt) > new Date() ? 'draft' : 'open',
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    geocoded_at: geo ? new Date().toISOString() : null,
    repeat_pattern: formData.repeatShift === 'none' ? 'one-off' : formData.repeatShift,
    repeat_frequency: formData.repeatFrequency || null,
    repeat_end_date: formData.repeatEndDate || null,
    is_recurring: formData.repeatShift !== 'none',
    saved_site_id: formData.savedSiteId || null,
    publish_at: formData.publishAt ? new Date(formData.publishAt).toISOString() : null,
    expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    is_featured: formData.isFeatured,
    is_urgent: formData.isUrgent || formData.urgency === 'urgent' || formData.urgency === 'immediate',
    is_draft: formData.publishAt ? new Date(formData.publishAt) > new Date() : false,
    auto_close_on_expiry: formData.autoCloseOnExpiry,
    featured_until: formData.isFeatured && formData.featuredDuration
      ? new Date(Date.now() + parseInt(formData.featuredDuration) * 24 * 60 * 60 * 1000).toISOString()
      : null,
  };
}