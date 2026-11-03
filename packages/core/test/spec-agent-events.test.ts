import {describe,expect,it} from 'vitest';
import {planSpecAgentEvent27} from '../src/agents/spec-agent-events';
const base={
 target:{productId:'arcfox-max',brand:'BAIC',model:'ARCFOX T1',version:'MAX',modelYear:2027},
 eventId:'watcher-event-1',trigger:'MMV_VALIDATED' as const,
 createdAt:'2026-11-03T13:00:00Z',dryRun:true,
};
describe('Sprint 27 event gates',()=>{
 it('creates stable dedupe keys for the same event',()=>{
   const result=planSpecAgentEvent27(base);
   expect(result).toEqual(planSpecAgentEvent27({...base}));
   expect(result.runMode).toBe('DRY_RUN');
 });
 it('requires a known document on manual import',()=>{
   expect(()=>planSpecAgentEvent27({...base,trigger:'DOCUMENT_IMPORTED'})).toThrow('SPEC_IMPORT_REQUIRES_DOCUMENT');
 });
 it('requires explicitly supplied predecessor year for MY comparison',()=>{
   expect(()=>planSpecAgentEvent27({...base,trigger:'MODEL_YEAR_CHANGED'})).toThrow('INVALID_SPEC_PREDECESSOR');
   expect(planSpecAgentEvent27({...base,trigger:'MODEL_YEAR_CHANGED',predecessorModelYear:2025}).requiresDocument).toBe(false);
 });
});
