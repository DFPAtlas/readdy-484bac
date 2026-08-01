'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import PortalSidebar from '@/components/PortalSidebar';
import Link from 'next/link';

interface Template {
  id: string;
  template_name: string;
  job_title: string;
  security_type: string;
  venue: string;
  city: string;
  hourly_rate: string;
  use_count: number;
  created_at: string;
  number_of_guards: number;
  start_time: string;
  end_time: string;
  sia_licence_required: string;
  specific_licences: string[];
  experience_level: string;
  uniform_required: string;
  uniform_details: string;
  dress_code: string;
  special_instructions: string;
  additional_requirements: string;
  urgency: string;
  job_description: string;
  address_line1: string;
  address_line2: string;
  postcode: string;
  number_of_days: string;
}

interface BuiltInTemplate {
  id: string;
  category: string;
  template_name: string;
  job_title: string;
  security_type: string;
  venue: string;
  address_line1: string;
  city: string;
  postcode: string;
  hourly_rate: string;
  number_of_guards: number;
  number_of_days: string;
  start_time: string;
  end_time: string;
  description: string;
  urgency: string;
  sia_licence_required: string;
  specific_licences: string[];
  experience_level: string;
  uniform_required: string;
  uniform_details: string;
  dress_code: string;
  special_instructions: string;
  additional_requirements: string;
  job_description: string;
  address_line2: string;
  icon: string;
  color: string;
}

