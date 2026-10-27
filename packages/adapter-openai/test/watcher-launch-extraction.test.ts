import {describe,it,expect} from 'vitest';
import {validateWatcherLaunchExtraction} from '../src/watcher-launch-extraction';
const source='A MG confirma oficialmente que IM 6 chegará ao Brasil em março de 2028';
const item={brand:'MG',model:'IM 6',intention:'CONFIRMED',datePrecision:'MONTH',
 expectedStart:'2028-03',expectedEnd:null,evidence:'IM 6 chegará ao Brasil',
 dateEvidence:'março de 2028',officialEvidence:'confirma oficialmente'};
describe('Watcher launch extraction validation',()=>{
 it('accepts supported official Brazilian launch',()=>{
  expect(validateWatcherLaunchExtraction(source,{launches:[item]})).toHaveLength(1);
 });
 it('rejects invented citation',()=>{
  expect(()=>validateWatcherLaunchExtraction(source,{launches:[{...item,evidence:'outra notícia'}]}))
   .toThrow('WATCHER_LAUNCH_AI_EVIDENCE_INVALID');
 });
 it('rejects invented date absent supporting quote',()=>{
  expect(()=>validateWatcherLaunchExtraction(source,{launches:[{...item,dateEvidence:null}]}))
   .toThrow('WATCHER_LAUNCH_AI_EVIDENCE_INVALID');
 });
 it('allows an undated probable launch without manufacturing month',()=>{
  const probable={...item,intention:'PROBABLE',datePrecision:'UNKNOWN',expectedStart:null,
    dateEvidence:null,officialEvidence:null};
  expect(validateWatcherLaunchExtraction(source,{launches:[probable]})).toHaveLength(1);
 });
 it('rejects confirmation without official excerpt',()=>{
  expect(()=>validateWatcherLaunchExtraction(source,{launches:[{...item,officialEvidence:null}]}))
   .toThrow('WATCHER_LAUNCH_AI_EVIDENCE_INVALID');
 });
});
