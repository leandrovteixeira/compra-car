import {describe,it,expect} from 'vitest';
import {gateFordXlsSourceQuality27} from '../src/agents/ford-xls-source-quality-gate';
import type {FordProductSpecProposal27,FordSourceClaim27} from '../src/agents/ford-xls-2027-source-fusion';
const pdf:FordSourceClaim27={concept:'Tração',rawLabel:'Tração',value:null,unit:null,
 availability:'UNKNOWN',sourceUrl:'https://www.ford.com.br/a.pdf',
 sourceSha256:'a'.repeat(64),sourcePage:2,scope:'XLS_MATRIX_CELL',
 evidenceExcerpt:'Coluna XLS | Seção: PERFORMANCE | Linha 5 células: 4X4 | 4X2 | 4WU | 4WU | 4WU'};
const html:FordSourceClaim27={...pdf,value:'4WD',availability:'STANDARD',sourcePage:null,
 scope:'XLS_MY2027_PAGE',sourceUrl:'https://www.ford.com.br/ford-ranger',
 sourceSha256:'b'.repeat(64),evidenceExcerpt:'Tração 4WD'};
const proposal=(overrides:Partial<FordProductSpecProposal27>={}):FordProductSpecProposal27=>({
 concept:'Tração',value:null,unit:null,availability:'UNKNOWN',decision:'ABSTAIN',
 reason:'MANUFACTURER_SOURCES_CONFLICT',evidence:[pdf,html],...overrides
});
describe('S27D Ford source quality gate',()=>{
 it('blocks clipped glyph, preserving both sources for operator',()=>{
  const result=gateFordXlsSourceQuality27([proposal()])[0]!;
  expect(result.quality).toBe('SOURCE_AMBIGUOUS');
  expect(result.sourceQualityReasons).toContain('PDF_CLIPPED_DRIVETRAIN_GLYPH');
  expect(result.eligibleForCatalogApplication).toBe(false);
  expect(result.evidence).toHaveLength(2);
 });
 it('blocks capacity rows even when two official sources appear to agree',()=>{
  const p=proposal({concept:'Capacidade de carga (kg)',value:'1054',unit:'kg',
   availability:'STANDARD',decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',
   evidence:[{...pdf,concept:'Capacidade de carga (kg)',value:'1054',unit:'kg',
    availability:'STANDARD',evidenceExcerpt:'Seção: DIMENSIONS | Coluna 3/5: 1054'},html]});
  const v=gateFordXlsSourceQuality27([p])[0]!;
  expect(v).toMatchObject({quality:'SOURCE_AMBIGUOUS',decision:'ABSTAIN',
   value:null,availability:'UNKNOWN',eligibleForCatalogApplication:false});
  expect(v.sourceQualityReasons).toContain('PDF_CAPACITY_COLUMN_COUNT_UNVERIFIED');
 });
 it('keeps non-capacity dual-source rows reviewable but not auto-applicable',()=>{
  const p=proposal({concept:'Faróis de neblina em Led',value:null,availability:'STANDARD',
   decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',
   evidence:[{...pdf,rawLabel:'Faróis de neblina em Led',availability:'STANDARD',
    evidenceExcerpt:'Seção: EXTERIOR | Linha: Faróis de neblina em Led'},
    {...html,rawLabel:'Faróis de neblina em Led'}]});
  expect(gateFordXlsSourceQuality27([p])[0]).toMatchObject({
   quality:'CORROBORATED',decision:'REVIEW_REQUIRED',
   eligibleForCatalogApplication:false
  });
 });
 it('retains PDF-only claims with explicit corroboration warning',()=>{
  const p=proposal({concept:'Degrau de acesso à caçamba',value:null,
   availability:'STANDARD',decision:'REVIEW_REQUIRED',
   reason:'PDF_XLS_CELL_ONLY_VERIFY_MY2027_CARRYOVER',evidence:[{...pdf,
    rawLabel:'Degrau de acesso à caçamba',availability:'STANDARD',
    evidenceExcerpt:'Seção: EXTERIOR'}]});
  const v=gateFordXlsSourceQuality27([p])[0]!;
  expect(v.quality).toBe('PDF_ONLY_UNVERIFIED');
  expect(v.sourceQualityReasons).toContain('NO_MY2027_HTML_CORROBORATION');
 });
});