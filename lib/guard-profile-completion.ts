interface GuardProfileFields {
  full_name?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
  location?: string | null;
  postcode?: string | null;
  years_experience?: number | null;
  sia_licence_front_url?: string | null;
}

/** Display progress only; identity approval and working eligibility are separate. */
export function guardProfileCompletion(guard: GuardProfileFields | null): number {
  if (!guard) return 0;
  const textFields = [guard.full_name, guard.email, guard.profile_image_url, guard.location, guard.postcode];
  const details = textFields.filter(value => typeof value === 'string' && value.trim()).length * 15;
  const experience = typeof guard.years_experience === 'number' && Number.isFinite(guard.years_experience)
    && guard.years_experience >= 0 ? 15 : 0;
  return details + experience + (guard.sia_licence_front_url?.trim() ? 10 : 0);
}
