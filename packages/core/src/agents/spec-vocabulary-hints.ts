/** Conservative read-only recommendations for unclassified source vocabulary.
 * These are review hints, never an approved alias or canonical spec writes.
 */
import {normalizeAliasLabel} from '../agent-platform/canonical-alias-contract';
import {separateSpecConceptAndValue27} from './spec-claim-value-separation';

export type VocabularyCandidate27=Readonly<{
  code:string;label:string;kind:'binary'|'numeric'|'scale';
  unit:string|null;
}>;
export type VocabularyHint27=Readonly<{
  code:string;label:string;score:number;
  reasons:readonly string[];
}>;

const stop=new Set(['a','as','o','os','de','da','do','das','dos','com',
  'no','na','nos','nas','em','para','por','um','uma','e','sistema','tipo']);
const tokens=(value:string)=>[...new Set(normalizeAliasLabel(value)
  .split(/\s+/u).map(x=>x.replace(/[^a-z0-9]/gu,''))
  .filter(x=>x.length>1&&!stop.has(x)))];
const family=(text:string):'AUX_12V'|'TRACTION_HV'|'BATTERY_UNKNOWN'|'OTHER'=>{
  const s=normalizeAliasLabel(text);
  if(!/bateri/u.test(s))return 'OTHER';
  if(/tracao|alta tensao|alta voltagem|kwh|high voltage|traction|hv\b/u.test(s))
    return 'TRACTION_HV';
  if(/auxiliar|baixa tensao|12\s*v\b|agm|chumbo/u.test(s))return 'AUX_12V';
  return 'BATTERY_UNKNOWN';
};
const fuel=(text:string):'DIESEL'|'GASOLINE'|'ETHANOL'|'UNKNOWN'=>{
  const s=normalizeAliasLabel(text);
  if(/diesel/u.test(s))return 'DIESEL';
  if(/gasolina/u.test(s))return 'GASOLINE';
  if(/etanol/u.test(s))return 'ETHANOL';
  return 'UNKNOWN';
};
const normalizedUnit=(value:string|null|undefined)=>(value??'')
  .toLowerCase().replace(/\s+/gu,'').replace('polegadas','inch')
  .replace('polegada','inch').replace('inches','inch');
/** Returns an ordered shortlist for operator inspection only.
 * Unknown battery chemistry or electric traction cannot be guessed.
 */
export function suggestVocabularyMatches27(input:{
  label:string;rawLabel?:string;kind:'binary'|'numeric'|'scale';
  unit?:string|null;catalog:readonly VocabularyCandidate27[];
  limit?:number;
}):readonly VocabularyHint27[]{
 const max=input.limit??5;
 if(!Number.isInteger(max)||max<1||max>20)throw Error('SPEC_HINT_LIMIT_INVALID');
 const separated=separateSpecConceptAndValue27(input.rawLabel??input.label);
 const name=normalizeAliasLabel(separated.valueSource==='EMBEDDED_LABEL'
   ?separated.specLabel:input.label);
 const effectiveUnit=normalizedUnit(input.unit??separated.observedUnit);
 const a=tokens(name);
 const candidates:VocabularyHint27[]=[];
 const sourceFamily=family([input.label,input.rawLabel??'',input.unit??''].join(' '));
 const sourceFuel=fuel([input.label,input.rawLabel??''].join(' '));
 for(const c of input.catalog){
   if(c.kind!==input.kind)continue;
   const targetFamily=family([c.label,c.unit??''].join(' '));
   // Never cross the auxiliary/traction boundary. An unspecified battery
   // context is not enough to recommend an HV field.
   if(sourceFamily!==targetFamily &&
     (sourceFamily!=='OTHER'||targetFamily!=='OTHER'))continue;
   if(sourceFamily==='BATTERY_UNKNOWN')continue;
   const targetFuel=fuel(c.label);
   if(sourceFuel!==targetFuel&&(sourceFuel!=='UNKNOWN'||targetFuel!=='UNKNOWN'))continue;
   // No diesel consumption suggestion for gasoline/ethanol columns.
   if(sourceFuel==='UNKNOWN'&&targetFuel!=='UNKNOWN'&&
     /consum/u.test(name))continue;
   const targetUnit=normalizedUnit(c.unit);
   if(input.kind==='numeric'&&effectiveUnit&&targetUnit&&effectiveUnit!==targetUnit)continue;
   const b=tokens(c.label);
   const shared=a.filter(t=>b.includes(t)).length;
   const denom=a.length+b.length-shared;
   const score=denom?shared/denom:0;
   const exact=name===normalizeAliasLabel(c.label);
   const adjusted=exact?1:Math.round(score*1000)/1000;
   if(adjusted<0.25)continue;
   candidates.push({code:c.code,label:c.label,score:adjusted,
     reasons:[exact?'EXACT_LABEL':'LEXICAL_REVIEW_HINT',
       ...(effectiveUnit&&targetUnit&&effectiveUnit===targetUnit?['UNIT_MATCH']:[])]});
 }
 return candidates.sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code))
   .slice(0,max);
}
