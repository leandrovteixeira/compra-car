import { describe, expect, it } from 'vitest';
import { parseBaicSpecMatrix27 } from '../src/agents/spec-agent-baic-matrix';
import { buildBaicSpecDocument27 } from '../src/agents/spec-agent-baic-import';
const target = {productId:'arcfox-max',modelYear:2027,brand:'BAIC',model:'ARCFOX T1',version:'MAX'};
const evidence = {sourceId:'baic-official',documentHash:'hash',capturedAt:'2026-11-03',authority:'MANUFACTURER' as const};
describe('BAIC version-scoped import adapter', () => {
 it('keeps PRO/MAX separated and preserves numeric operators', () => {
   const parsed = parseBaicSpecMatrix27([
     'Especificações técnicas — Arcfox T1 (Brasil)',
     ' 1.7   Velocidade máxima (km/h)           ≥140                ≥140',
     ' 9.8   Controle de cruzeiro adaptativo    —                   ●',
   ].join('\n'));
   const result = buildBaicSpecDocument27({matrix:parsed,target,version:'MAX',evidence});
   expect(result.document.observations[0]).toMatchObject({kind:'numeric',value:140,comparisonOperator:'>='});
   expect(result.document.observations[1]).toMatchObject({kind:'binary',value:'STANDARD'});
   expect(result.document.completeEquipmentInventory).toBe(true);
 });
 it('rejects wrong target version rather than misassigning a vehicle', () => {
   expect(()=>buildBaicSpecDocument27({matrix:parseBaicSpecMatrix27(''),target,version:'PRO',evidence})).toThrow('BAIC_VERSION_MISMATCH');
 });
 it('does not claim completeness with malformed source rows', () => {
   const parsed=parseBaicSpecMatrix27('Especificações técnicas — Arcfox T1 (Brasil)\n 6.3   Ajuste do banco do motorista');
   const result=buildBaicSpecDocument27({matrix:parsed,target,version:'MAX',evidence});
   expect(result.reviewRows).toHaveLength(1);
   expect(result.document.completeEquipmentInventory).toBe(false);
 });
});
