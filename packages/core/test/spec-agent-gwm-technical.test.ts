import {describe,expect,it} from 'vitest';
import {extractGwmH6Technical27} from '../src/agents/spec-agent-gwm-technical';

const excerpt=[
  'DADOS TÉCNICOS',
  'Bateria LFP (Kwh) 19',
  'Consumo urbano km/l (INMETRO) ETANOL: 10,0 | GASOLINA: 14,7',
  'Consumo rodoviário km/l (INMETRO) ETANOL: 8,9 | GASOLINA: 12,9',
  'Autonomia modo 100% elétrico 115 km (WLTP) | 77 km (INMETRO)',
  'Potência combinada (cv) 326',
  '0 – 100 km/h (s) 7,4',
  'Torque (Nm / kgfm) 535 / 54,5',
  'Capacidade porta-malas (l) 560 / 1.445',
  'Suspensão',
  'Dianteira independente, McPherson, molas',
  'DIMENSÕES',
  'Comprimento (mm) 4.703',
].join('\n');
describe('GWM H6 technical deterministic parser',()=>{
 it('splits fuel, measurement methods, torque and luggage volumes without LLM',()=>{
  const parsed=extractGwmH6Technical27(excerpt);
  const byKey=new Map(parsed.observations.map(s=>[s.fieldKey,s]));
  expect(parsed.summary).toEqual({
   recognizedFields:14,numeric:14,text:0,unresolvedLines:2,llmCalls:0,
  });
  expect(byKey.get('urban_ethanol')).toMatchObject({value:10,methodology:'INMETRO'});
  expect(byKey.get('urban_gasoline')).toMatchObject({value:14.7,methodology:'INMETRO'});
  expect(byKey.get('range_wltp')).toMatchObject({value:115,methodology:'WLTP'});
  expect(byKey.get('range_inmetro')).toMatchObject({value:77,methodology:'INMETRO'});
  expect(byKey.get('torque_nm')?.value).toBe(535);
  expect(byKey.get('torque_kgfm')?.value).toBe(54.5);
  expect(byKey.get('trunk_seats_down')?.value).toBe(1445);
  expect(byKey.get('length')?.value).toBe(4703);
 });
 it('refuses to silently guess unknown or malformed composite fields',()=>{
  const parsed=extractGwmH6Technical27('DADOS TÉCNICOS\nConsumo urbano km/l (INMETRO) 10,0 / 14,7\n');
  expect(parsed.observations).toHaveLength(0);
  expect(parsed.unresolved[0]?.reason).toBe('FUEL_SPLIT_FAILED');
 });
 it('reassembles the exact split-column suspension and brake pattern from PDF layout',()=>{
  const source=[
    'DADOS TÉCNICOS',
    'Dianteira independente, McPherson, molas',
    'helicoidais, amortecedores e barra estabilizadora',
    'Suspensão',
    'Traseira independente, Multilink, molas',
    'helicoidais, amortecedores e barra estabilizadora',
    'Dianteiro: Discos ventilados | Traseiro: Discos',
    'Freios',
    'ventilados',
    'DIMENSÕES',
    'Comprimento (mm) 4.703',
  ].join('\\n');
  const x=extractGwmH6Technical27(source);
  expect(x.unresolved).toHaveLength(0);
  expect(x.summary).toMatchObject({recognizedFields:4,numeric:1,text:3,llmCalls:0});
  expect(x.observations.find(y=>y.fieldKey==='suspension_front')?.value).toContain('McPherson');
  expect(x.observations.find(y=>y.fieldKey==='suspension_rear')?.value).toContain('Multilink');
  expect(x.observations.find(y=>y.fieldKey==='brakes')?.value).toContain('Traseiro: Discos ventilados');
 });
 it('requires the technical section',()=>{
  expect(()=>extractGwmH6Technical27('exterior e interior')).toThrow('GWM_TECHNICAL_SECTION_MISSING');
 });
});
