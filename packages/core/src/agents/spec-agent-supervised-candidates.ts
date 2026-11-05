import {createHash} from 'node:crypto';
import {normalizeAliasLabel} from '../agent-platform/canonical-alias-contract';

/** Read-only, brand-independent source claim reconciliation.
 * An exact label is an identification hint, NOT proof of canonical equivalence;
 * approved aliases can resolve automatically. Unmapped labels stay reviewable.
 */
export type SupervisedSpecClaim27=Readonly<{
  ordinal:number;page:number;label:string;kind:'binary'|'numeric'|'scale';
  unit?:string|null;rawValue:string;
}>;
export type SupervisedSpecCatalog27=Readonly<{
  id:string;code:string;label:string;kind:'binary'|'numeric'|'scale';unit?:string|null;
}>;
export type SupervisedSpecAlias27=Readonly<{label:string;specCode:string;approved:boolean}>;
export type SupervisedSpecCandidate27=Readonly<{
  ordinal:number;page:number;label:string;rawValue:string;kind:SupervisedSpecClaim27['kind'];
  status:'MATCHED_ALIAS'|'SPEC_NEW'|'SPEC_AMBIGUOUS';
  matchCode:string|null;candidateCodes:readonly string[];
  fingerprint:string;requiresReview:boolean;
}>;
export function classifySupervisedSpecClaims27(input:{
  brand:string;model:string;version:string;modelYear:number;
  documentSha256:string;claims:readonly SupervisedSpecClaim27[];
  catalog:readonly SupervisedSpecCatalog27[];aliases:readonly SupervisedSpecAlias27[];
}):readonly SupervisedSpecCandidate27[]{
  if(!input.brand?.trim()||!input.model?.trim()||!input.version?.trim()||
    !Number.isInteger(input.modelYear)||input.modelYear<2000||input.modelYear>2100||
    !/^[a-f0-9]{64}$/u.test(input.documentSha256)||!input.claims.length||
    input.claims.length>500||input.catalog.length>2000)
      throw new Error('SPEC_SUPERVISED_INPUT_INVALID');
  const canonical=new Map(input.catalog.map(c=>[c.code,c]));
  if(canonical.size!==input.catalog.length||
      input.catalog.some(c=>!c.id||!c.code||!c.label||!['binary','numeric','scale'].includes(c.kind)))
    throw new Error('SPEC_SUPERVISED_CATALOG_INVALID');
  const seen=new Set<number>();
  return input.claims.map(claim=>{
    if(!Number.isInteger(claim.ordinal)||claim.ordinal<1||seen.has(claim.ordinal)||
      !Number.isInteger(claim.page)||claim.page<1||claim.page>500||
      !claim.label?.trim()||claim.label.length>500||typeof claim.rawValue!=='string'||claim.rawValue.length>500||
      !['binary','numeric','scale'].includes(claim.kind))
      throw new Error('SPEC_SUPERVISED_CLAIM_INVALID');
    seen.add(claim.ordinal);
    const normalized=normalizeAliasLabel(claim.label);
    const eligible=(c:SupervisedSpecCatalog27)=>
      c.kind===claim.kind && (claim.kind!=='numeric'||
        !claim.unit||!c.unit||claim.unit.trim().toLowerCase()===c.unit.trim().toLowerCase());
    const aliasCodes=[...new Set(input.aliases.filter(a=>a.approved&&
      normalizeAliasLabel(a.label)===normalized&&canonical.has(a.specCode)&&
      eligible(canonical.get(a.specCode)!)).map(a=>a.specCode))].sort();
    const exactCodes=[...new Set(input.catalog.filter(c=>
      eligible(c)&&normalizeAliasLabel(c.label)===normalized).map(c=>c.code))].sort();
    // Exact unapproved labels are suggestions, not approved aliases.
    const status=aliasCodes.length===1?'MATCHED_ALIAS':aliasCodes.length>1||
      exactCodes.length>0?'SPEC_AMBIGUOUS':'SPEC_NEW';
    const matchCode=status==='MATCHED_ALIAS'?aliasCodes[0]!:null;
    const candidateCodes=status==='MATCHED_ALIAS'?aliasCodes:
      [...new Set([...aliasCodes,...exactCodes])].sort();
    const fingerprint=createHash('sha256').update(JSON.stringify([
      'SPEC_SUPERVISED_V1',input.brand,input.model,input.version,input.modelYear,
      input.documentSha256,claim.ordinal,claim.page,normalized,claim.kind,
      claim.rawValue,claim.unit??null
    ])).digest('hex');
    return {ordinal:claim.ordinal,page:claim.page,label:claim.label,
      kind:claim.kind,rawValue:claim.rawValue,status,matchCode,candidateCodes,
      fingerprint,requiresReview:status!=='MATCHED_ALIAS'};
  });
}
