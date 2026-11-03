import { describe, expect, it } from 'vitest';
import {
  reconcileSpecDocuments27, type SpecAlias27, type SpecTarget27,
  type CanonicalSpec27, type SpecDocument27,
} from '../src/agents/spec-agent-reconciliation';

/**
 * S27 GWM Haval H6 PHEV19 2027 golden slice.
 * Snapshot reviewed against GWM's 2027 Flex PDF:
 * https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/haval-h6-phev19-my25/ficha-tecnica-haval-h6-phev19-flex.pdf
 * QA source: product 1166 (MY2027), versus 1024/1107 (MY2026).
 * This fixture is an intentionally LIMITED technical slice, never an entire inventory.
 * It does not assert database writes, PBEV regulatory confirmation or PDF automatic extraction.
 */
const target: SpecTarget27 = {
  productId:'1166',brand:'GWM',model:'Haval H6',version:'19 1.5 TGDI PHEV DHT',modelYear:2027,
};
const source={
  sourceId:'gwm-h6-phev19-flex-pdf',sourceUrl:
    'https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/haval-h6-phev19-my25/ficha-tecnica-haval-h6-phev19-flex.pdf',
  documentHash:'0'.repeat(64),sourceFamilyId:'gwm-h6-phev19-flex',documentPage:6,
  authority:'MANUFACTURER' as const,capturedAt:'2026-11-03T17:30:00Z',
};
const cases=[
  {code:'PW_0032',label:'Potência combinada (cv)',unit:'cv',old:326,new:326},
  {code:'PW_0033',label:'Torque (Nm)',unit:'Nm',old:540,new:535},
  {code:'PW_0037',label:'0 – 100 km/h (s)',unit:'s',old:7.6,new:7.4},
  {code:'PW_0028',label:'Bateria LFP (Kwh)',unit:'kWh',old:19,new:19},
  {code:'DM_0001',label:'Comprimento (mm)',unit:'mm',old:4703,new:4703},
  {code:'DM_0004',label:'Entre-eixos',unit:'mm',old:2738,new:2738},
  {code:'DM_0006',label:'Capacidade porta-malas (l)',unit:'L',old:560,new:560},
  {code:'DM_0007',label:'Capacidade porta-malas rebatido (l)',unit:'L',old:1445,new:1445},
] as const;
const aliases:SpecAlias27[]=cases.map(c=>({
  alias:c.label,specCode:c.code,approved:true,brand:'GWM',model:'Haval H6',
}));
const previous:CanonicalSpec27[]=cases.map(c=>({
  specCode:c.code,kind:'numeric',unit:c.unit,value:c.old,confirmed:true,
}));
const doc:SpecDocument27={
  target,evidence:source,completeEquipmentInventory:false,
  observations:cases.map(c=>({
    label:c.label,kind:'numeric',value:c.new,unit:c.unit,evidence:source,
  })),
};
describe('GWM Haval H6 PHEV19 2027 MY transition golden',()=>{
  it('identifies changed values without touching the predecessor',()=>{
    const before=JSON.stringify(previous);
    const result=reconcileSpecDocuments27({
      target,documents:[doc],aliases,binaryCatalog:[],
      previousModelYearSpecs:previous,predecessorModelYear:2026,
    });
    const updated=result.changes.filter(c=>c.reason==='UPDATED');
    expect(updated.map(x=>x.specCode).sort()).toEqual(['PW_0033','PW_0037']);
    expect(result.specs.find(s=>s.specCode==='PW_0033')?.value).toBe(535);
    expect(result.specs.find(s=>s.specCode==='PW_0037')?.value).toBe(7.4);
    expect(JSON.stringify(previous)).toBe(before);
  });
  it('does not infer absent binary equipment from a numerical/partial slice',()=>{
    const result=reconcileSpecDocuments27({
      target,documents:[doc],aliases,binaryCatalog:['SF_0015'],
      previousModelYearSpecs:previous,predecessorModelYear:2026,
    });
    expect(result.specs.find(s=>s.specCode==='SF_0015')).toBeUndefined();
    expect(result.status).toBe('PENDING_REVIEW');
  });
});
