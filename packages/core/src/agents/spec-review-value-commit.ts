/** S27D - approved source evidence -> typed product value.
 * Pure validation; this module NEVER mutates a database.
 * Canonical resolution and value application must share one transaction.
 */
import type {GuardedFordProposal27} from './ford-xls-source-quality-gate';

export type CanonicalValueKind27='numeric'|'binary'|'scale';
export type SpecReviewValue27=Readonly<{
 productId:1236;modelYear:2027;specId:number;kind:'numeric'|'binary';
 value:number|null;isPresent:boolean|null;inputUnit:string|null;
 sourceSha256:string;sourcePage:number;
 label:string;sourceQuality:'CORROBORATED';
}>;
export class SpecValueReviewError27 extends Error {
 constructor(readonly code:string){super(code);this.name='SpecValueReviewError27';}
}
export function planApprovedSpecValue27(input:{
 proposal:GuardedFordProposal27;
 target:{productId:number;modelYear:number};
 spec:{id:number;type:CanonicalValueKind27;unit:string|null};
}):SpecReviewValue27{
 const {proposal:p,target,spec}=input;
 const reject=(reason:string):never=>{throw new SpecValueReviewError27(reason);};
 if(target.productId!==1236||target.modelYear!==2027||
    !Number.isSafeInteger(spec.id)||spec.id<=0)
  return reject('SPEC_VALUE_TARGET_INVALID');
 if(p.quality!=='CORROBORATED'||p.decision!=='REVIEW_REQUIRED'||
    p.reason!=='BOTH_OFFICIAL_SOURCES_CORROBORATE'||
    p.eligibleForCatalogApplication!==false)
  return reject('SPEC_VALUE_SOURCE_NOT_APPROVABLE');
 const pdf=p.evidence.filter(e=>e.scope==='XLS_MATRIX_CELL');
 const html=p.evidence.filter(e=>e.scope==='XLS_MY2027_PAGE');
 if(pdf.length!==1||html.length<1||pdf[0]!.sourcePage!==2||
    !/^[0-9a-f]{64}$/u.test(pdf[0]!.sourceSha256)||
    !/^[0-9a-f]{64}$/u.test(html[0]!.sourceSha256))
  return reject('SPEC_VALUE_PROVENANCE_INVALID');
 if(spec.type==='scale')return reject('SPEC_VALUE_SCALE_REQUIRES_MAPPING');
 if(p.availability==='UNKNOWN'||p.availability==='OPTIONAL')
  return reject('SPEC_VALUE_AVAILABILITY_UNRESOLVED');
 let value:number|null=null,isPresent:boolean|null=null;
 if(spec.type==='numeric'){
  if(p.availability!=='STANDARD'||p.value===null||
     !/^-?\d+(?:[.,]\d+)?$/u.test(p.value.trim()))
   return reject('SPEC_VALUE_NUMERIC_UNVERIFIED');
  value=Number(p.value.replace(',','.'));
  if(!Number.isFinite(value))return reject('SPEC_VALUE_NUMERIC_UNVERIFIED');
  const sourceUnit=(p.unit??'').trim().toLowerCase();
  const targetUnit=(spec.unit??'').trim().toLowerCase();
  if(sourceUnit!==targetUnit)
   return reject('SPEC_VALUE_UNIT_CONVERSION_REQUIRED');
 }else{
  if(p.value!==null)return reject('SPEC_VALUE_BINARY_HAS_VALUE');
  if(!['STANDARD','NOT_AVAILABLE'].includes(p.availability))
   return reject('SPEC_VALUE_BINARY_UNVERIFIED');
  isPresent=p.availability==='STANDARD';
 }
 return {productId:1236,modelYear:2027,specId:spec.id,
  kind:spec.type,value,isPresent,inputUnit:spec.unit??null,
  sourceSha256:pdf[0]!.sourceSha256,sourcePage:2,label:p.concept,
  sourceQuality:'CORROBORATED'};
}
