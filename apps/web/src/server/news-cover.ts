import 'server-only';
import { unstable_cache } from 'next/cache';

// Only fetch article metadata from the explicitly approved publisher.
// This does not fetch or store image binaries; browsers load the public cover URL.
const HOST = 'motor1.uol.com.br';
const MAX_HTML_BYTES = 350_000;

function safeArticleUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== HOST ||
        !/^\/news\/\d+\//.test(url.pathname) || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
function imageFromHtml(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/([a-z:-]+)\s*=\s*(["'])(.*?)\2/gi)) attrs.set(match[1].toLowerCase(), match[3]);
    const property = attrs.get('property') ?? attrs.get('name');
    if (!['og:image', 'twitter:image', 'twitter:image:src'].includes(property ?? '')) continue;
    const value = attrs.get('content');
    if (!value) continue;
    try {
      const url = new URL(value.replace(/&amp;/g, '&'));
      if (url.protocol === 'https:' && !url.username && !url.password &&
          (url.hostname === 'motor1.uol.com.br' ||
           url.hostname.endsWith('.motor1.com') ||
           url.hostname === 'cdn.motor1.com' ||
           url.hostname.endsWith('.motor1.uol.com.br'))) return url.toString();
    } catch { /* ignore invalid image URLs */ }
  }
  return null;
}
const cachedCover = unstable_cache(async (raw: string): Promise<string | null> => {
  const article = safeArticleUrl(raw);
  if (!article) return null;
  try {
    const response = await fetch(article, {
      redirect: 'manual',
      signal: AbortSignal.timeout(4500),
      headers: { Accept: 'text/html' },
    });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) return null;
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_HTML_BYTES) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    let total = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (total < MAX_HTML_BYTES) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > MAX_HTML_BYTES) return null;
        chunks.push(next.value);
        // Usually OG metadata is within the first part of the head.
        if (total > 40_000) break;
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    return imageFromHtml(html);
  } catch { return null; }
}, ['watcher-news-cover-v1'], { revalidate: 86400 });

export async function getNewsCover(raw?: string): Promise<string | null> {
  const url = safeArticleUrl(raw);
  return url ? cachedCover(url) : null;
}
