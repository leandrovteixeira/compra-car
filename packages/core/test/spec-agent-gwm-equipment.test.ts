import {describe,expect,it} from 'vitest';
import {extractGwmEquipmentClaims27} from '../src/agents/spec-agent-gwm-equipment';
const leftRight=(left:string,right:string,offset:number)=>
  left.padEnd(offset,' ')+right;
const page1=[
 'NOVO','H6 PHEV19','EXTERIOR                                             INTERIOR',
 leftRight('• Sensor de chuva','• Bancos revestidos em couro ecológico',60),
 leftRight('• Teto solar panorâmico elétrico','• Bancos dianteiros com ajuste elétrico e',60),
 leftRight('','  ventilação e ajuste de lombar para o motorista',60),
 'CORES DISPONÍVEIS','PRETO HEMATITA'
].join('\n');
const page2=[
 'NOVO','SEGURANÇA ATIVA E PASSIVA',
 '• ACC adaptativo com função Stop & GO',
 '• 6 airbags (2 frontais e airbags de cortina)',
].join('\n');
const page3=[
 'NOVO','ENTRETENIMENTO',
 leftRight('• Painel de Instrumentos 10,25”','• Atualização de software OTA',61),
 '•      ILUMINAÇÃO',
 leftRight('• Faróis FULL-LED com ajuste de','• Farol alto auto comutativo',61),
 leftRight('       altura','',61),
].join('\n');
const page4=[
 'NOVO','VIDROS E ESPELHOS',
 '• Retrovisor interno antiofuscante automático',
 'AR CONDICIONADO','• AC “dual zone” (motorista e passageiro)'
].join('\n');
describe('GWM equipment pages deterministic text extraction',()=>{
 const parsed=extractGwmEquipmentClaims27([page1,page2,page3,page4].join('\f'));
 it('keeps left/right columns separate with continuation text and categories',()=>{
   expect(parsed.metrics.totalClaims).toBe(12);
   expect(parsed.metrics).toMatchObject({llmCalls:0,databaseWrites:0});
   expect(parsed.claims.some(x=>x.sourceLabel==='Bancos dianteiros com ajuste elétrico e ventilação e ajuste de lombar para o motorista'&&x.category==='INTERIOR')).toBe(true);
   expect(parsed.claims.some(x=>x.sourceLabel==='Faróis FULL-LED com ajuste de altura'&&x.category==='ILUMINAÇÃO')).toBe(true);
 });
 it('excludes header, body colors and inline section header bullets',()=>{
   expect(parsed.claims.every(x=>!x.sourceLabel.includes('CORES DISPONÍVEIS'))).toBe(true);
   expect(parsed.claims.every(x=>x.sourceLabel!=='ILUMINAÇÃO')).toBe(true);
   expect(parsed.warnings).toEqual([]);
 });
 it('rejects truncated documents rather than calling them complete',()=>{
   expect(()=>extractGwmEquipmentClaims27(page1)).toThrow('GWM_EQUIPMENT_PAGES_MISSING');
 });
});
