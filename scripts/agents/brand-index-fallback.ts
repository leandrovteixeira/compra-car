import { safeConnectorUrl } from '@compra-car/core/agents';

type Fetcher = typeof fetch;
export type CrawlCounters = {
  httpRequests: number;
  httpFailedRequests: number;
  httpRedirects: number;
  htmlBytesDownloaded: number;
};
const MAX_BODY = 3_000_000;
const PRODUCT_PATH = /\/(?:pt\/)?(?:modelos|veiculos(?:-[a-z]+){0,2}|carros|suvs|electric-vehicles|hybrid-vehicles|commercial-vehicles|utilitarios)\/[a-z0-9][a-z0-9-]*(?:\.html)?$/iu;

function verified(raw: string, base: string, domains: readonly string[]): string | null {
  try {
    const result = new URL(raw.replace(/&amp;/giu, '&'), base);
    if (result.protocol !== 'https:' || result.search || result.hash) return null;
    const safe = safeConnectorUrl(result.href, domains);
    return safe?.startsWith('https://') ? safe : null;
  } catch { return null; }
}

async function fetchSafeText(
  url: string,
  domains: readonly string[],
  fetcher: Fetcher,
  stats: CrawlCounters,
): Promise<{body: string; finalUrl: string} | null> {
  let next = url;
  for (let step=0; step<=2;step++) {
    try {
      if (!verified(next,next,domains)) return null;
      stats.httpRequests++;
      const r=await fetcher(next,{redirect:'manual',signal:AbortSignal.timeout(10000),
        headers:{accept:'application/xml,text/xml,text/plain,text/html'}});
      if ([301,302,303,307,308].includes(r.status)) {
        const location = r.headers.get('location');
        const target = location && verified(location,next,domains);
        if (!target) { stats.httpFailedRequests++; return null; }
        stats.httpRedirects++;next=target;continue;
      }
      if(!r.ok){stats.httpFailedRequests++;return null;}
      const size = Number(r.headers.get('content-length')??0);
      if(size>MAX_BODY){stats.httpFailedRequests++;return null;}
      const kind = r.headers.get('content-type')??'';
      if(!/(?:xml|text\/plain|text\/html)/iu.test(kind)){
        stats.httpFailedRequests++;return null;
      }
      const body=await r.text();
      stats.htmlBytesDownloaded+=Buffer.byteLength(body,'utf8');
      if(body.length>MAX_BODY){stats.httpFailedRequests++;return null;}
      return {body,finalUrl:next};
    }catch{stats.httpFailedRequests++;return null;}
  }
  stats.httpFailedRequests++;return null;
}

export function findEmbeddedProductUrls(
  body:string, base:string, domains:readonly string[],
):readonly string[]{
  // Handles JSON/SPA path strings, including escaped slashes, without
  // executing JS. The URL and HTTPS/hostname checks remain mandatory.
  const normalized=body.replace(/\\u002[fF]/gu,'/')
    .replace(/\\\//gu,'/').replace(/&quot;/giu,'"');
  const found=new Set<string>();
  const matches=normalized.matchAll(/(?:https?:\/\/[a-z0-9.-]+)?\/(?:pt\/)?(?:modelos|veiculos(?:-[a-z]+){0,2}|carros|suvs|electric-vehicles|hybrid-vehicles|commercial-vehicles|utilitarios)\/[a-z0-9][a-z0-9-]*(?:\.html)?/giu);
  for(const match of matches){
    const url=verified(match[0],base,domains);
    if(url && PRODUCT_PATH.test(new URL(url).pathname))found.add(url);
  }
  return [...found];
}

/** Crawl public sitemap indexes to discover SPAs without usable anchors. */
export async function discoverOfficialSitemapProducts(
  indexUrl:string,
  domains:readonly string[],
  fetcher:Fetcher,
  stats:CrawlCounters,
):Promise<readonly string[]>{
  const origin=new URL(indexUrl).origin;
  const sitemap=verified('/sitemap.xml',origin,domains);
  if(!sitemap)return [];
  const queue=[sitemap];
  const visited=new Set<string>();
  const found=new Set<string>();
  while(queue.length && visited.size<5 && found.size<80) {
    const url=queue.shift()!;
    if(visited.has(url))continue;
    visited.add(url);
    const r=await fetchSafeText(url,domains,fetcher,stats);
    if(!r)continue;
    const locations=[...r.body.matchAll(/<loc(?:\s[^>]*)?>([^<]+)<\/loc>/giu)]
      .map(x=>x[1]!.trim().replace(/&amp;/giu,'&'));
    for(const location of locations){
      const target=verified(location,r.finalUrl,domains);
      if(!target)continue;
      if(PRODUCT_PATH.test(new URL(target).pathname))found.add(target);
      else if(/(?:sitemap|site-map)[^/]*\.xml$/iu.test(new URL(target).pathname)
          && !visited.has(target) && queue.length<8)queue.push(target);
    }
  }
  return [...found].slice(0,80);
}

export async function discoverHomepageProductUrls(
  indexUrl:string,
  domains:readonly string[],
  fetcher:Fetcher,
  stats:CrawlCounters,
):Promise<readonly string[]>{
  const origin=new URL(indexUrl).origin;
  const path=new URL(indexUrl).pathname;
  const main=path.startsWith('/pt/') ? origin+'/pt' : origin+'/';
  const url=verified(main,origin,domains);
  if(!url)return [];
  const page=await fetchSafeText(url,domains,fetcher,stats);
  if(!page)return [];
  return findEmbeddedProductUrls(page.body,page.finalUrl,domains);
}
