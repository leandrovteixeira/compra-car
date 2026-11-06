/** Cross-source review proposals for a manufacturer XLS MY, without writes.
 * The PDF equipment matrix supplies the XLS cell; the OEM MY-specific page
 * anchors the version/year and may corroborate a value. Neither source
 * silently overrides a contradiction in the other.
 */
import {normalizeAliasLabel} from '../agent-platform/canonical-alias-contract';
import type {FordXls2027SourceAssessment} from './ford-xls-my2027-source-audit';

export type FordEquipmentAvailability27='STANDARD'|'OPTIONAL'|'NOT_AVAILABLE'|'UNKNOWN';
export type FordSourceClaim27=Readonly<{
  concept:string;rawLabel:string;
  value:string|null;unit:string|null;
  availability:FordEquipmentAvailability27;
  sourceUrl:string;sourceSha256:string;
  sourcePage:number|null;
  scope:'XLS_MATRIX_CELL'|'XLS_MY2027_PAGE';
  evidenceExcerpt:string;
}>;
export type FordProductSpecProposal27=Readonly<{
  concept:string;value:string|null;unit:string|null;
  availability:FordEquipmentAvailability27;
  decision:'REVIEW_REQUIRED'|'ABSTAIN';
  reason:string;
  evidence:readonly FordSourceClaim27[];
}>;
const isHash=(s:string)=>/^[0-9a-f]{64}$/u.test(s);
const isOfficial=(s:string)=>{
 try{
  const u=new URL(s);
  return u.protocol==='https:'&&!u.username&&!u.password&&
    ['www.ford.com.br','ford.com.br','media.ford.com'].includes(u.hostname);
 }catch{return false;}
};
const key=(x:FordSourceClaim27)=>normalizeAliasLabel(x.concept);
// A technical value (e.g. "4WD") may legitimately have no physical unit.
// The canonical alias normalizer rejects empty labels, so represent a missing
// unit as null instead of incorrectly normalizing an empty string.
const comparable=(value:string|null):string|null=>
  value===null||!value.trim()?null:normalizeAliasLabel(value);
const equalValue=(a:FordSourceClaim27,b:FordSourceClaim27)=>
  comparable(a.value)===comparable(b.value) &&
  comparable(a.unit)===comparable(b.unit);
export function reconcileFordXls2027Sources(input:{
  htmlAssessment:FordXls2027SourceAssessment;
  pdfClaims:readonly FordSourceClaim27[];
  htmlClaims:readonly FordSourceClaim27[];
}):readonly FordProductSpecProposal27[]{
 if(input.htmlAssessment.status!=='VERIFIED_FOR_REVIEW')
   return input.pdfClaims.map(c=>({concept:c.concept,value:null,unit:null,
     availability:'UNKNOWN',decision:'ABSTAIN',
     reason:'MY2027_HTML_IDENTITY_NOT_VERIFIED',evidence:[c]}));
 const valid=(c:FordSourceClaim27)=>
   c.concept.trim()&&c.rawLabel.trim()&&c.evidenceExcerpt.trim()&&
   isOfficial(c.sourceUrl)&&isHash(c.sourceSha256)&&
   ((c.scope==='XLS_MATRIX_CELL'&&Number.isInteger(c.sourcePage)&&c.sourcePage!>0)||
    (c.scope==='XLS_MY2027_PAGE'&&c.sourcePage===null));
 if(input.pdfClaims.some(c=>c.scope!=='XLS_MATRIX_CELL'||!valid(c))||
   input.htmlClaims.some(c=>c.scope!=='XLS_MY2027_PAGE'||!valid(c)))
   throw new Error('FORD_XLS_SOURCE_PROVENANCE_INVALID');
 const htmlByConcept=new Map<string,FordSourceClaim27[]>();
 for(const c of input.htmlClaims){
   const k=key(c);
   htmlByConcept.set(k,[...(htmlByConcept.get(k)??[]),c]);
 }
 const result:FordProductSpecProposal27[]=[];
 for(const pdf of input.pdfClaims){
   const matching=htmlByConcept.get(key(pdf))??[];
   const evidence=[pdf,...matching];
   if(!matching.length){
     result.push({concept:pdf.concept,value:pdf.value,unit:pdf.unit,
       availability:pdf.availability,decision:'REVIEW_REQUIRED',
       reason:'PDF_XLS_CELL_ONLY_VERIFY_MY2027_CARRYOVER',
       evidence});
     continue;
   }
   if(matching.some(h=>h.availability!==pdf.availability ||
     (h.value!==null&&pdf.value!==null&&!equalValue(h,pdf)))){
     result.push({concept:pdf.concept,value:null,unit:null,
       availability:'UNKNOWN',decision:'ABSTAIN',
       reason:'MANUFACTURER_SOURCES_CONFLICT',evidence});
     continue;
   }
   const matchingValue=matching.find(h=>h.value!==null);
   result.push({concept:pdf.concept,value:matchingValue?.value??pdf.value,
     unit:matchingValue?.unit??pdf.unit,availability:pdf.availability,
     decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',
     evidence});
 }
 // HTML-only claims may be real, but cannot be represented as confirmed PDF
 // matrix equipment when no XLS cell was extracted.
 const pdfKeys=new Set(input.pdfClaims.map(key));
 for(const html of input.htmlClaims){
   if(pdfKeys.has(key(html)))continue;
   result.push({concept:html.concept,value:html.value,unit:html.unit,
     availability:html.availability,decision:'REVIEW_REQUIRED',
     reason:'HTML_MY2027_ONLY_PDF_CELL_UNVERIFIED',evidence:[html]});
 }
 return result;
}
