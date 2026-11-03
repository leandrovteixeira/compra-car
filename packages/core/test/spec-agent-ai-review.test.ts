import {describe,expect,it} from 'vitest';
import {
  measureSpecAiUsage27,reserveSpecAiBudget27,validateSpecAiProposals27,
} from '../src/agents/spec-agent-ai-review';
const claims=[{ordinal:1,page:1,sourceLabel:'Bancos elétricos, ventilados e lombar'},
{ordinal:2,page:2,sourceLabel:'ABS + EBD'}];
const catalog=[
  {code:'IN_0008',label:'Banco elétrico',type:'binary' as const},
  {code:'IN_0028',label:'Banco ventilado',type:'binary' as const},
  {code:'SF_0019',label:'EBD',type:'binary' as const},
  {code:'PW_0032',label:'Potência combinada',type:'numeric' as const},
];
describe('S27 Spec AI metering and review-only validation',()=>{
 it('measures actual provider tokens including cache and hard budget preflight',()=>{
  const usage=measureSpecAiUsage27({model:'gpt-5.4-mini',inputTokens:10000,
   cachedInputTokens:2000,outputTokens:3000,reasoningTokens:0});
  expect(usage.actualEstimatedCostUsd).toBeCloseTo((8000*.75+2000*.075+3000*4.5)/1e6,8);
  expect(reserveSpecAiBudget27({utf8InputBytes:45000,maxOutputTokens:16000}).reservedMaximumUsd).toBeLessThan(2);
  expect(()=>reserveSpecAiBudget27({utf8InputBytes:3000000,maxOutputTokens:16000})).toThrow('SPEC_AI_BUDGET_EXCEEDED');
  expect(()=>measureSpecAiUsage27({model:'gpt-5.4-mini',inputTokens:20,cachedInputTokens:21,outputTokens:2,reasoningTokens:0})).toThrow('SPEC_AI_USAGE_INVALID');
 });
 it('allows multi-feature proposals only for operator review',()=>{
  const out=validateSpecAiProposals27({claims,catalog,decisions:[
   {ordinal:1,status:'DECOMPOSE',components:[
    {sourceFragment:'Bancos elétricos',specCode:'IN_0008',explanation:'motorized adjustment'},
    {sourceFragment:'ventilados',specCode:'IN_0028',explanation:'seat ventilation'}],note:'review required'},
   {ordinal:2,status:'PROPOSE',components:[
    {sourceFragment:'EBD',specCode:'SF_0019',explanation:'partial source claim'}],note:'ABS needs separate mapping'}]});
  expect(out[0]?.components[0]?.reviewStatus).toBe('PENDING_REVIEW');
  expect(out[0]?.components).toHaveLength(2);
 });
 it('rejects hallucinated codes, unreviewed numeric mismatch and missing claims',()=>{
  const x={ordinal:1,status:'PROPOSE' as const,components:[
   {sourceFragment:'Bancos',specCode:'NOT_REAL',explanation:'wrong'}],note:''};
  const y={ordinal:2,status:'NO_MATCH' as const,components:[],note:'no mapping'};
  expect(()=>validateSpecAiProposals27({claims,catalog,decisions:[x,y]})).toThrow('SPEC_AI_HALLUCINATED_OR_DUPLICATE_SPEC');
  expect(()=>validateSpecAiProposals27({claims,catalog,decisions:[{...x,components:[
    {sourceFragment:'motor',specCode:'PW_0032',explanation:'invalid type'}]},y]})).toThrow('SPEC_AI_NUMERIC_TYPE_MISMATCH');
  expect(()=>validateSpecAiProposals27({claims,catalog,decisions:[y]})).toThrow('SPEC_AI_INCOMPLETE_OUTPUT');
 });
});
