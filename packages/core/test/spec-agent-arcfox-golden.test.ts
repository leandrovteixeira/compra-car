import { describe, expect, it } from 'vitest';
import { parseBaicSpecMatrix27, parseBaicSpecCell27 } from '../src/agents/spec-agent-baic-matrix';
import { buildBaicSpecDocument27 } from '../src/agents/spec-agent-baic-import';

/**
 * Minimal non-confidential golden excerpts independently checked against:
 * - BAIC Brasil circular 006/2026, technical matrix, pages 2–4.
 * - Servopa Maringá ARCFOX T1 MAX sheet, pages 1–4.
 * These are NOT a complete equipment inventory.
 */
const officialExcerpt = [
  'Especificações técnicas — Arcfox T1 (Brasil)',
  ' 1.3   Potência máxima (kW)                                     70                      70',
  ' 1.4   Torque máximo (N·m)                                      176                     176',
  '1.10   Capacidade da bateria (kWh)                              42.3                    42.3',
  '1.11   Autonomia no ciclo NEDC (km)                             375                     375',
  '1.12   Autonomia no ciclo WLTC (km)                             ≥310                    ≥310',
  '1.13   Programa Brasileiro de Etiquetagem Veicular（PBEV）       283                     283',
  ' 9.8   Controle de cruzeiro adaptativo Stop-and-Go (ACC)        —                       ●',
  ' 7.6   Alto-falantes                                            4                       6',
].join('\n');
const maxCommercialReference = {
  '1.3':70,'1.4':176,'1.10':42.3,'1.11':375,'1.12':310,'1.13':283,'7.6':6,
};
const target={productId:'baic-arcfox-t1-max',modelYear:2027,brand:'BAIC',model:'ARCFOX T1',version:'MAX'};
const evidence={sourceId:'baic-circular-006-2026',documentHash:'golden-excerpt',capturedAt:'2026-11-03T00:00:00Z',authority:'MANUFACTURER' as const};
describe('ARCFOX T1 MAX two-document golden regression',()=>{
  it('matches numerical fields across official circular and MAX dealer presentation',()=>{
    const matrix=parseBaicSpecMatrix27(officialExcerpt);
    expect(matrix.rows).toHaveLength(8);
    const result=buildBaicSpecDocument27({matrix,target,version:'MAX',evidence});
    for (const [rowId,expected] of Object.entries(maxCommercialReference)){
      const row=matrix.rows.find(r=>r.rowId===rowId);
      expect(row, rowId).toBeDefined();
      const parsed=parseBaicSpecCell27(row!.max);
      expect(parsed.kind,rowId).toBe('numeric');
      if(parsed.kind==='numeric') expect(parsed.value).toBe(expected);
    }
    expect(result.document.observations.find(o=>o.label.startsWith('Autonomia no ciclo WLTC'))).toMatchObject({
      methodology:'WLTC',comparisonOperator:'>=',value:310,
    });
    expect(result.document.completeEquipmentInventory).toBe(false);
  });
  it('isolates PRO from MAX ADAS and sound-system distinctions',()=>{
    const matrix=parseBaicSpecMatrix27(officialExcerpt);
    const acc=matrix.rows.find(r=>r.rowId==='9.8')!;
    expect(parseBaicSpecCell27(acc.pro)).toEqual({kind:'binary',availability:'NOT_AVAILABLE'});
    expect(parseBaicSpecCell27(acc.max)).toEqual({kind:'binary',availability:'STANDARD'});
    expect(parseBaicSpecCell27(matrix.rows.find(r=>r.rowId==='7.6')!.max)).toMatchObject({kind:'numeric',value:6});
  });
});
