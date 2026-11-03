import { describe, expect, it } from 'vitest';
import { normalizeAliasLabel, type CanonicalAlias } from '../src/agent-platform/canonical-alias-contract';
import { previewBaicSpecImport27 } from '../src/agents/spec-agent-pilot';
const alias:CanonicalAlias={
 id:'a1',canonicalId:'spec-acc',rawLabel:'Controle de cruzeiro adaptativo Stop-and-Go (ACC)',
 normalizedLabel:normalizeAliasLabel('Controle de cruzeiro adaptativo Stop-and-Go (ACC)'),
 scope:{kind:'SPEC_FIELD',locale:'pt-BR',categoryKey:'ADAS',sourceContextKey:'BAIC',valueType:'binary'},
 status:'CONFIRMED',sourceUrl:null,sourceFindingId:'finding1',decisionId:'decision1',
 confirmedAt:'2026-11-03T12:00:00Z',revokedAt:null
};
const catalog=[{id:'spec-acc',code:'ACC_STOP_GO',type:'binary' as const,unit:null,
 groupName:'ADAS',equipmentGroup:'Cruise',specSet:'ACC',detail:'ACC'}];
const base={
 pdfLayoutText:'Especificações técnicas — Arcfox T1 (Brasil)\n 9.8   Controle de cruzeiro adaptativo Stop-and-Go (ACC)       —                 ●\n',
 target:{productId:'arcfox-max',brand:'BAIC',model:'ARCFOX T1',version:'MAX',modelYear:2027},
 evidence:{sourceId:'circular-006',documentHash:'sha256-demo',capturedAt:'2026-11-03T12:00:00Z',authority:'MANUFACTURER' as const},
 approvedAliases:[alias],catalog,locale:'pt-BR',categoryKey:'ADAS',
 sourceContextKey:'BAIC',observedAt:'2026-11-03T12:00:00Z'
};
describe('Spec Agent dry-run pipeline',()=>{
 it('joins official PDF matrix to existing canonical catalog without writing',()=>{
  const out=previewBaicSpecImport27(base);
  expect(out.writesApplied).toBe(false);
  expect(out.reconciliation.specs.find(s=>s.specCode==='ACC_STOP_GO')?.value).toBe('STANDARD');
  expect(out.writePlan.upserts).toMatchObject([{specId:'spec-acc',isPresent:true}]);
  expect(out.reconciliation.status).toBe('PENDING_REVIEW');
 });
 it('generates review candidates when contextual alias is missing',()=>{
  const out=previewBaicSpecImport27({...base,approvedAliases:[]});
  expect(out.writePlan.upserts).toHaveLength(0);
  expect(out.reviewCandidates).toHaveLength(1);
  expect(out.reviewCandidates[0]?.caseKind).toBe('SPEC_NEW');
 });
});
