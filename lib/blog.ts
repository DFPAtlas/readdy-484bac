export type BlogAudience = 'client' | 'guard' | 'both';
export type BlogStatus = 'draft' | 'approved' | 'published' | 'rejected';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  audience: BlogAudience | null;
  tags: string[] | null;
  status: BlogStatus;
  source: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  audience: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

export const AUDIENCE_LABELS: Record<BlogAudience, string> = {
  client: 'For Clients',
  guard: 'For Guards',
  both: 'For Everyone',
};

export const TAG_STYLES: Record<BlogAudience, string> = {
  client: 'bg-teal-500/10 text-teal-300 border-teal-400/25',
  guard: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
  both: 'bg-slate-500/10 text-slate-300 border-slate-400/25',
};

export function audienceLabel(audience: string | null | undefined): string {
  if (audience === 'client' || audience === 'guard' || audience === 'both') {
    return AUDIENCE_LABELS[audience];
  }
  return AUDIENCE_LABELS.both;
}

export function audienceStyle(audience: string | null | undefined): string {
  if (audience === 'client' || audience === 'guard') return TAG_STYLES[audience];
  return TAG_STYLES.both;
}

export function formatBlogDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function readingTimeMinutes(content: string | null | undefined): number {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function postHref(slug: string): string {
  return `/blog/${slug}`;
}

export function metaTitleFor(post: BlogPost): string {
  return post.meta_title?.trim() || post.title;
}

export function metaDescriptionFor(post: BlogPost): string {
  return post.meta_description?.trim() || post.excerpt?.trim() || `${post.title} — QuickGuard insights for UK security clients and guards.`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const COVER_FALLBACK =
  'https://readdy.ai/api/search-image?query=Abstract%20dark%20navy%20blue%20and%20teal%20gradient%20background%20with%20soft%20geometric%20light%20streaks%2C%20minimal%20premium%20corporate%20texture%2C%20no%20text%2C%20subtle%20depth%2C%20clean%20modern%20editorial%20backdrop&width=1200&height=700&seq=blog_cover_fallback_20261118&orientation=landscape';