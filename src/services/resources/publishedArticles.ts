import { SUPABASE_REMOTE_URL } from '@/integrations/supabase/env';

export interface PublishedArticle {
  slug: string;
  title: string;
  locale: string;
  excerpt: string | null;
  body: string | null;
  coverImageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
}

interface PublishedArticlesResponse {
  success: boolean;
  articles?: PublishedArticle[];
  article?: PublishedArticle | null;
  error?: string;
}

async function readPublishedArticles(input: {
  siteId: string;
  slug?: string;
  locale?: string;
  limit?: number;
}): Promise<PublishedArticlesResponse> {
  const response = await fetch(`${SUPABASE_REMOTE_URL}/functions/v1/site-runtime-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'articles', ...input }),
  });
  const data = await response.json() as PublishedArticlesResponse;
  if (!response.ok || !data.success) throw new Error(data.error || 'Published articles could not be loaded');
  return data;
}

export async function listPublishedArticles(input: {
  siteId: string;
  locale?: string;
  limit?: number;
}): Promise<PublishedArticle[]> {
  const response = await readPublishedArticles(input);
  return response.articles ?? [];
}

export async function getPublishedArticle(input: {
  siteId: string;
  slug: string;
  locale?: string;
}): Promise<PublishedArticle | null> {
  const response = await readPublishedArticles(input);
  return response.article ?? null;
}