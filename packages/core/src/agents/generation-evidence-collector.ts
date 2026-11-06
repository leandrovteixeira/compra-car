/** Selects manufacturer-backed historical image pairs for Generation Vision.
 * This deterministic collector consumes assets extracted by a trusted Brand
 * Connector/PDF adapter. It never scrapes URLs or invents an MY binding.
 */
export type GenerationView = 'FRONT_THREE_QUARTER'|'SIDE'|'REAR_THREE_QUARTER'|'INTERIOR';
export interface GenerationVisualAsset {
  readonly brand: string;
  readonly model: string;
  readonly version: string | null;
  readonly modelYear: number;
  readonly sourceUrl: string;
  readonly assetUrl: string;
  readonly sha256: string;
  readonly capturedAt: string;
  readonly view: GenerationView;
  readonly verifiedModelYear: boolean;
  readonly verifiedModel: boolean;
  readonly sourceAuthority: 'MANUFACTURER'|'DEALER'|'SECONDARY';
}
export interface GenerationEvidencePair {
  readonly previous: GenerationVisualAsset;
  readonly current: GenerationVisualAsset;
  readonly view: GenerationView;
}
export type GenerationEvidenceSelection =
  | { readonly status:'READY'; readonly pair:GenerationEvidencePair }
  | { readonly status:'UNKNOWN'; readonly reason:
      'NO_COMPARABLE_OFFICIAL_IMAGES'|'UNVERIFIED_MODEL_YEAR'|
      'UNVERIFIED_MODEL'|'AMBIGUOUS_MODEL_YEAR_BINDING' };
const priority:readonly GenerationView[]=[
  'SIDE','FRONT_THREE_QUARTER','REAR_THREE_QUARTER','INTERIOR',
];
const normalized=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .replace(/[^a-z0-9]/giu,'').toLowerCase();
function officialUrl(url:string,hosts:readonly string[]):boolean {
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
      hosts.some(host=>u.hostname.toLowerCase()===host.toLowerCase()||
        u.hostname.toLowerCase().endsWith('.'+host.toLowerCase()));
  }catch{return false;}
}
function eligible(a:GenerationVisualAsset,brand:string,model:string,hosts:readonly string[]):boolean{
  return a.sourceAuthority==='MANUFACTURER'&&a.verifiedModel&&a.verifiedModelYear&&
    normalized(a.brand)===normalized(brand)&&normalized(a.model)===normalized(model)&&
    Number.isInteger(a.modelYear)&&a.modelYear>=2000&&a.modelYear<=2100&&
    /^[a-f0-9]{64}$/u.test(a.sha256)&&
    Number.isFinite(Date.parse(a.capturedAt))&&
    officialUrl(a.sourceUrl,hosts)&&officialUrl(a.assetUrl,hosts);
}
/** Fail-closed: comparing MYs requires two individually verified and distinct
 * historical assets, not two pictures from the current marketing page.
 * An asset belonging to conflicting MYs is rejected to avoid false continuity.
 */
export function selectGenerationEvidencePair(input:{
  brand:string; model:string; previousModelYear:number; currentModelYear:number;
  officialHosts:readonly string[]; assets:readonly GenerationVisualAsset[];
}):GenerationEvidenceSelection{
  if(!input.brand.trim()||!input.model.trim()||!input.officialHosts.length||
    !Number.isInteger(input.previousModelYear)||!Number.isInteger(input.currentModelYear)||
    input.previousModelYear>=input.currentModelYear)throw new Error('GENERATION_EVIDENCE_INPUT_INVALID');
  const relevant=input.assets.filter(a=>
    normalized(a.brand)===normalized(input.brand)&&
    normalized(a.model)===normalized(input.model)&&
    (a.modelYear===input.previousModelYear||a.modelYear===input.currentModelYear));
  if(relevant.some(a=>!a.verifiedModelYear))
    return {status:'UNKNOWN',reason:'UNVERIFIED_MODEL_YEAR'};
  if(relevant.some(a=>!a.verifiedModel))
    return {status:'UNKNOWN',reason:'UNVERIFIED_MODEL'};
  const verified=relevant.filter(a=>eligible(a,input.brand,input.model,input.officialHosts));
  // One immutable image hash must never be relabelled as two different model years.
  const yearsByHash=new Map<string,Set<number>>();
  for(const a of verified){
    const years=yearsByHash.get(a.sha256)??new Set<number>();
    years.add(a.modelYear);yearsByHash.set(a.sha256,years);
  }
  if([...yearsByHash.values()].some(years=>years.size>1))
    return {status:'UNKNOWN',reason:'AMBIGUOUS_MODEL_YEAR_BINDING'};
  for(const view of priority){
    const before=verified.filter(a=>a.modelYear===input.previousModelYear&&a.view===view);
    const after=verified.filter(a=>a.modelYear===input.currentModelYear&&a.view===view);
    if(!before.length||!after.length)continue;
    // Stable deterministic choice; separate source versions remain auditable.
    const sort=(a:GenerationVisualAsset,b:GenerationVisualAsset)=>
      a.sha256.localeCompare(b.sha256)||a.sourceUrl.localeCompare(b.sourceUrl);
    before.sort(sort);after.sort(sort);
    const b=before[0]!,a=after[0]!;
    return {status:'READY',pair:{previous:b,current:a,view}};
  }
  return {status:'UNKNOWN',reason:'NO_COMPARABLE_OFFICIAL_IMAGES'};
}
