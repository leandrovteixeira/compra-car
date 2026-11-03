import { describe, expect, it } from 'vitest';
import { reconcileSpecDocuments27, type SpecTarget27, type SpecDocument27, type SpecAlias27, type CanonicalSpec27 } from '../src/agents/spec-agent-reconciliation';
const target: SpecTarget27 = { productId:'arcfox-t1-max', modelYear:2027, brand:'BAIC', model:'ARCFOX T1', version:'MAX' };
const evidence = { sourceId:'baic-006-2026', documentHash:'sha256:test', capturedAt:'2026-11-03T00:00:00Z', authority:'MANUFACTURER' as const };
const aliases: SpecAlias27[] = [
  { alias:'Cruzeiro adaptativo Stop & Go (ACC)', specCode:'ACC_STOP_GO', approved:true },
  { alias:'Controle de cruzeiro adaptativo Stop-and-Go (ACC)', specCode:'ACC_STOP_GO', approved:true },
  { alias:'Potência máxima', specCode:'POWER_KW', approved:true },
  { alias:'Ventilação do banco do passageiro', specCode:'PASSENGER_VENT', approved:true, brand:'BAIC' },
];
const document = (observations: SpecDocument27['observations'], completeEquipmentInventory = true): SpecDocument27 => ({ target, evidence, completeEquipmentInventory, observations });
describe('Sprint 27 Spec Agent kernel', () => {
  it('reconciles synonymous terminology without duplicate specs', () => {
    const docs = [document([{ label:'Controle de cruzeiro adaptativo Stop-and-Go (ACC)',kind:'binary',value:'STANDARD',evidence }]),document([{ label:'Cruzeiro adaptativo Stop & Go (ACC)',kind:'binary',value:'STANDARD',evidence }])];
    const result = reconcileSpecDocuments27({target,documents:docs,aliases,binaryCatalog:['ACC_STOP_GO'],budgetUsd:2,estimatedCostUsd:.07});
    expect(result.specs.filter(x => x.specCode === 'ACC_STOP_GO')).toHaveLength(1);
    expect(result.telemetry.deterministicMatches).toBe(2);
    expect(result.telemetry.estimatedCostUsd).toBe(.07);
  });
  it('removes unmentioned binary equipment on a complete new MY, but inherits missing numeric values', () => {
    const previous: CanonicalSpec27[] = [
      {specCode:'PASSENGER_VENT',kind:'binary',value:'STANDARD',confirmed:true},
      {specCode:'POWER_KW',kind:'numeric',value:70,unit:'kW',confirmed:true}
    ];
    const result = reconcileSpecDocuments27({target,documents:[document([])],aliases,binaryCatalog:['PASSENGER_VENT'],previousModelYearSpecs:previous,predecessorModelYear:2025});
    expect(result.specs.find(x => x.specCode === 'PASSENGER_VENT')?.value).toBe('NOT_AVAILABLE');
    expect(result.specs.find(x => x.specCode === 'POWER_KW')?.confirmed).toBe(false);
    expect(result.status).toBe('PENDING_REVIEW');
  });
  it('never treats unknown aliases as automatically approved', () => {
    const result = reconcileSpecDocuments27({target,documents:[document([{label:'Magic Driver',kind:'binary',value:'STANDARD',evidence}],false)],aliases,binaryCatalog:[]});
    expect(result.findings.some(f => f.code === 'UNKNOWN_ALIAS')).toBe(true);
    expect(result.specs).toHaveLength(0);
  });
  it('does not infer absence from a partial PDF', () => {
    const result = reconcileSpecDocuments27({target,documents:[document([],false)],aliases,binaryCatalog:['ACC_STOP_GO']});
    expect(result.specs).toHaveLength(0);
    expect(result.status).toBe('PENDING_REVIEW');
  });
  it('rejects invented predecessor model year and type-incompatible matches', () => {
    const prev: CanonicalSpec27[] = [{specCode:'POWER_KW',kind:'numeric',value:70,unit:'kW',confirmed:true}];
    expect(()=>reconcileSpecDocuments27({target,documents:[],aliases,binaryCatalog:[],previousModelYearSpecs:prev})).toThrow('SPEC_PREDECESSOR_REQUIRED');
    const conflicting = reconcileSpecDocuments27({target,documents:[document([{label:'Potência máxima',kind:'binary',value:'STANDARD',evidence}],false)],aliases,binaryCatalog:[],existingCurrentSpecs:prev});
    expect(conflicting.findings.some(f=>f.code==='VALUE_CONFLICT')).toBe(true);
    expect(conflicting.specs.find(x=>x.specCode==='POWER_KW')?.value).toBe(70);
  });
  it('enforces per-run budget', () => {
    expect(() => reconcileSpecDocuments27({target,documents:[],aliases,binaryCatalog:[],estimatedCostUsd:2.01})).toThrow('SPEC_BUDGET_EXCEEDED');
  });
  it('prefers regulatory values when replacing lower-authority evidence', () => {
    const prior: CanonicalSpec27[] = [{specCode:'POWER_KW',kind:'numeric',value:69,unit:'kW',confirmed:true,evidence}];
    const regulator = {...evidence, sourceId:'official',authority:'REGULATORY' as const};
    const result = reconcileSpecDocuments27({target,documents:[document([{label:'Potência máxima',kind:'numeric',value:70,unit:'kW',evidence:regulator}],false)],aliases,binaryCatalog:[],existingCurrentSpecs:prior});
    expect(result.specs.find(s => s.specCode === 'POWER_KW')?.value).toBe(70);
  });
});
