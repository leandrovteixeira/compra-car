import {describe,it,expect} from 'vitest';
import {extractFordXlsHtmlClaims27,normalizeFordPdfTechnicalClaim27} from '../src/agents/ford-xls-my2027-html-evidence';
import {reconcileFordXls2027Sources,type FordSourceClaim27} from '../src/agents/ford-xls-2027-source-fusion';
import type {FordXls2027SourceAssessment} from '../src/agents/ford-xls-my2027-source-audit';
const base=(label:string,value:string|null,availability:FordSourceClaim27['availability']='STANDARD'):FordSourceClaim27=>({
 concept:label,rawLabel:label,value,unit:null,availability,
 sourceUrl:'https://www.ford.com.br/ranger.pdf',sourceSha256:'a'.repeat(64),
 sourcePage:2,scope:'XLS_MATRIX_CELL',evidenceExcerpt:'Célula XLS 4WD: '+(value??'x')
});
const verified:FordXls2027SourceAssessment={
 status:'VERIFIED_FOR_REVIEW',reason:'test',
 vehicle:{brand:'Ford',model:'Ranger',version:'XLS 3.0 V6 Diesel 4WD AT',modelYear:2027},evidence:[]
};
const html='Ranger XLS 3.0 V6 Diesel 4WD AT 2027 Cores EXTERIOR Degrau de acesso à caçamba INTERIOR Painel de instrumentos colorido, configuráveis através de comandos no volante 8" SISTEMA MULTIMIDIA SYNC 4 Sistema Multimidia Sync 4 com tela touch screen 10" SEGURANÇA TECNOLOGIA MOTOR E TRANSMISSÃO Potência 250 cv @ 3.250rpm Torque 600 Nm @ 1.750 rpm Tração 4WD Transmissão Automática de 10 velocidades DIMENSÕES E CAPACIDADE Peso do veículo em ordem de Marcha (kg) 2266 Capacidade de imersão (mm) 800 Capacidade de carga (kg) 1054 Tanque de combistível (L) 80 Altura do veículo (mm) 1884 Largura do veículo com espelhos (mm) 2208 Comprimento do veículo (mm) 5370 Distancia entre eixos (mm) 3270 CONECTIVIDADE VIA APP FORD';
describe('Ford XLS manufacturer-source fusion',()=>{
 it('extracts specific 2027 HTML values without guessing absent equipment',()=>{
  const pdf=[base('Peso do veículo em ordem de Marcha (kg)','2095'),
   base('Capacidade de carga (kg)','1005'),base('Potência',null,'UNKNOWN'),
   base('Tração',null,'UNKNOWN'),base('Degrau de acesso a caçamba',null)];
  const normalized=pdf.map((p,i)=>i===2?normalizeFordPdfTechnicalClaim27({
   ...p,evidenceExcerpt:'Célula XLS 4WD: 250 cv @ 3.250 rpm'
  }):normalizeFordPdfTechnicalClaim27(p));
  const htmlClaims=extractFordXlsHtmlClaims27({visibleText:html,sha256:'b'.repeat(64),pdfClaims:normalized});
  const fused=reconcileFordXls2027Sources({htmlAssessment:verified,pdfClaims:normalized,htmlClaims});
  expect(fused.find(x=>x.concept.startsWith('Peso'))).toMatchObject({decision:'ABSTAIN',reason:'MANUFACTURER_SOURCES_CONFLICT'});
  expect(fused.find(x=>x.concept.startsWith('Capacidade de carga'))?.decision).toBe('ABSTAIN');
  expect(fused.find(x=>x.concept==='Potência')).toMatchObject({decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',value:'250'});
  expect(fused.find(x=>x.concept==='Tração')?.decision).toBe('ABSTAIN');
  expect(fused.find(x=>x.concept.startsWith('Degrau'))?.reason).toBe('BOTH_OFFICIAL_SOURCES_CORROBORATE');
 });
 it('normalizes printed technical and dimensional labels, not guesses',()=>{
  expect(normalizeFordPdfTechnicalClaim27(base('Altura do veículo (mm)','1884')).unit).toBe('mm');
  expect(normalizeFordPdfTechnicalClaim27({...base('Torque',null,'UNKNOWN'),
   evidenceExcerpt:'Célula XLS 4WD: 600 Nm @ 1.750 rpm'})).toMatchObject({
   value:'600',unit:'Nm',availability:'STANDARD'
  });
 });
});
