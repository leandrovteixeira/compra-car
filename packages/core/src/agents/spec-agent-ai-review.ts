/** Sprint 27: a single, operator-review-only, metered semantic pass. */
export const SPEC_AI_MODEL_27 = 'gpt-5.4-mini' as const;
export const SPEC_AI_PRICE_27 = {
  inputPerMillionUsd: 0.75,
  cachedInputPerMillionUsd: 0.075,
  outputPerMillionUsd: 4.5,
} as const;
export const SPEC_AI_CAP_USD_27 = 2;
export const SPEC_AI_MAX_OUTPUT_TOKENS_27 = 16000;

export type SpecAiUsage27 = Readonly<{
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCount: 0;
  actualEstimatedCostUsd: number;
  model: string;
}>;
export type SpecAiDecision27 = Readonly<{
  ordinal: number;
  status: 'PROPOSE'|'DECOMPOSE'|'NO_MATCH';
  components: readonly Readonly<{
    sourceFragment: string;
    specCode: string;
    explanation: string;
  }>[];
  note: string;
}>;
export interface SpecAiReviewedProposal27 {
  ordinal: number;
  sourceLabel: string;
  status: SpecAiDecision27['status'];
  components: readonly {
    sourceFragment: string;
    specCode: string;
    explanation: string;
    reviewStatus: 'PENDING_REVIEW';
  }[];
  note: string;
}
export type SpecAiClaim27 = {ordinal:number;sourceLabel:string;page:number};
export type SpecAiCatalog27 = {code:string;label:string;type:'binary'|'numeric'|'scale'};

const safeInteger=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const round=(v:number)=>Math.round(v*1e8)/1e8;
export function measureSpecAiUsage27(input: {
  model:string;inputTokens:number;cachedInputTokens:number;
  outputTokens:number;reasoningTokens:number;
}): SpecAiUsage27 {
  if(input.model!==SPEC_AI_MODEL_27 || ![
    input.inputTokens,input.cachedInputTokens,input.outputTokens,input.reasoningTokens
  ].every(safeInteger)||input.cachedInputTokens>input.inputTokens ||
    input.reasoningTokens>input.outputTokens)throw new Error('SPEC_AI_USAGE_INVALID');
  const p=SPEC_AI_PRICE_27;
  const cost=((input.inputTokens-input.cachedInputTokens)*p.inputPerMillionUsd+
    input.cachedInputTokens*p.cachedInputPerMillionUsd+
    input.outputTokens*p.outputPerMillionUsd)/1e6;
  return {...input,webSearchCount:0,actualEstimatedCostUsd:round(cost)};
}
/** Worst-case token upper bound uses UTF-8 bytes, not an optimistic tokenizer heuristic. */
export function reserveSpecAiBudget27(input:{
  utf8InputBytes:number;maxOutputTokens?:number;hardCapUsd?:number;
}):{reservedMaximumUsd:number;hardCapUsd:number;maxOutputTokens:number}{
  const cap=input.hardCapUsd??SPEC_AI_CAP_USD_27;
  const out=input.maxOutputTokens??SPEC_AI_MAX_OUTPUT_TOKENS_27;
  if(!safeInteger(input.utf8InputBytes)||!safeInteger(out)||out===0||
    !Number.isFinite(cap)||cap<=0||cap>SPEC_AI_CAP_USD_27)throw new Error('SPEC_AI_BUDGET_INVALID');
  const cost=(input.utf8InputBytes*SPEC_AI_PRICE_27.inputPerMillionUsd+
    out*SPEC_AI_PRICE_27.outputPerMillionUsd)/1e6;
  if(cost>cap)throw new Error('SPEC_AI_BUDGET_EXCEEDED');
  return {reservedMaximumUsd:round(cost),hardCapUsd:cap,maxOutputTokens:out};
}
/** This validates externally generated proposals. Never writes aliases or equipment. */
export function validateSpecAiProposals27(input:{
  claims:readonly SpecAiClaim27[];catalog:readonly SpecAiCatalog27[];
  decisions:readonly SpecAiDecision27[];
}):readonly SpecAiReviewedProposal27[]{
  const catalog=new Map(input.catalog.map(s=>[s.code,s]));
  const byClaim=new Map(input.claims.map(c=>[c.ordinal,c]));
  if(byClaim.size!==input.claims.length)throw new Error('SPEC_AI_DUPLICATE_INPUT');
  const seen=new Set<number>();
  const proposals:SpecAiReviewedProposal27[]=[];
  for(const d of input.decisions){
    if(!d||!Number.isSafeInteger(d.ordinal)||seen.has(d.ordinal))throw new Error('SPEC_AI_DUPLICATE_DECISION');
    seen.add(d.ordinal);
    const claim=byClaim.get(d.ordinal);
    if(!claim||!['PROPOSE','DECOMPOSE','NO_MATCH'].includes(d.status)||
       !Array.isArray(d.components)||typeof d.note!=='string')
      throw new Error('SPEC_AI_INVALID_DECISION');
    if(d.components.length>6 || (d.status==='NO_MATCH'&&d.components.length!==0) ||
       (d.status!=='NO_MATCH'&&d.components.length===0))throw new Error('SPEC_AI_INVALID_COMPONENTS');
    const dedupe=new Set<string>();
    const components=d.components.map(c=>{
      const code=c?.specCode;
      const matched=catalog.get(code);
      if(!matched||!c.sourceFragment?.trim()||!c.explanation?.trim()||dedupe.has(code))
        throw new Error('SPEC_AI_HALLUCINATED_OR_DUPLICATE_SPEC');
      dedupe.add(code);
      // Equipment extraction only: numeric specs are never silently mapped to
      // binary assertions. Scale types remain pending for option selection.
      if(matched.type==='numeric')throw new Error('SPEC_AI_NUMERIC_TYPE_MISMATCH');
      return {sourceFragment:c.sourceFragment,specCode:code,explanation:c.explanation,
        reviewStatus:'PENDING_REVIEW' as const};
    });
    proposals.push({ordinal:d.ordinal,sourceLabel:claim.sourceLabel,status:d.status,
      components,note:d.note});
  }
  if(seen.size!==input.claims.length)throw new Error('SPEC_AI_INCOMPLETE_OUTPUT');
  return proposals.sort((a,b)=>a.ordinal-b.ordinal);
}
