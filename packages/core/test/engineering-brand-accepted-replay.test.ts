import {describe,it,expect} from 'vitest';
import {checkAcceptedBrandReplay,type BrandAcceptedReplay} from '../src/agents/engineering-brand-accepted-replay';
import {connectorFingerprint} from '../src/agents/brand-connector-validation';
import {evaluateBrandWarmReuse,type BrandReplayEvidence} from '../src/agents/engineering-brand-replay';
const connector={brand:'Kia',market:'BR',allowedDomains:['kia.com.br'],
 sourceEntries:[{type:'MODEL_INDEX' as const,url:'https://www.kia.com.br/',priority:1}],
 searchHints:[],terminologyHints:[]};
const evidence:BrandReplayEvidence={connector,independentReview:true,
 reviewReference:'externally-reviewed-run',
 snapshots:[{brand:'Kia',market:'BR',sourceUrl:'https://www.kia.com.br/',
  sourceContentSha256:'a'.repeat(64),capturedAt:'2026-10-09T12:00:00Z'}]};
const research={canonicalBrand:'Kia',aliases:[],observedBrandLabel:'Kia',market:'BR',candidateDomains:['kia.com.br'],
 sourceEntries:connector.sourceEntries,searchHints:[],terminologyHints:[],confidence:0.95,warnings:[],
 evidence:[{url:'https://www.kia.com.br/',title:'Official',excerpt:'Fixture only'}],
 verificationSummary:'fixture',checksPerformed:['checked'],driftDetected:false};
const accepted:BrandAcceptedReplay={brand:'Kia',market:'BR',
 reviewedFindingId:'11111111-1111-4111-8111-111111111111',
 connectorFingerprint:connectorFingerprint(connector),
 sourceSetFingerprint:evaluateBrandWarmReuse(evidence,evidence).fingerprint!,research};
describe('accepted Brand Connector replay admission',()=>{
 it('admits independently reviewed matching evidence in policy-only mode',()=>{
  expect(checkAcceptedBrandReplay(accepted,evidence,evidence)).toEqual({canReuse:true,reason:'REUSABLE'});
 });
 it('blocks missing review linkage',()=>{
  expect(checkAcceptedBrandReplay({...accepted,reviewedFindingId:''},evidence,evidence).canReuse).toBe(false);
 });
 it('blocks changed snapshots',()=>{
  const changed={...evidence,snapshots:evidence.snapshots.map(s=>({...s,sourceContentSha256:'b'.repeat(64)}))};
  expect(checkAcceptedBrandReplay(accepted,evidence,changed).canReuse).toBe(false);
 });
 it('blocks outside evidence domains and changed canonical fingerprints',()=>{
  expect(checkAcceptedBrandReplay({...accepted,research:{...research,
    evidence:[{url:'https://outside.org/',title:'x',excerpt:'y'}]}},evidence,evidence).canReuse).toBe(false);
  expect(checkAcceptedBrandReplay({...accepted,connectorFingerprint:'wrong'},evidence,evidence).canReuse).toBe(false);
 });
});