const securityTypeLabels: Record<string, string> = {
  'door-supervisor': 'Door Supervisor',
  'event-security': 'Event Security',
  'retail-security': 'Retail Security',
  'close-protection': 'Close Protection',
  'cctv-operator': 'CCTV Operator',
  'security-guard': 'Security Guard',
  'mobile-patrol': 'Mobile Patrol',
  'key-holding': 'Key Holding',
  'dog-handler': 'Dog Handler',
};

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'builtin-nightclub-ds',
    category: 'Nightlife',
    template_name: 'Nightclub Door Supervisor',
    job_title: 'Door Supervisor - Weekend Nights',
    security_type: 'door-supervisor',
    venue: 'The Vault Nightclub',
    address_line1: '14-16 Berwick Street, Soho',
    address_line2: 'Soho',
    city: 'London',
    postcode: 'W1F 0PP',
    hourly_rate: '16.50',
    number_of_guards: 3,
    number_of_days: '2',
    start_time: '21:00',
    end_time: '04:00',
    description: 'Friday and Saturday night door supervision at a busy central London nightclub. Capacity management, ID checking, conflict resolution, and maintaining a safe environment for 500+ patrons.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Door Supervisor'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Black suit, white shirt, black tie provided',
    dress_code: 'Black suit with white shirt and black tie — smart professional appearance',
    special_instructions: 'Must have conflict management training. Experience with NightSafe scheme preferred. Radio comms provided on shift.',
    additional_requirements: 'First Aid at Work certificate desirable. Must be physically fit to handle crowd situations.',
    job_description: 'Manage club entrance, verify IDs, maintain crowd safety, handle ejections professionally, and coordinate with venue management throughout the night.',
    icon: 'ri-vip-crown-line',
    color: 'violet',
  },
  {
    id: 'builtin-retail-sg',
    category: 'Retail',
    template_name: 'Retail Security Guard',
    job_title: 'Security Guard - Shopping Centre',
    security_type: 'retail-security',
    venue: 'Westfield Stratford City',
    address_line1: 'Montfichet Road, Olympic Park',
    address_line2: 'Stratford',
    city: 'London',
    postcode: 'E20 1EJ',
    hourly_rate: '13.75',
    number_of_guards: 2,
    number_of_days: '5',
    start_time: '08:00',
    end_time: '18:00',
    description: 'Weekday retail security cover at one of the UK\'s largest shopping centres. Store patrol, theft prevention, customer assistance, and incident reporting.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'entry',
    uniform_required: 'yes',
    uniform_details: 'Branded polo shirt and jacket provided, black trousers',
    dress_code: 'Branded uniform top with smart black trousers and black shoes',
    special_instructions: 'Must be comfortable with CCTV monitoring and radio use. Customer-facing role — excellent communication skills required.',
    additional_requirements: 'Previous retail security experience preferred. DBS check required.',
    job_description: 'Patrol retail units and common areas, deter theft, assist shoppers, respond to incidents, complete daily activity logs, and liaise with centre management.',
    icon: 'ri-shopping-bag-line',
    color: 'blue',
  },
  {
    id: 'builtin-event-security',
    category: 'Events',
    template_name: 'Event Security Steward',
    job_title: 'Event Security — Outdoor Music Festival',
    security_type: 'event-security',
    venue: 'Victoria Park',
    address_line1: 'Grove Road, Bow',
    address_line2: 'Tower Hamlets',
    city: 'London',
    postcode: 'E3 5TB',
    hourly_rate: '15.00',
    number_of_guards: 8,
    number_of_days: '3',
    start_time: '10:00',
    end_time: '23:00',
    description: 'Three-day outdoor music festival requiring security stewards for crowd management, entry screening, stage pit safety, and emergency response coordination.',
    urgency: 'urgent',
    sia_licence_required: 'yes',
    specific_licences: ['Door Supervisor', 'Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Hi-vis festival vest provided, dark clothing underneath',
    dress_code: 'Dark trousers and dark polo/shirt with hi-vis vest provided',
    special_instructions: 'Must be available all 3 days. Festival experience preferred. Briefing at 9am each day. Meals provided.',
    additional_requirements: 'First Aid trained guards prioritised. Crowd management experience essential for pit roles.',
    job_description: 'Bag searches at entry points, crowd monitoring across festival grounds, stage-front pit safety, emergency evacuation support, and attendee assistance.',
    icon: 'ri-music-line',
    color: 'amber',
  },
  {
    id: 'builtin-construction-night',
    category: 'Construction',
    template_name: 'Construction Site Night Watch',
    job_title: 'Night Security — Construction Site',
    security_type: 'mobile-patrol',
    venue: 'Kings Cross Development Zone',
    address_line1: '2 York Way, Kings Cross',
    address_line2: 'Kings Cross',
    city: 'London',
    postcode: 'N1C 4AZ',
    hourly_rate: '14.00',
    number_of_guards: 2,
    number_of_days: '7',
    start_time: '19:00',
    end_time: '07:00',
    description: 'Overnight security for a large construction site. Perimeter patrol, access control, plant and materials monitoring, and incident logging across a 2-hectare site.',
    urgency: 'immediate',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'experienced',
    uniform_required: 'yes',
    uniform_details: 'Hi-vis jacket, hard hat, and steel-toe boots provided on site',
    dress_code: 'Warm dark clothing, site PPE provided, must wear steel-toe boots',
    special_instructions: 'Full site induction on first shift. Must maintain regular patrol log every 60 minutes. Site office has heating and facilities.',
    additional_requirements: 'Must have valid driving licence for site vehicle. Previous construction site security experience required.',
    job_description: 'Conduct hourly perimeter patrols, monitor site entry/exit, check plant and machinery, maintain detailed patrol logs, respond to alarms, and report incidents.',
    icon: 'ri-building-4-line',
    color: 'orange',
  },
  {
    id: 'builtin-corporate-reception',
    category: 'Corporate',
    template_name: 'Corporate Reception Security',
    job_title: 'Security Receptionist — Office Building',
    security_type: 'security-guard',
    venue: 'Canary Wharf Tower',
    address_line1: 'One Canada Square, Canary Wharf',
    address_line2: 'Canary Wharf',
    city: 'London',
    postcode: 'E14 5AB',
    hourly_rate: '15.50',
    number_of_guards: 1,
    number_of_days: '5',
    start_time: '07:00',
    end_time: '19:00',
    description: 'Front-of-house security reception at a prestigious Canary Wharf office. Visitor management, access badge issuing, CCTV monitoring, and reception duties.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Corporate blazer and name badge provided, white shirt, smart trousers',
    dress_code: 'Corporate attire — blazer provided, white collared shirt, smart trousers, polished shoes',
    special_instructions: 'Reception-based role combining security and front-of-house. Must be polished and well-presented. Visitor management system training provided.',
    additional_requirements: 'Excellent communication skills essential. Previous corporate reception or concierge experience preferred.',
    job_description: 'Manage visitor check-in, issue access badges, monitor CCTV feeds, answer reception phone, coordinate with building management, and maintain visitor logs.',
    icon: 'ri-building-line',
    color: 'teal',
  },
  {
    id: 'builtin-cctv-operator',
    category: 'Control Room',
    template_name: 'CCTV Control Room Operator',
    job_title: 'CCTV Operator — 24/7 Monitoring Centre',
    security_type: 'cctv-operator',
    venue: 'Metro Security Control Centre',
    address_line1: '4 Exchange Quay, Salford',
    address_line2: 'Salford Quays',
    city: 'Manchester',
    postcode: 'M5 3EF',
    hourly_rate: '14.25',
    number_of_guards: 2,
    number_of_days: '7',
    start_time: '08:00',
    end_time: '20:00',
    description: 'Day-shift CCTV monitoring across multiple client sites. Remote surveillance, alarm response, incident recording, and emergency service coordination.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['CCTV Operator'],
    experience_level: 'entry',
    uniform_required: 'no',
    uniform_details: '',
    dress_code: 'Smart casual — no uniform required. Office-based control room environment.',
    special_instructions: 'Full training on monitoring systems provided. Must be comfortable with multi-screen setups and rapid incident logging.',
    additional_requirements: 'SIA CCTV licence essential. Computer literate. Attention to detail critical.',
    job_description: 'Monitor multiple CCTV feeds across client sites, log incidents, respond to alarm activations, coordinate with mobile response teams, and complete shift handover reports.',
    icon: 'ri-camera-line',
    color: 'slate',
  },
  {
    id: 'builtin-hotel-night',
    category: 'Hospitality',
    template_name: 'Hotel Night Security Concierge',
    job_title: 'Night Security & Concierge — Luxury Hotel',
    security_type: 'security-guard',
    venue: 'The Grand Mayfair Hotel',
    address_line1: '25 Park Lane, Mayfair',
    address_line2: 'Mayfair',
    city: 'London',
    postcode: 'W1K 1RA',
    hourly_rate: '15.00',
    number_of_guards: 1,
    number_of_days: '5',
    start_time: '22:00',
    end_time: '06:00',
    description: 'Night security and concierge at a 5-star Mayfair hotel. Guest safety, access control, luggage assistance, and overnight building security patrol.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Hotel concierge uniform provided — black suit with gold trim',
    dress_code: 'Full concierge uniform provided — well-groomed, professional appearance',
    special_instructions: 'Dual security and concierge role. Must be comfortable assisting late-night guests while maintaining building security.',
    additional_requirements: 'Hospitality background preferred. Must be personable and well-spoken. Language skills a bonus.',
    job_description: 'Conduct hourly building patrols, manage night entrance access, assist late-arriving guests, handle luggage, monitor fire panel, and respond to guest requests.',
    icon: 'ri-hotel-line',
    color: 'emerald',
  },
  {
    id: 'builtin-close-protection',
    category: 'Executive',
    template_name: 'Close Protection Officer',
    job_title: 'Close Protection — VIP Executive Escort',
    security_type: 'close-protection',
    venue: 'Central London — Multiple Locations',
    address_line1: '1 Grosvenor Square, Mayfair',
    address_line2: 'Mayfair',
    city: 'London',
    postcode: 'W1K 4DP',
    hourly_rate: '25.00',
    number_of_guards: 2,
    number_of_days: '3',
    start_time: '07:00',
    end_time: '19:00',
    description: 'Close protection for a high-net-worth individual attending business meetings and social events across London. Chauffeur escort, venue advance checks, and personal security detail.',
    urgency: 'urgent',
    sia_licence_required: 'yes',
    specific_licences: ['Close Protection'],
    experience_level: 'senior',
    uniform_required: 'yes',
    uniform_details: 'Smart business suit, discreet earpiece provided',
    dress_code: 'Dark business suit, white shirt — professional and discreet appearance',
    special_instructions: 'Must hold valid CP licence. Discreet and professional at all times. Itinerary shared on briefing. Vehicle provided for escort duties.',
    additional_requirements: 'Minimum 5+ years close protection experience. Clean UK driving licence required. Previous corporate CP assignments preferred.',
    job_description: 'Provide close protection during business travel, conduct venue advance security checks, chauffeur principal between locations, maintain situation awareness, and coordinate with client\'s security team.',
    icon: 'ri-shield-star-line',
    color: 'rose',
  },
  {
    id: 'builtin-birmingham-nightclub',
    category: 'Nightlife',
    template_name: 'Birmingham Nightclub Door Supervisor',
    job_title: 'Door Supervisor — Broad Street Nightclub',
    security_type: 'door-supervisor',
    venue: 'Pryzm Birmingham',
    address_line1: '182 Broad Street',
    address_line2: 'Broad Street',
    city: 'Birmingham',
    postcode: 'B15 1DA',
    hourly_rate: '14.50',
    number_of_guards: 4,
    number_of_days: '2',
    start_time: '20:00',
    end_time: '05:00',
    description: 'Weekend door supervision at Birmingham\'s biggest nightclub on the famous Broad Street strip. Large-capacity venue hosting 1,200+ clubbers with multiple rooms and VIP areas.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Door Supervisor'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Black suit with branded club tie provided',
    dress_code: 'Smart black suit with white shirt and branded tie',
    special_instructions: 'Multi-floor venue — guards rotate between main entrance, VIP door, and dance floor positions. Radio comms essential.',
    additional_requirements: 'Experience in high-capacity nightclub venues essential. Conflict management trained.',
    job_description: 'Front door ID checks and capacity management, VIP area access control, dance floor crowd monitoring, ejection handling, and close liaison with venue management and West Midlands Police night-time economy team.',
    icon: 'ri-vip-crown-line',
    color: 'violet',
  },
  {
    id: 'builtin-birmingham-retail',
    category: 'Retail',
    template_name: 'Bullring Shopping Centre Security',
    job_title: 'Security Officer — Bullring & Grand Central',
    security_type: 'retail-security',
    venue: 'Bullring & Grand Central',
    address_line1: 'Moor Street',
    address_line2: 'City Centre',
    city: 'Birmingham',
    postcode: 'B5 4BU',
    hourly_rate: '13.50',
    number_of_guards: 3,
    number_of_days: '5',
    start_time: '07:00',
    end_time: '19:00',
    description: 'Day-shift security at one of the UK\'s busiest shopping destinations spanning Bullring and Grand Central. Over 200 retail units and 40 million annual visitors.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'entry',
    uniform_required: 'yes',
    uniform_details: 'Branded security polo, fleece jacket and trousers provided',
    dress_code: 'Full branded uniform provided — smart, professional appearance',
    special_instructions: 'Foot patrol across linked Bullring and Grand Central sites. Must be comfortable with high footfall environment and public interaction.',
    additional_requirements: 'Customer service-oriented approach essential. DBS check required. Retail security experience preferred.',
    job_description: 'High-visibility foot patrol across retail areas, deter shoplifting, respond to retail radio alerts, assist lost children/vulnerable persons, manage anti-social behaviour, and complete detailed incident reports.',
    icon: 'ri-shopping-bag-line',
    color: 'blue',
  },
  {
    id: 'builtin-birmingham-warehouse',
    category: 'Industrial',
    template_name: 'Warehouse Distribution Centre Security',
    job_title: 'Security Guard — Logistics Warehouse',
    security_type: 'security-guard',
    venue: 'ProLogis Park Birmingham',
    address_line1: 'Junction 6, M6 Motorway',
    address_line2: 'Birmingham Business Park',
    city: 'Birmingham',
    postcode: 'B37 7YB',
    hourly_rate: '13.00',
    number_of_guards: 2,
    number_of_days: '5',
    start_time: '06:00',
    end_time: '18:00',
    description: 'Gatehouse and patrol security at a major logistics distribution centre near Birmingham Airport. HGV access control, vehicle searches, and warehouse perimeter security.',
    urgency: 'immediate',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Hi-vis security jacket, branded polo and trousers provided',
    dress_code: 'Branded uniform with hi-vis outer layer — warm layers for gatehouse recommended',
    special_instructions: 'Gatehouse-based role with regular perimeter patrols. Vehicle booking system in use — training provided. Early start at 6am.',
    additional_requirements: 'Full UK driving licence preferred for patrol vehicle. Previous gatehouse or logistics security experience valued.',
    job_description: 'Manage HGV and visitor access at main gatehouse, conduct vehicle and load checks, hourly perimeter patrol, monitor warehouse CCTV, and maintain delivery logbooks.',
    icon: 'ri-truck-line',
    color: 'orange',
  },
  {
    id: 'builtin-manchester-arena',
    category: 'Events',
    template_name: 'AO Arena Event Security',
    job_title: 'Event Security — AO Arena Concert',
    security_type: 'event-security',
    venue: 'AO Arena Manchester',
    address_line1: 'Victoria Station Approach',
    address_line2: 'Hunts Bank',
    city: 'Manchester',
    postcode: 'M3 1AR',
    hourly_rate: '14.00',
    number_of_guards: 10,
    number_of_days: '1',
    start_time: '16:00',
    end_time: '23:30',
    description: 'Major concert event security at the UK\'s largest indoor arena with 21,000 capacity. Entry screening, crowd flow management, seating area monitoring, and post-event dispersal.',
    urgency: 'urgent',
    sia_licence_required: 'yes',
    specific_licences: ['Door Supervisor', 'Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Event security hi-vis tabard provided, dark clothing underneath',
    dress_code: 'Dark trousers and dark top with event tabard provided',
    special_instructions: 'Briefing at 3pm sharp. Multiple entry gates — guards assigned to specific gates. Post-event crowd management on Victoria Station approach until 11:30pm.',
    additional_requirements: 'Large event experience preferred. Must be comfortable with bag searches and metal detector operation. Team of 10 — good coordination skills.',
    job_description: 'Conduct bag searches and metal detector screening at entry points, manage crowd flow into seating areas, monitor for prohibited items, respond to medical incidents, and assist with safe venue dispersal post-event.',
    icon: 'ri-music-line',
    color: 'amber',
  },
  {
    id: 'builtin-manchester-office',
    category: 'Corporate',
    template_name: 'Spinningfields Office Security',
    job_title: 'Corporate Security — Spinningfields Tower',
    security_type: 'security-guard',
    venue: '3 Hardman Square, Spinningfields',
    address_line1: '3 Hardman Square',
    address_line2: 'Spinningfields',
    city: 'Manchester',
    postcode: 'M3 3EB',
    hourly_rate: '14.75',
    number_of_guards: 1,
    number_of_days: '5',
    start_time: '07:00',
    end_time: '19:00',
    description: 'Corporate security and front desk at a premium Spinningfields office tower housing multiple blue-chip tenants. Access control, visitor management, and building patrols.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Corporate blazer and building ID badge provided',
    dress_code: 'Corporate blazer, white shirt, smart trousers — polished professional look',
    special_instructions: 'Front-desk based role in premium building. Must be articulate and well-presented. Building management system training on first day.',
    additional_requirements: 'Excellent communication skills. Previous corporate security or concierge experience required. DBS essential.',
    job_description: 'Front desk visitor sign-in, issue temporary access passes, monitor building-wide CCTV and access control systems, conduct floor-by-floor patrols every 2 hours, and coordinate with building facilities team.',
    icon: 'ri-building-line',
    color: 'teal',
  },
  {
    id: 'builtin-liverpool-dock',
    category: 'Maritime',
    template_name: 'Liverpool Dock Security Patrol',
    job_title: 'Dock Security — Royal Albert Dock',
    security_type: 'mobile-patrol',
    venue: 'Royal Albert Dock Liverpool',
    address_line1: '3-4 The Colonnades, Albert Dock',
    address_line2: 'Waterfront',
    city: 'Liverpool',
    postcode: 'L3 4AA',
    hourly_rate: '13.50',
    number_of_guards: 2,
    number_of_days: '7',
    start_time: '18:00',
    end_time: '06:00',
    description: 'Night security patrol across Liverpool\'s iconic Royal Albert Dock — a Grade I listed waterfront complex with museums, restaurants, bars, and hotels. Heritage-sensitive environment.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'experienced',
    uniform_required: 'yes',
    uniform_details: 'Branded security jacket, hi-vis vest for waterside patrol',
    dress_code: 'Branded security uniform — warm waterproof layers for waterside night patrols',
    special_instructions: 'Heritage site — must be respectful of Grade I listed environment. Waterside patrol includes pontoon and quayside areas. Site office with facilities on The Colonnades.',
    additional_requirements: 'Previous heritage or tourism site security experience valued. Must be comfortable working near water. Good report writing skills.',
    job_description: 'Night patrol of dock complex including waterside areas, lock up/unlock procedures for retail units, monitor museum and gallery perimeters, check pontoon moorings, and respond to alarm activations across the estate.',
    icon: 'ri-ship-line',
    color: 'slate',
  },
  {
    id: 'builtin-liverpool-hotel',
    category: 'Hospitality',
    template_name: 'Liverpool City Centre Hotel Security',
    job_title: 'Hotel Security — Cavern Quarter Hotel',
    security_type: 'security-guard',
    venue: 'Hard Days Night Hotel',
    address_line1: '41 North John Street',
    address_line2: 'Cavern Quarter',
    city: 'Liverpool',
    postcode: 'L2 6RR',
    hourly_rate: '13.25',
    number_of_guards: 2,
    number_of_days: '2',
    start_time: '20:00',
    end_time: '04:00',
    description: 'Weekend night security at a popular city-centre hotel in Liverpool\'s lively Cavern Quarter. Guest and public area monitoring, noise management, and bar/night entrance control.',
    urgency: 'standard',
    sia_licence_required: 'yes',
    specific_licences: ['Door Supervisor'],
    experience_level: 'intermediate',
    uniform_required: 'yes',
    uniform_details: 'Hotel-branded blazer and name badge provided',
    dress_code: 'Hotel-branded blazer, white shirt, smart dark trousers — professional hospitality appearance',
    special_instructions: 'Friday and Saturday nights. Busy area with high footfall from Mathew Street nightlife. Must balance firmness with hospitality. Bar closes at 2am — assist with quiet dispersal.',
    additional_requirements: 'Hospitality security experience essential. Must be personable with guests while maintaining authority. Liverpool city centre knowledge valued.',
    job_description: 'Monitor hotel entrance and lobby, manage guest and visitor access, conduct floor patrols for noise complaints, control bar area during peak hours, assist with late-night check-ins, and ensure guest safety throughout the night.',
    icon: 'ri-hotel-line',
    color: 'emerald',
  },
  {
    id: 'builtin-liverpool-student',
    category: 'Education',
    template_name: 'Student Accommodation Security',
    job_title: 'Security Officer — Student Halls',
    security_type: 'security-guard',
    venue: 'University of Liverpool Student Village',
    address_line1: 'Crown Place, Brownlow Hill',
    address_line2: 'Knowledge Quarter',
    city: 'Liverpool',
    postcode: 'L3 5UE',
    hourly_rate: '13.00',
    number_of_guards: 2,
    number_of_days: '7',
    start_time: '20:00',
    end_time: '04:00',
    description: 'Night security across a large student accommodation complex with 1,200+ residents. Welfare checks, noise management, access control, and first-response to incidents.',
    urgency: 'immediate',
    sia_licence_required: 'yes',
    specific_licences: ['Security Guard'],
    experience_level: 'entry',
    uniform_required: 'yes',
    uniform_details: 'University security branded polo and softshell jacket',
    dress_code: 'Branded security uniform with comfortable footwear — lots of walking between blocks',
    special_instructions: 'Student-focused environment — welfare and safeguarding approach essential. Multiple accommodation blocks across campus — patrol vehicle provided.',
    additional_requirements: 'DBS check essential. Experience in education or student accommodation preferred. Approachable and calm under pressure.',
    job_description: 'Night patrol across student accommodation blocks, respond to noise complaints and welfare concerns, manage visitor access, conduct fire door and safety checks, and coordinate with university campus security team.',
    icon: 'ri-graduation-cap-line',
    color: 'slate',
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [sidebarInfo, setSidebarInfo] = useState({ companyName: 'Client', subscriptionTier: 'Free', initials: 'CL' });
  const [adoptingTemplate, setAdoptingTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<BuiltInTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BuiltInTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/client/login'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      setClientId(client.id);
      setSidebarInfo({
        companyName: client.company_name || 'Client',
        subscriptionTier: client.subscription_tier || 'Free',
        initials: (client.company_name || 'Client').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      });

      const { data } = await supabase
        .schema('app')
        .from('job_templates')
        .select('*')
        .eq('client_id', client.id)
        .order('use_count', { ascending: false });

      setTemplates(data || []);
    } catch {
      setToast('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.schema('app').from('job_templates').delete().eq('id', id);
      if (error) throw error;
      setToast('Template deleted');
      loadTemplates();
    } catch {
      setToast('Failed to delete template');
    }
  };

  const handleDuplicate = async (template: Template) => {
    if (!clientId) return;
    try {
      const { error } = await supabase.schema('app').from('job_templates').insert({
        client_id: clientId,
        template_name: `Copy of ${template.template_name}`,
        job_title: template.job_title,
        security_type: template.security_type,
        number_of_guards: template.number_of_guards,
        start_time: template.start_time,
        end_time: template.end_time,
        urgency: template.urgency,
        sia_licence_required: template.sia_licence_required,
        specific_licences: template.specific_licences,
        experience_level: template.experience_level,
        venue: template.venue,
        city: template.city,
        hourly_rate: template.hourly_rate,
        uniform_required: template.uniform_required,
        uniform_details: template.uniform_details,
        dress_code: template.dress_code,
        special_instructions: template.special_instructions,
        additional_requirements: template.additional_requirements,
      });
      if (error) throw error;
      setToast('Template duplicated');
      loadTemplates();
    } catch {
      setToast('Failed to duplicate template');
    }
  };

  const handleUse = (template: Template) => {
    router.push(`/client/post-job?template=${template.id}`);
  };

  const saveBuiltInToDb = async (bt: BuiltInTemplate): Promise<string | null> => {
    if (!clientId) return null;
    const { data, error } = await supabase
      .schema('app')
      .from('job_templates')
      .insert({
        client_id: clientId,
        template_name: bt.template_name,
        job_title: bt.job_title,
        security_type: bt.security_type,
        number_of_guards: bt.number_of_guards,
        number_of_days: bt.number_of_days,
        start_time: bt.start_time,
        end_time: bt.end_time,
        urgency: bt.urgency,
        sia_licence_required: bt.sia_licence_required,
        specific_licences: bt.specific_licences,
        experience_level: bt.experience_level,
        venue: bt.venue,
        address_line1: bt.address_line1,
        address_line2: bt.address_line2 || null,
        city: bt.city,
        postcode: bt.postcode,
        job_description: bt.job_description,
        uniform_required: bt.uniform_required,
        uniform_details: bt.uniform_details || null,
        hourly_rate: bt.hourly_rate,
        dress_code: bt.dress_code || null,
        special_instructions: bt.special_instructions || null,
        additional_requirements: bt.additional_requirements || null,
      })
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create template');
    return data.id;
  };

  const handleAdoptBuiltIn = async (bt: BuiltInTemplate) => {
    if (!clientId) return;
    setAdoptingTemplate(bt.id);
    try {
      const id = await saveBuiltInToDb(bt);
      if (!id) throw new Error('Failed to create template');
      setToast('Template added — redirecting...');
      setTimeout(() => {
        router.push(`/client/post-job?template=${id}`);
      }, 600);
    } catch {
      setToast('Failed to adopt template');
      setAdoptingTemplate(null);
    }
  };

  const handleSaveCustomised = async () => {
    if (!editingTemplate || !clientId) return;
    setAdoptingTemplate(editingTemplate.id);
    try {
      const id = await saveBuiltInToDb(editingTemplate);
      if (!id) throw new Error('Failed to save template');
      setPreviewTemplate(null);
      setIsEditing(false);
      setEditingTemplate(null);
      setToast('Custom template saved — redirecting...');
      loadTemplates();
      setTimeout(() => {
        router.push(`/client/post-job?template=${id}`);
      }, 600);
    } catch {
      setToast('Failed to save custom template');
      setAdoptingTemplate(null);
    }
  };

  const filtered = templates.filter(t =>
    t.template_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.job_title || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.venue || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredBuiltIn = search
    ? BUILT_IN_TEMPLATES.filter(bt =>
        bt.template_name.toLowerCase().includes(search.toLowerCase()) ||
        bt.job_title.toLowerCase().includes(search.toLowerCase()) ||
        bt.venue.toLowerCase().includes(search.toLowerCase()) ||
        bt.category.toLowerCase().includes(search.toLowerCase())
      )
    : BUILT_IN_TEMPLATES;

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={sidebarInfo.companyName}
          subtitle={sidebarInfo.subscriptionTier}
          initials={sidebarInfo.initials}
        />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.job_templates" />
          </div>
        </div>
      </div>
    );
  }

  const experienceLabel = (level: string) =>
    level === 'entry' ? 'Entry Level (0–1 yrs)' : level === 'intermediate' ? 'Intermediate (1–3 yrs)' : level === 'experienced' ? 'Experienced (3–5 yrs)' : 'Senior (5+ yrs)';

  const categoryColors: Record<string, string> = {
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    teal: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
    slate: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  };

  const iconBgColors: Record<string, string> = {
    violet: 'bg-violet-500/15 border-violet-500/25',
    blue: 'bg-blue-500/15 border-blue-500/25',
    amber: 'bg-amber-500/15 border-amber-500/25',
    orange: 'bg-orange-500/15 border-orange-500/25',
    teal: 'bg-teal-500/15 border-teal-500/25',
    slate: 'bg-slate-500/15 border-slate-500/25',
    emerald: 'bg-emerald-500/15 border-emerald-500/25',
    rose: 'bg-rose-500/15 border-rose-500/25',
  };

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={sidebarInfo.companyName}
        subtitle={sidebarInfo.subscriptionTier}
        initials={sidebarInfo.initials}
      />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        {toast && (
          <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d] animate-fade-in">
            <i className="ri-checkbox-circle-fill text-teal-400"></i>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}

        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-12 border-b border-[#1e2d4d]">
          <div className="max-w-5xl mx-auto px-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/client/dashboard" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <span className="text-slate-500 text-sm">Back to Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">Job Templates</h1>
            <p className="text-slate-400">Ready-made job posts and your saved templates</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-3 bg-[#111d35] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <i className="ri-close-line"></i>
                </button>
              )}
            </div>
            <Link
              href="/client/post-job"
              className="bg-teal-500 text-white px-5 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors text-center cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-add-line"></i>
              Post New Job
            </Link>
          </div>

          {filteredBuiltIn.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center border border-teal-500/25">
                  <i className="ri-flashlight-line text-teal-400"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Ready-Made Templates</h2>
                  <p className="text-xs text-slate-500">Click to adopt and start posting instantly</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                {filteredBuiltIn.map((bt) => (
                  <div
                    key={bt.id}
                    className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden hover:border-teal-500/30 transition-all group"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBgColors[bt.color]}`}>
                            <i className={`${bt.icon} text-lg ${categoryColors[bt.color].split(' ')[2]}`}></i>
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm">{bt.template_name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[bt.color]} mt-0.5 inline-block`}>
                              {bt.category}
                            </span>
                          </div>
                        </div>
                        {bt.urgency === 'immediate' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">Immediate</span>
                        )}
                        {bt.urgency === 'urgent' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">Urgent</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{bt.description}</p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-shield-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {securityTypeLabels[bt.security_type] || bt.security_type}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-map-pin-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {bt.city}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-money-pound-circle-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          £{bt.hourly_rate}/hr
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-user-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {bt.number_of_guards} guard{bt.number_of_guards !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-calendar-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {bt.number_of_days} day{bt.number_of_days !== '1' ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-time-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {bt.start_time} – {bt.end_time}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 col-span-2">
                          <i className="ri-account-pin-box-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {bt.experience_level === 'entry' ? 'Entry Level' : bt.experience_level === 'intermediate' ? 'Intermediate' : bt.experience_level === 'experienced' ? 'Experienced' : 'Senior'} level
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdoptBuiltIn(bt)}
                          disabled={adoptingTemplate === bt.id}
                          className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {adoptingTemplate === bt.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Adding...
                            </>
                          ) : (
                            <>
                              <i className="ri-download-line"></i>
                              Use This Template
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setPreviewTemplate(bt)}
                          className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] hover:border-[#2a3d5f] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                        >
                          <i className="ri-eye-line"></i>
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {templates.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-indigo-500/15 rounded-lg flex items-center justify-center border border-indigo-500/25">
                  <i className="ri-file-copy-line text-indigo-400"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Your Saved Templates</h2>
                  <p className="text-xs text-slate-500">{templates.length} template{templates.length !== 1 ? 's' : ''} saved</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((template) => (
                  <div
                    key={template.id}
                    className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 hover:border-teal-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center border border-indigo-500/25">
                          <i className="ri-file-copy-line text-indigo-400 text-lg"></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm">{template.template_name}</h3>
                          <p className="text-xs text-slate-500">
                            Used {template.use_count} time{template.use_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {confirmDelete === template.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { handleDelete(template.id); setConfirmDelete(null); }}
                            className="text-red-400 text-xs font-semibold hover:text-red-300 cursor-pointer whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-slate-500 text-xs font-semibold hover:text-slate-300 cursor-pointer whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(template.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {template.job_title && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-briefcase-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {template.job_title}
                        </p>
                      )}
                      {template.security_type && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-shield-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {securityTypeLabels[template.security_type] || template.security_type}
                        </p>
                      )}
                      {template.venue && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-map-pin-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {template.venue}{template.city ? `, ${template.city}` : ''}
                        </p>
                      )}
                      {template.hourly_rate && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-money-pound-circle-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          £{template.hourly_rate}/hr
                        </p>
                      )}
                      {template.number_of_guards && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-user-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          {template.number_of_guards} guard{template.number_of_guards !== 1 ? 's' : ''}
                        </p>
                      )}
                      {template.sia_licence_required === 'yes' && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <i className="ri-shield-check-line text-slate-600 w-3.5 h-3.5 flex items-center justify-center"></i>
                          SIA licence required
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-[#1e2d4d]">
                      <button
                        onClick={() => handleUse(template)}
                        className="flex-1 bg-teal-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-send-plane-line mr-1"></i>Use Template
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="px-3 py-2 border border-[#1e2d4d] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-file-copy-2-line"></i>
                      </button>
                      <button
                        onClick={() => router.push(`/client/post-job?template=${template.id}`)}
                        className="px-3 py-2 border border-[#1e2d4d] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {filtered.length === 0 && filteredBuiltIn.length === 0 && (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-16 text-center mt-4">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-file-search-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No templates match your search</h3>
              <p className="text-slate-500 text-sm">Try a different search term</p>
            </div>
          )}
        </div>

        {previewTemplate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setPreviewTemplate(null); setIsEditing(false); setEditingTemplate(null); }}>
            <div
              className="bg-[#0f172a] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-[#1e2d4d] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#0f172a] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBgColors[previewTemplate.color]}`}>
                    <i className={`${previewTemplate.icon} text-lg ${categoryColors[previewTemplate.color].split(' ')[2]}`}></i>
                  </div>
                  <div>
                    {isEditing && editingTemplate ? (
                      <input
                        value={editingTemplate.template_name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, template_name: e.target.value })}
                        className="font-bold text-white bg-[#111d35] border border-[#1e2d4d] rounded-lg px-3 py-1.5 text-sm w-full outline-none focus:border-teal-500"
                      />
                    ) : (
                      <h3 className="font-bold text-white">{previewTemplate.template_name}</h3>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[previewTemplate.color]}`}>
                        {previewTemplate.category}
                      </span>
                      {isEditing && editingTemplate ? (
                        <div className="relative">
                          <button
                            onClick={() => {
                              const next = editingTemplate.urgency === 'standard' ? 'urgent' : editingTemplate.urgency === 'urgent' ? 'immediate' : 'standard';
                              setEditingTemplate({ ...editingTemplate, urgency: next });
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer whitespace-nowrap ${
                              editingTemplate.urgency === 'immediate' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              editingTemplate.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}
                          >
                            {editingTemplate.urgency === 'immediate' ? 'Immediate' : editingTemplate.urgency === 'urgent' ? 'Urgent' : 'Standard'}
                          </button>
                        </div>
                      ) : (
                        <>
                          {previewTemplate.urgency === 'immediate' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Immediate</span>
                          )}
                          {previewTemplate.urgency === 'urgent' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Urgent</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => {
                        setEditingTemplate({ ...previewTemplate });
                        setIsEditing(true);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                      title="Customise template"
                    >
                      <i className="ri-edit-line text-lg"></i>
                    </button>
                  ) : (
                    <button
                      onClick={() => { setIsEditing(false); setEditingTemplate(null); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                      title="Cancel editing"
                    >
                      <i className="ri-close-line text-lg"></i>
                    </button>
                  )}
                  <button
                    onClick={() => { setPreviewTemplate(null); setIsEditing(false); setEditingTemplate(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <i className="ri-close-line text-lg"></i>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {(() => {
                  const t = isEditing && editingTemplate ? editingTemplate : previewTemplate;
                  const update = isEditing && editingTemplate
                    ? (field: string, value: string | number) => setEditingTemplate({ ...editingTemplate, [field]: value })
                    : undefined;

                  const inputClass = "w-full bg-[#111d35] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500";
                  const textareaClass = "w-full bg-[#111d35] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 resize-none";
                  const selectClass = "w-full bg-[#111d35] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 appearance-none cursor-pointer";

                  return (
                    <>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h4>
                        {isEditing && update ? (
                          <textarea
                            value={t.description}
                            onChange={(e) => update('description', e.target.value)}
                            rows={3}
                            className={textareaClass}
                          />
                        ) : (
                          <p className="text-sm text-slate-300 leading-relaxed">{t.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Job Type</p>
                          {isEditing && update ? (
                            <div className="relative">
                              <select
                                value={t.security_type}
                                onChange={(e) => update('security_type', e.target.value)}
                                className={`${selectClass} pr-8`}
                              >
                                {Object.entries(securityTypeLabels).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-white">{securityTypeLabels[t.security_type] || t.security_type}</p>
                          )}
                        </div>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Experience Required</p>
                          {isEditing && update ? (
                            <div className="relative">
                              <select
                                value={t.experience_level}
                                onChange={(e) => update('experience_level', e.target.value)}
                                className={`${selectClass} pr-8`}
                              >
                                <option value="entry">Entry Level</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="experienced">Experienced</option>
                                <option value="senior">Senior</option>
                              </select>
                              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-white">{experienceLabel(t.experience_level)}</p>
                          )}
                        </div>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Hourly Rate</p>
                          {isEditing && update ? (
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={t.hourly_rate}
                                onChange={(e) => update('hourly_rate', e.target.value)}
                                className={`${inputClass} pl-7`}
                              />
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-white">£{t.hourly_rate}/hr</p>
                          )}
                        </div>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Guards Needed</p>
                          {isEditing && update ? (
                            <input
                              type="number"
                              min="1"
                              value={t.number_of_guards}
                              onChange={(e) => update('number_of_guards', parseInt(e.target.value) || 1)}
                              className={inputClass}
                            />
                          ) : (
                            <p className="text-sm font-semibold text-white">{t.number_of_guards} guard{t.number_of_guards !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Duration</p>
                          {isEditing && update ? (
                            <input
                              type="text"
                              value={t.number_of_days}
                              onChange={(e) => update('number_of_days', e.target.value)}
                              className={inputClass}
                            />
                          ) : (
                            <p className="text-sm font-semibold text-white">{t.number_of_days} day{t.number_of_days !== '1' ? 's' : ''}</p>
                          )}
                        </div>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">
                          <p className="text-xs text-slate-500 mb-1">Shift Time</p>
                          {isEditing && update ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={t.start_time}
                                onChange={(e) => update('start_time', e.target.value)}
                                className={`${inputClass} flex-1`}
                              />
                              <span className="text-slate-500 text-sm">–</span>
                              <input
                                type="time"
                                value={t.end_time}
                                onChange={(e) => update('end_time', e.target.value)}
                                className={`${inputClass} flex-1`}
                              />
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-white">{t.start_time} – {t.end_time}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</h4>
                        <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d] space-y-2">
                          {isEditing && update ? (
                            <>
                              <input value={t.venue} onChange={(e) => update('venue', e.target.value)} placeholder="Venue" className={inputClass} />
                              <input value={t.address_line1} onChange={(e) => update('address_line1', e.target.value)} placeholder="Address line 1" className={inputClass} />
                              <input value={t.address_line2 || ''} onChange={(e) => update('address_line2', e.target.value)} placeholder="Address line 2" className={inputClass} />
                              <div className="flex gap-2">
                                <input value={t.city} onChange={(e) => update('city', e.target.value)} placeholder="City" className={`${inputClass} flex-1`} />
                                <input value={t.postcode} onChange={(e) => update('postcode', e.target.value)} placeholder="Postcode" className={`${inputClass} w-32`} />
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-white">{t.venue}</p>
                              <p className="text-sm text-slate-400">{t.address_line1}{t.address_line2 ? `, ${t.address_line2}` : ''}</p>
                              <p className="text-sm text-slate-400">{t.city}, {t.postcode}</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SIA Licence Requirements</h4>
                        {isEditing && update ? (
                          <div className="flex flex-wrap gap-2">
                            {['Door Supervisor', 'Security Guard', 'CCTV Operator', 'Close Protection', 'Dog Handler', 'Key Holding'].map((lic) => {
                              const active = t.specific_licences.includes(lic);
                              return (
                                <button
                                  key={lic}
                                  onClick={() => {
                                    const next = active
                                      ? t.specific_licences.filter((l: string) => l !== lic)
                                      : [...t.specific_licences, lic];
                                    update('specific_licences', next as unknown as string);
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-full border font-medium cursor-pointer whitespace-nowrap transition-colors ${
                                    active ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-[#0f172a] text-slate-500 border-[#1e2d4d] hover:border-teal-500/30'
                                  }`}
                                >
                                  {lic}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {t.specific_licences.map((lic: string) => (
                              <span key={lic} className="text-xs px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                                {lic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Job Description</h4>
                        {isEditing && update ? (
                          <textarea
                            value={t.job_description}
                            onChange={(e) => update('job_description', e.target.value)}
                            rows={4}
                            className={textareaClass}
                          />
                        ) : (
                          <p className="text-sm text-slate-300 leading-relaxed bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">{t.job_description}</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Uniform & Dress Code</h4>
                        {isEditing && update ? (
                          <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d] space-y-3">
                            <div>
                              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={t.uniform_required === 'yes'}
                                  onChange={(e) => update('uniform_required', e.target.checked ? 'yes' : 'no')}
                                  className="w-4 h-4 rounded border-[#1e2d4d] bg-[#0f172a] accent-teal-500"
                                />
                                <span className="text-xs text-slate-400">Uniform required</span>
                              </label>
                              {t.uniform_required === 'yes' && (
                                <>
                                  <input
                                    value={t.uniform_details || ''}
                                    onChange={(e) => update('uniform_details', e.target.value)}
                                    placeholder="Uniform details"
                                    className={`${inputClass} mb-2`}
                                  />
                                  <input
                                    value={t.dress_code || ''}
                                    onChange={(e) => update('dress_code', e.target.value)}
                                    placeholder="Dress code"
                                    className={inputClass}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        ) : t.uniform_required === 'yes' ? (
                          <div className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d] space-y-3">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Uniform</p>
                              <p className="text-sm text-slate-300">{t.uniform_details}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Dress Code</p>
                              <p className="text-sm text-slate-300">{t.dress_code}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No uniform required</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Special Instructions</h4>
                        {isEditing && update ? (
                          <textarea
                            value={t.special_instructions || ''}
                            onChange={(e) => update('special_instructions', e.target.value)}
                            rows={3}
                            className={textareaClass}
                          />
                        ) : t.special_instructions ? (
                          <p className="text-sm text-slate-300 leading-relaxed bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">{t.special_instructions}</p>
                        ) : (
                          <p className="text-sm text-slate-500">None specified</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Additional Requirements</h4>
                        {isEditing && update ? (
                          <textarea
                            value={t.additional_requirements || ''}
                            onChange={(e) => update('additional_requirements', e.target.value)}
                            rows={3}
                            className={textareaClass}
                          />
                        ) : t.additional_requirements ? (
                          <p className="text-sm text-slate-300 leading-relaxed bg-[#111d35] rounded-xl p-4 border border-[#1e2d4d]">{t.additional_requirements}</p>
                        ) : (
                          <p className="text-sm text-slate-500">None specified</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-[#1e2d4d]">
                        {isEditing ? (
                          <button
                            onClick={handleSaveCustomised}
                            disabled={adoptingTemplate === editingTemplate?.id}
                            className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                          >
                            {adoptingTemplate === editingTemplate?.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <i className="ri-save-line"></i>
                                Save & Use Template
                              </>
                            )}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setPreviewTemplate(null);
                                handleAdoptBuiltIn(previewTemplate);
                              }}
                              className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                            >
                              <i className="ri-download-line"></i>
                              Adopt & Use Template
                            </button>
                            <button
                              onClick={() => {
                                setEditingTemplate({ ...previewTemplate });
                                setIsEditing(true);
                              }}
                              className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] hover:border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
                            >
                              <i className="ri-edit-line"></i>
                              Customise
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setPreviewTemplate(null); setIsEditing(false); setEditingTemplate(null); }}
                          className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}