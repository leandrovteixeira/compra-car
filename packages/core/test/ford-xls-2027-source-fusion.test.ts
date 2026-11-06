import {describe,expect,it} from 'vitest';
import {reconcileFordXls2027Sources,type FordSourceClaim27}
  from '../src/agents/ford-xls-2027-source-fusion';
import type {FordXls2027SourceAssessment}
  from '../src/agents/ford-xls-my2027-source-audit';

const verified:FordXls2027SourceAssessment={
 status:'VERIFIED_FOR_REVIEW',reason:'OFFICIAL_VERSION_HEADING_AND_EVIDENCE',
 vehicle:{brand:'Ford',model:'Ranger',version:'XLS 3.0 V6 Diesel 4WD AT',modelYear:2027},
 evidence:[{field:'powertrain',value:'3.0 V6 diesel',sourceExcerpt:'XLS 2027 V6 diesel'}]
};
const pdf:FordSourceClaim27={
 concept:'Painel de instrumentos digital',
 rawLabel:'Painel de instrumentos colorido de 8”',
 value:'8',unit:'inch',availability:'STANDARD',scope:'XLS_MATRIX_CELL',
 sourceUrl:'https://www.ford.com.br/docs/ranger.pdf',
 sourceSha256:'a'.repeat(64),sourcePage:2,evidenceExcerpt:'XLS: painel colorido 8”'
};
const html:FordSourceClaim27={
 ...pdf,sourceUrl:'https://www.ford.com.br/picapes/ranger/compare-as-versoes/xls-3-0-diesel-4wd-at/',
 sourceSha256:'b'.repeat(64),sourcePage:null,scope:'XLS_MY2027_PAGE',
 evidenceExcerpt:'MY2027 XLS painel de instrumentos de 8”'
};
describe('Ranger XLS dual official source review',()=>{
 it('corroborates same value without writing canonical specs',()=>{
  expect(reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[pdf],htmlClaims:[html]
  })).toEqual([expect.objectContaining({
   concept:'Painel de instrumentos digital',value:'8',unit:'inch',
   decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',
   availability:'STANDARD',evidence:[pdf,html]
  })]);
 });
 it('corroborates unitless drivetrain values without alias normalization failure',()=>{
  const drivetrain={...pdf,concept:'Tração',rawLabel:'Tração',
   value:'4WD',unit:null,availability:'STANDARD' as const};
  const website={...html,concept:'Tração',rawLabel:'Tração',
   value:'4WD',unit:null,availability:'STANDARD' as const};
  const result=reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[drivetrain],htmlClaims:[website]
  });
  expect(result[0]).toMatchObject({
   concept:'Tração',value:'4WD',unit:null,
   decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE'
  });
 });
 it('flags contradictions for unitless technical values',()=>{
  const drivetrain={...pdf,concept:'Tração',rawLabel:'Tração',value:'4WD',unit:null};
  const website={...html,concept:'Tração',rawLabel:'Tração',value:'4x2',unit:null};
  expect(reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[drivetrain],htmlClaims:[website]
  })[0]).toMatchObject({decision:'ABSTAIN',reason:'MANUFACTURER_SOURCES_CONFLICT'});
 });
 it('stops on conflicting screen sizes or equipment availability',()=>{
  const result=reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[pdf],
   htmlClaims:[{...html,value:'12.4',availability:'OPTIONAL'}]
  });
  expect(result[0]).toMatchObject({
   decision:'ABSTAIN',reason:'MANUFACTURER_SOURCES_CONFLICT',
   value:null,availability:'UNKNOWN'
  });
 });
 it('does not assign PDF equipment to MY2027 if HTML MY identity unverified',()=>{
  const result=reconcileFordXls2027Sources({
   htmlAssessment:{...verified,status:'ABSTAIN'},pdfClaims:[pdf],htmlClaims:[]
  });
  expect(result[0]).toMatchObject({
   decision:'ABSTAIN',reason:'MY2027_HTML_IDENTITY_NOT_VERIFIED',value:null
  });
 });
 it('never treats missing HTML or PDF evidence as confirmed cross-source availability',()=>{
  const pdfOnly=reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[pdf],htmlClaims:[]
  });
  expect(pdfOnly[0]?.reason).toBe('PDF_XLS_CELL_ONLY_VERIFY_MY2027_CARRYOVER');
  const htmlOnly=reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[],htmlClaims:[html]
  });
  expect(htmlOnly[0]?.reason).toBe('HTML_MY2027_ONLY_PDF_CELL_UNVERIFIED');
 });
 it('fails closed on fabricated official evidence or wrong source scope',()=>{
  expect(()=>reconcileFordXls2027Sources({
   htmlAssessment:verified,pdfClaims:[{...pdf,sourceUrl:'https://ford.com.br.evil.test/a.pdf'}],
   htmlClaims:[html]
  })).toThrow('FORD_XLS_SOURCE_PROVENANCE_INVALID');
 });
});
