/** Source quality is independent from manufacturer authority.
 * The Ranger PDF's capacity table has an unverified six-column geometry;
 * its clipped 4WD glyph may be read as 4WU. No speculative correction.
 */
import type {FordProductSpecProposal27} from './ford-xls-2027-source-fusion';

export type SourceQuality27='CORROBORATED'|'PDF_ONLY_UNVERIFIED'|'SOURCE_AMBIGUOUS';
export type GuardedFordProposal27=FordProductSpecProposal27 & Readonly<{
 quality:SourceQuality27;
 sourceQualityReasons:readonly string[];
 eligibleForCatalogApplication:false;
}>;
const fold=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
 .toLowerCase().replace(/\s+/gu,' ').trim();
const capacityPattern=/\b(?:peso|carga|capacidade|dimensoes|comprimento|largura|altura|entre eixos|tanque|imersao)\b/u;
export function gateFordXlsSourceQuality27(
 proposals:readonly FordProductSpecProposal27[]
):readonly GuardedFordProposal27[]{
 return proposals.map(proposal=>{
  const pdf=proposal.evidence.find(e=>e.scope==='XLS_MATRIX_CELL');
  const html=proposal.evidence.find(e=>e.scope==='XLS_MY2027_PAGE');
  const label=fold(proposal.concept);
  const pdfExcerpt=fold(pdf?.evidenceExcerpt??'');
  const reasons:string[]=[];
  const capacity=capacityPattern.test(label)||pdfExcerpt.includes('secao: dimensions');
  if(pdf && capacity)reasons.push('PDF_CAPACITY_COLUMN_COUNT_UNVERIFIED');
  if(pdf && (/\b4wu\b/u.test(pdfExcerpt)||label==='tracao'&&pdf?.availability==='UNKNOWN'))
   reasons.push('PDF_CLIPPED_DRIVETRAIN_GLYPH');
  if(proposal.decision==='ABSTAIN')reasons.push(proposal.reason);
  if(!html)reasons.push('NO_MY2027_HTML_CORROBORATION');
  if(!pdf)reasons.push('NO_PDF_CELL_CORROBORATION');
  const ambiguous=reasons.some(x=>x.startsWith('PDF_')||
    x==='MANUFACTURER_SOURCES_CONFLICT'||x==='MY2027_HTML_IDENTITY_NOT_VERIFIED');
  const quality:SourceQuality27=ambiguous?'SOURCE_AMBIGUOUS':
    html&&pdf&&proposal.reason==='BOTH_OFFICIAL_SOURCES_CORROBORATE'?
      'CORROBORATED':'PDF_ONLY_UNVERIFIED';
  return {...proposal,quality,sourceQualityReasons:reasons,
    // This pipeline generates evidence and review drafts, never canonical writes.
    eligibleForCatalogApplication:false as const,
    ...(ambiguous?{decision:'ABSTAIN' as const,value:null,unit:null,
      availability:'UNKNOWN' as const,reason:'SOURCE_QUALITY_GATE_BLOCKED'}:{})
  };
 });
}
