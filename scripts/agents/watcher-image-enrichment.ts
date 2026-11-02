import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';

// Media metadata is deliberately separate from immutable news evidence.
const PUBLISHER = 'motor1.uol.com.br';
const IMAGE_HOSTS = new Set(['cdn.motor1.com', 'motor1.uol.com.br']);
const MAX_BYTES = 300_000;
const LIMIT = 5;

function coverFromHtml(html: string): string | null {
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs = new Map<string, string>();
    for (const attribute of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi))
      attrs.set(attribute[1].toLowerCase(), attribute[3]);
    if (!['og:image', 'twitter:image', 'twitter:image:src'].includes(attrs.get('property') ?? attrs.get('name') ?? '')) continue;
    try {
      const url = new URL((attrs.get('content') ?? '').replace(/&amp;/g, '&'));
      if (url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) && !url.username && !url.password) return url.toString();
    } catch { /* invalid metadata */ }
  }
  return null;
}
async function resolveCover(raw: string): Promise<{image: string | null; error: string | null}> {
  let current: URL;
  try {
    current = new URL(raw);
    if (current.protocol !== 'https:' || current.hostname !== PUBLISHER ||
      !/^\/news\/\d+\//.test(current.pathname)) return {image:null,error:'INVALID_ARTICLE_URL'};
    if (!current.pathname.endsWith('/')) current.pathname += '/';
  } catch { return {image:null,error:'INVALID_ARTICLE_URL'}; }
  try {
    for (let i=0;i<4;i++) {
      const response = await fetch(current, {
        redirect:'manual',signal:AbortSignal.timeout(6000),
        headers:{Accept:'text/html', 'User-Agent':'CompraCarWatcher/1.0'},
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');
        if (!location) return {image:null,error:'REDIRECT_NO_LOCATION'};
        const next=new URL(location,current);
        if (next.protocol !== 'https:' || next.hostname !== PUBLISHER || next.username || next.password)
          return {image:null,error:'UNSAFE_REDIRECT'};
        if (next.toString()===current.toString()) return {image:null,error:'REDIRECT_LOOP'};
        current=next;continue;
      }
      if (!response.ok) return {image:null,error:'HTTP_'+response.status};
      if (!(response.headers.get('content-type')??'').includes('text/html'))
        return {image:null,error:'NOT_HTML'};
      if (!response.body) return {image:null,error:'EMPTY_BODY'};
      const reader=response.body.getReader();
      const chunks:Uint8Array[]=[];let bytes=0;
      try {
        while (bytes<MAX_BYTES) {
          const part=await reader.read();
          if(part.done)break;
          bytes+=part.value.byteLength;
          if(bytes>MAX_BYTES)break;
          chunks.push(part.value);
          if(new TextDecoder().decode(Buffer.concat(chunks)).includes('</head>'))break;
        }
      } finally { await reader.cancel().catch(()=>undefined); }
      const image=coverFromHtml(new TextDecoder().decode(Buffer.concat(chunks)));
      return {image,error:image?null:'OG_IMAGE_MISSING'};
    }
    return {image:null,error:'REDIRECT_LIMIT'};
  } catch(e) {
    return {image:null,error:e instanceof Error&&e.name==='TimeoutError'?'TIMEOUT':'FETCH_FAILED'};
  }
}
type Db = ReturnType<typeof createLegacySupabaseClient>;
export async function enrichWatcherImages(client: Db): Promise<void> {
  // Bounded and independent: no image error can roll back the news collector.
  const {data:revisions,error:readError}=await client.from('watcher_article_revisions')
    .select('id,item_payload').order('first_observed_at',{ascending:false}).limit(150);
  if(readError) {console.warn('WATCHER_IMAGES_READ_FAILED');return;}
  const rows=revisions??[];
  if(!rows.length)return;
  const ids=rows.map(x=>x.id as string);
  const {data:seen,error:seenError}=await client.from('watcher_article_images')
    .select('revision_id').in('revision_id',ids);
  if(seenError){console.warn('WATCHER_IMAGES_JOURNAL_FAILED');return;}
  const done=new Set((seen??[]).map(x=>x.revision_id as string));
  const pending=rows.filter(x=>!done.has(x.id as string)).slice(0,LIMIT);
  let found=0;
  for(const row of pending){
    const url=(row.item_payload as {url?:string}|null)?.url ?? '';
    const result=await resolveCover(url);
    const {error}=await client.from('watcher_article_images').upsert({
      revision_id:row.id,image_url:result.image,status:result.image?'FOUND':result.error==='OG_IMAGE_MISSING'?'MISSING':'FAILED',
      error_code:result.error,checked_at:new Date().toISOString(),
    },{onConflict:'revision_id'});
    if(error){console.warn('WATCHER_IMAGES_WRITE_FAILED');continue;}
    if(result.image)found++;
    else console.warn('WATCHER_IMAGES_LOOKUP',result.error);
  }
  console.log(JSON.stringify({stage:'WATCHER_IMAGES',checked:pending.length,found}));
}
