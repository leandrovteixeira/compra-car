import type { AdministrativeSpecCatalogItem, UnitConversion } from '../admin/administrative-product-specs';
import { convertUnit } from '../admin/administrative-product-specs';
import type { SpecChange27, CanonicalSpec27 } from './spec-agent-reconciliation';

/**
 * Read-only projection to the existing public.specs / public.product_specs shape.
 * NEVER persist this proposal directly: server must check authorization, MY/product
 * ownership, row version, evidence and idempotency in one transaction.
 */
export interface SpecWriteProposal27 {
  productId: string;
  specId: string;
  specCode: string;
  value: number | null;
  isPresent: boolean | null;
  inputUnit: string | null;
  evidenceSourceId: string | null;
}
export interface SpecWriteHold27 {
  specCode: string;
  reason:
    | 'UNKNOWN_CATALOG_SPEC' | 'KIND_MISMATCH' | 'PROVISIONAL_VALUE'
    | 'OPTIONAL_NEEDS_SEPARATE_STORAGE' | 'NON_SCALAR_VALUE'
    | 'NUMERIC_OPERATOR_NOT_REPRESENTABLE' | 'METHODOLOGY_NOT_REPRESENTABLE'
    | 'UNIT_CONVERSION_REQUIRED' | 'NO_CHANGE';
  detail: string;
}
export interface SpecWritePlan27 {
  readonly upserts: readonly SpecWriteProposal27[];
  readonly holds: readonly SpecWriteHold27[];
}
function binaryPresent(s:CanonicalSpec27):boolean|null {
  if(s.value==='STANDARD') return true;
  if(s.value==='NOT_AVAILABLE') return false;
  return null;
}
export function planSpecWrites27(input:{
  productId:string;
  changes:readonly SpecChange27[];
  catalog:readonly AdministrativeSpecCatalogItem[];
  unitConversions?:readonly UnitConversion[];
}):SpecWritePlan27 {
  const index=new Map(input.catalog.map(s=>[s.code,s]));
  const upserts:SpecWriteProposal27[]=[];
  const holds:SpecWriteHold27[]=[];
  const hold=(specCode:string,reason:SpecWriteHold27['reason'],detail:string):void=>{
    holds.push({specCode,reason,detail});
  };
  for(const change of input.changes){
    const next=change.next;
    const catalog=index.get(next.specCode);
    if(!catalog){hold(next.specCode,'UNKNOWN_CATALOG_SPEC','No canonical public.specs row');continue;}
    if(catalog.type!==next.kind){hold(next.specCode,'KIND_MISMATCH','Source kind differs from canonical spec type');continue;}
    if(!next.confirmed){hold(next.specCode,'PROVISIONAL_VALUE','Inherited values cannot be written as confirmed');continue;}
    if(next.methodology){hold(next.specCode,'METHODOLOGY_NOT_REPRESENTABLE','Requires homologation-specific catalog metric and validated evidence');continue;}
    if(next.kind==='numeric'){
      if(next.comparisonOperator && next.comparisonOperator!=='='){
        hold(next.specCode,'NUMERIC_OPERATOR_NOT_REPRESENTABLE','Database numeric value has no >= or <= semantics');continue;
      }
      if(typeof next.value!=='number'||!Number.isFinite(next.value)){
        hold(next.specCode,'NON_SCALAR_VALUE','Numeric field requires a finite scalar');continue;
      }
      let value=next.value;
      const actualUnit=(next.unit??'').trim();
      const canonicalUnit=(catalog.unit??'').trim();
      if(actualUnit && canonicalUnit && actualUnit.toLowerCase()!==canonicalUnit.toLowerCase()){
        try{value=convertUnit(value,actualUnit,canonicalUnit,input.unitConversions??[]);}
        catch{hold(next.specCode,'UNIT_CONVERSION_REQUIRED',`${actualUnit} -> ${canonicalUnit}`);continue;}
      } else if(Boolean(actualUnit)!==Boolean(canonicalUnit)){
        hold(next.specCode,'UNIT_CONVERSION_REQUIRED','Missing source or canonical unit');continue;
      }
      upserts.push({productId:input.productId,specId:catalog.id,specCode:catalog.code,value,isPresent:null,inputUnit:canonicalUnit||null,evidenceSourceId:next.evidence?.sourceId??null});
      continue;
    }
    if(next.kind==='binary'){
      const present=binaryPresent(next);
      if(present===null){hold(next.specCode,'OPTIONAL_NEEDS_SEPARATE_STORAGE','Optional availability cannot be represented by legacy boolean without losing meaning');continue;}
      upserts.push({productId:input.productId,specId:catalog.id,specCode:catalog.code,value:null,isPresent:present,inputUnit:null,evidenceSourceId:next.evidence?.sourceId??null});
      continue;
    }
    hold(next.specCode,'NON_SCALAR_VALUE','Scale family must select one canonical option; no blind writes');
  }
  return {upserts,holds};
}
