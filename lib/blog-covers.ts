import { supabase } from './supabase';

export interface BlogCoverOption {
  id: string;
  label: string;
  url: string;
}

export const BLOG_COVER_OPTIONS: BlogCoverOption[] = [
  {
    id: 'guard-on-site',
    label: 'Guard on site',
    url: 'https://readdy.ai/api/search-image?query=Professional%20photograph%20of%20a%20uniformed%20security%20guard%20standing%20at%20the%20entrance%20of%20a%20modern%20glass%20office%20building%20at%20dusk%2C%20deep%20navy%20blue%20and%20teal%20colour%20grade%2C%20clean%20minimal%20background%2C%20editorial%20style%2C%20no%20text%2C%20soft%20cinematic%20lighting%2C%20shallow%20depth%20of%20field%2C%20high%20end%20corporate%20photography&width=1200&height=675&seq=blogcover_guard_20261118&orientation=landscape',
  },
  {
    id: 'high-street-retail',
    label: 'Retail high street',
    url: 'https://readdy.ai/api/search-image?query=Wide%20editorial%20photograph%20of%20a%20busy%20British%20high%20street%20shop%20front%20at%20dusk%20with%20warm%20interior%20light%2C%20navy%20blue%20and%20teal%20colour%20grade%2C%20calm%20empty%20pavement%20in%20the%20foreground%2C%20professional%20commercial%20photography%2C%20no%20text%2C%20no%20logos%2C%20soft%20cinematic%20lighting%2C%20subtle%20sense%20of%20depth&width=1200&height=675&seq=blogcover_retail_20261118&orientation=landscape',
  },
  {
    id: 'festival-crowd',
    label: 'Event & festival',
    url: 'https://readdy.ai/api/search-image?query=Photograph%20of%20an%20outdoor%20music%20festival%20crowd%20barrier%20at%20golden%20hour%20with%20blurred%20stage%20lights%20in%20the%20background%2C%20navy%20and%20teal%20dusk%20sky%2C%20professional%20event%20photography%2C%20no%20text%2C%20no%20logos%2C%20cinematic%20wide%20angle%2C%20clean%20composition%20with%20open%20sky%20area&width=1200&height=675&seq=blogcover_event_20261118&orientation=landscape',
  },
  {
    id: 'construction-site',
    label: 'Construction site',
    url: 'https://readdy.ai/api/search-image?query=Photograph%20of%20a%20UK%20construction%20site%20in%20the%20early%20morning%20with%20steel%20scaffolding%20and%20a%20tall%20crane%20against%20a%20pale%20teal%20dawn%20sky%2C%20navy%20blue%20shadows%2C%20clean%20industrial%20minimal%20composition%2C%20professional%20architectural%20photography%2C%20no%20text%2C%20no%20people%2C%20soft%20light&width=1200&height=675&seq=blogcover_site_20261118&orientation=landscape',
  },
  {
    id: 'hotel-lobby',
    label: 'Hotel & hospitality',
    url: 'https://readdy.ai/api/search-image?query=Elegant%20photograph%20of%20a%20hotel%20lobby%20interior%20with%20marble%20floor%2C%20warm%20lamps%20and%20a%20reception%20desk%2C%20deep%20navy%20and%20teal%20colour%20grade%2C%20calm%20empty%20space%2C%20professional%20interior%20photography%2C%20no%20text%2C%20symmetrical%20composition%2C%20soft%20evening%20lighting&width=1200&height=675&seq=blogcover_hotel_20261118&orientation=landscape',
  },
  {
    id: 'late-night-venue',
    label: 'Late-night venue',
    url: 'https://readdy.ai/api/search-image?query=Photograph%20of%20a%20nightclub%20entrance%20at%20night%20with%20soft%20neon%20teal%20and%20warm%20red%20glow%20on%20wet%20pavement%2C%20a%20bouncer%20silhouette%20far%20in%20the%20background%2C%20moody%20navy%20colour%20grade%2C%20professional%20nightlife%20editorial%20photography%2C%20no%20text%2C%20clean%20composition%2C%20cinematic%20lighting&width=1200&height=675&seq=blogcover_venue_20261118&orientation=landscape',
  },
  {
    id: 'licence-desk',
    label: 'Licence & paperwork',
    url: 'https://readdy.ai/api/search-image?query=Close%20up%20photograph%20of%20a%20plain%20silver%20security%20badge%20and%20lanyard%20resting%20on%20a%20dark%20navy%20desk%20beside%20a%20closed%20notebook%20and%20pen%2C%20teal%20rim%20light%2C%20clean%20minimal%20product%20photography%2C%20no%20readable%20text%2C%20soft%20shadows%2C%20shallow%20depth%20of%20field%2C%20premium%20editorial%20look&width=1200&height=675&seq=blogcover_licence_20261118&orientation=landscape',
  },
  {
    id: 'control-room',
    label: 'Control room',
    url: 'https://readdy.ai/api/search-image?query=Photograph%20of%20a%20calm%20control%20room%20with%20several%20monitors%20showing%20abstract%20maps%20and%20floor%20plans%20in%20teal%20tones%2C%20navy%20blue%20ambient%20lighting%2C%20an%20empty%20ergonomic%20chair%2C%20professional%20technology%20photography%2C%20no%20readable%20text%2C%20clean%20modern%20composition%2C%20cinematic%20depth&width=1200&height=675&seq=blogcover_control_20261118&orientation=landscape',
  },
];

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadBlogCover(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cover';
  const filePath = `covers/${Date.now()}-${safeName}.${ext}`;

  const { error } = await supabase.storage
    .from('blog-covers')
    .upload(filePath, file, { cacheControl: '31536000', upsert: false, contentType: file.type });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from('blog-covers').getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Upload succeeded but no public link was returned.');
  }
  return data.publicUrl;
}