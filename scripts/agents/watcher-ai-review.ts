import type { WatcherAiExtractedEvent } from '@compra-car/adapter-openai';

export type WatcherReviewItem = Readonly<{
  category: WatcherAiExtractedEvent['category'];
  brand: string | null;
  model: string | null;
  version: string | null;
  market: WatcherAiExtractedEvent['market'];
  uncertain: boolean;
  evidences: readonly string[];
  route: 'CATALOG_REVIEW' | 'COMPETITIVE_INTELLIGENCE' | 'OUT_OF_SCOPE_REVIEW';
  status: 'REVIEW_REQUIRED';
}>;

const catalogEvents = new Set<WatcherAiExtractedEvent['category']>([
  'NEW_MODEL','NEW_VERSION','MODEL_YEAR','POWERTRAIN','FACELIFT','MSRP','PROMOTION','MARKET_ENTRY',
]);
const motorcycles = new Set(['f 450 gs','cg 160']);
function key(value: string | null): string {
  return (value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
/** Local-only output projection. Never writes product or canonical entities. */
export function reviewWatcherAiEvents(events: readonly WatcherAiExtractedEvent[]): readonly WatcherReviewItem[] {
  const unique=new Map<string,WatcherReviewItem>();
  for(const e of events) {
    // Do not turn brand families into fake vehicle identities: e.g. Chery Lepas.
    const route:WatcherReviewItem['route']=motorcycles.has(key(e.model))
      ? 'OUT_OF_SCOPE_REVIEW'
      : catalogEvents.has(e.category) ? 'CATALOG_REVIEW' : 'COMPETITIVE_INTELLIGENCE';
    const fingerprint=[e.category,key(e.brand),key(e.model),key(e.version),e.market].join('|');
    const prior=unique.get(fingerprint);
    if(prior) {
      unique.set(fingerprint,{...prior,uncertain:prior.uncertain||e.uncertain,
        evidences:[...new Set([...prior.evidences,e.evidence])]});
    } else {
      unique.set(fingerprint,{category:e.category,brand:e.brand,model:e.model,
        version:e.version,market:e.market,uncertain:e.uncertain,
        evidences:[e.evidence],route,status:'REVIEW_REQUIRED'});
    }
  }
  return [...unique.values()];
}
