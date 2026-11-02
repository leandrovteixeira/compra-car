import 'server-only';
import { unstable_cache } from 'next/cache';

// Only fetch article metadata from the explicitly approved publisher.
// This does not fetch or store image binaries; browsers load the public cover URL.
const HOST = 'motor1.uol.com.br';
const MAX_HTML_BYTES = 350_000;
const ARTICLE_HOSTS = new Set([HOST, 'motor1.com.br', 'www.motor1.com.br']);
const isArticleHost = (url: URL) => ARTICLE_HOSTS.has(url.hostname) && url.protocol === 'https:' && !url.username && !url.password;

function safeArticleUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!isArticleHost(url) ||
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
           url.hostname.endsWith('.motor1.uol.com.br') ||
           url.hostname === 'motor1.com.br' || url.hostname.endsWith('.motor1.com.br'))) return url.toString();
    } catch { /* ignore invalid image URLs */ }
  }
  return null;
}
const cachedCover = unstable_cache(async (raw: string): Promise<string | null> => {
  const article = safeArticleUrl(raw);
  if (!article) return null;
  try {
    let target = article;
    let response: Response | null = null;
    for (let hop = 0; hop < 3; hop++) {
      response = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(7000),
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; CompraCarNews/1.0)' },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) break;
      const next = new URL(location, target);
      if (!isArticleHost(next) || !/^\/news\/\d+\//.test(next.pathname)) {
        console.warn('WATCHER_NEWS_IMAGE_REDIRECT_BLOCKED', { status: response.status, host: next.hostname });
        return null;
      }
      target = next.toString();
    }
    if (!response?.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) {
      console.warn('WATCHER_NEWS_IMAGE_HTTP_FAILED', { status: response?.status ?? null, contentType: response?.headers.get('content-type') ?? null });
      return null;
    }
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
        if (total > 120_000 && /<\/head\s*>/i.test(new TextDecoder().decode(Buffer.concat(chunks)))) break;
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const image = imageFromHtml(html);
    if (!image) console.warn('WATCHER_NEWS_IMAGE_MISSING', { source: HOST, httpStatus: response.status, bytesRead: total, metadataFound: /og:image|twitter:image/i.test(html) });
    return image;
  } catch (error) {
    console.warn('WATCHER_NEWS_IMAGE_FETCH_FAILED', error instanceof Error ? error.name : 'UNKNOWN');
    return null;
  }
}, ['watcher-news-cover-v3'], { revalidate: 3600 });

export async function getNewsCover(raw?: string): Promise<string | null> {
  const url = safeArticleUrl(raw);
  return url ? cachedCover(url) : null;
}
