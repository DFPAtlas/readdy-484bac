export interface Guard {
  id: string;
  full_name: string;
  email: string;
  profile_image_url: string | null;
  location: string | null;
  postcode: string | null;
  years_experience: number | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  total_earnings: number | null;
  verification_status: string | null;
  profile_completed: boolean | null;
  subscription_status: string | null;
  accepts_direct_bookings: boolean | null;
  sia_licence_front_url: string | null;
  sia_expiry_date: string | null;
  licence_types: string[] | null;
  sia_licence_number: string | null;
  phone: string | null;
  sia_verified: boolean | null;
  is_active: boolean | null;
  home_latitude: number | null;
  home_longitude: number | null;
  dashboard_access: boolean | null;
}

export interface NestedJob {
  id: string;
  job_title: string;
  location: string;
  postcode: string;
  start_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  venue_city?: string;
  venue_postcode?: string;
  payment_status?: string;
}

export interface JobAssignment {
  id: string;
  status: string;
  payment_amount: number | null;
  payment_status: string | null;
  assigned_at: string;
  jobs: NestedJob;
}

export interface JobApplication {
  id: string;
  status: string;
  applied_at: string;
  jobs: NestedJob & { clients: { company_name: string } };
}

export interface AvailableJob {
  id: string;
  job_title: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  status: string;
  clients: { company_name: string };
  latitude: number | null;
  longitude: number | null;
}

export interface AvailableJobWithDistance extends AvailableJob {
  distanceMiles: number | null;
  distanceLabel: string;
}

export interface ClientResponse {
  id: string;
  response_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  jobs: { job_title: string } | null;
  clients: { company_name: string } | null;
}

export interface ShiftItem {
  id: string;
  source: 'application' | 'assignment';
  status: string;
  job_title: string;
  location: string;
  start_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  client_name: string;
  job_id: string;
}