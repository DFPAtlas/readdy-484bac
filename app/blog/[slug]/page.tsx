import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { metaDescriptionFor, metaTitleFor, type BlogPost } from '@/lib/blog';
import BlogPostClient from './BlogPostClient';

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'app' } }
  );
}

export async function generateStaticParams() {
  try {
    const supabase = serverClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      return data.map((row) => ({ slug: row.slug as string }));
    }
  } catch {
    /* fallback for static export */
  }
  return [{ slug: 'briefing-a-security-guard-before-a-shift' }];
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = serverClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, cover_image_url, audience, tags, status, source, meta_title, meta_description, published_at, created_at, updated_at')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    return (data as BlogPost) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) {
    return {
      title: 'Article Not Found',
      description: 'This QuickGuard article is no longer available.',
      robots: { index: false, follow: true },
    };
  }

  const title = metaTitleFor(post);
  const description = metaDescriptionFor(post);
  const url = `https://quickguard.uk/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'QuickGuard',
      type: 'article',
      locale: 'en_GB',
      publishedTime: post.published_at || post.created_at,
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogPostClient slug={slug} />;
}