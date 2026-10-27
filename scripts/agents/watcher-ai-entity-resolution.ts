import type { WatcherIntelligenceContext } from '@compra-car/core/agents';
import type { WatcherReviewItem } from './watcher-ai-review';

type Context = Pick<WatcherIntelligenceContext, 'brands' | 'mmvs'>;
export type WatcherResolvedReview = WatcherReviewItem & Readonly<{
  brandResolution: 'KNOWN_BRAND' | 'UNKNOWN_BRAND' | 'AMBIGUOUS_BRAND' | 'NO_BRAND';
  canonicalBrandId: string | null;
  canonicalBrand: string | null;
  modelResolution: 'KNOWN_MODEL' | 'UNVERIFIED_MODEL' | 'NO_MODEL' | 'NOT_APPLICABLE';
  canonicalModelIds: readonly string[];
  nextAction: 'BRAND_DISCOVERY_REVIEW' | 'MMV_DISCOVERY_REVIEW' |
    'EXISTING_MODEL_EVENT_REVIEW' | 'IDENTITY_DISAMBIGUATION' | 'COMPETITIVE_INTELLIGENCE' | 'OUT_OF_SCOPE_REVIEW';
  applyAllowed: false;
}>;
const norm=(value: string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const normalized=(value:string|null)=>value?norm(value):'';

/** Read-only canonical matching. Brand families and subbrands require review; no automatic creation. */
export function resolveWatcherAiReview(
  item: WatcherReviewItem,
  context: Context,
): WatcherResolvedReview {
  const found=context.brands.filter(b=>item.brand!==null &&
    [b.canonicalName,...b.aliases].some(name=>norm(name)===normalized(item.brand)));
  const brandResolution=item.brand===null?'NO_BRAND':found.length===0?'UNKNOWN_BRAND':
    found.length===1?'KNOWN_BRAND':'AMBIGUOUS_BRAND';
  const brand=found.length===1?found[0]!:null;
  const mmvs=brand && item.model?context.mmvs.filter(m=>
    [brand.canonicalName,...brand.aliases].some(name=>norm(name)===norm(m.brand)) &&
    norm(m.model)===norm(item.model!)):[];
  const modelResolution=item.route!=='CATALOG_REVIEW'?'NOT_APPLICABLE':
    item.model===null?'NO_MODEL':mmvs.length?'KNOWN_MODEL':'UNVERIFIED_MODEL';
  const nextAction:WatcherResolvedReview['nextAction']=
    item.route==='OUT_OF_SCOPE_REVIEW'?'OUT_OF_SCOPE_REVIEW':
    item.route==='COMPETITIVE_INTELLIGENCE'?'COMPETITIVE_INTELLIGENCE':
    brandResolution==='UNKNOWN_BRAND'?'BRAND_DISCOVERY_REVIEW':
    brandResolution!=='KNOWN_BRAND'?'IDENTITY_DISAMBIGUATION':
    modelResolution==='UNVERIFIED_MODEL'?'MMV_DISCOVERY_REVIEW':
    modelResolution==='KNOWN_MODEL'?'EXISTING_MODEL_EVENT_REVIEW':
    'IDENTITY_DISAMBIGUATION';
  return {...item,brandResolution,canonicalBrandId:brand?.id??null,
    canonicalBrand:brand?.canonicalName??null,modelResolution,
    canonicalModelIds:[...new Set(mmvs.map(m=>m.id))],
    nextAction,applyAllowed:false};
}
