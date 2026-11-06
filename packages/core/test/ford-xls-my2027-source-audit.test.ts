import {describe,it,expect} from 'vitest';
import {auditFordXls2027VersionPage,FORD_XLS_2027_URL}
 from '../src/agents/ford-xls-my2027-source-audit';
const source={
 sourceUrl:FORD_XLS_2027_URL,
 heading:'Ranger XLS 3.0 V6 Diesel 4WD AT 2027',
 visibleMainText:'Ranger XLS 3.0 V6 Diesel 4WD AT 2027. Motor 3.0 V6 Turbo Diesel. Potência 250cv. Torque 600Nm. Transmissão Automática de 10 velocidades. Sistema multimídia de 10 polegadas. Painel de instrumentos colorido de 8 polegadas.'
};
describe('Ford Ranger XLS MY2027 official page gate',()=>{
 it('accepts an explicit version + MY heading with coherent technical evidence',()=>{
  const result=auditFordXls2027VersionPage(source);
  expect(result.status).toBe('VERIFIED_FOR_REVIEW');
  expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  expect(result.vehicle.modelYear).toBe(2027);
 });
 it('rejects an old model year even if body mentions MY2027 elsewhere',()=>{
  expect(auditFordXls2027VersionPage({...source,heading:'Ranger XLS 3.0 V6 Diesel 4WD AT 2026'})
   .reason).toBe('MODEL_YEAR_OR_VERSION_HEADING_MISSING');
 });
 it('rejects another trim, or non-official source URL',()=>{
  expect(auditFordXls2027VersionPage({...source,heading:'Ranger Limited 3.0 V6 Diesel 4WD AT 2027'})
   .status).toBe('ABSTAIN');
  expect(auditFordXls2027VersionPage({...source,sourceUrl:'https://ford.com.br.evil.test/ranger'})
   .status).toBe('ABSTAIN');
 });
 it('abstains when technical data only appears on another trim or is unavailable',()=>{
  expect(auditFordXls2027VersionPage({...source,visibleMainText:'XLS 2027'}).status)
   .toBe('ABSTAIN');
 });
});
