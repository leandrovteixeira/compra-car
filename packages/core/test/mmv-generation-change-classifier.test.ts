import {describe,expect,it} from 'vitest';
import {
  classifyMmvGenerationChange,MMV_GENERATION_WEIGHTS,
  type MmvGenerationAssessment,type MmvGenerationSeverity,
} from '../src/agents/mmv-generation-change-classifier';

function assessment(
  scores:[MmvGenerationSeverity|null,MmvGenerationSeverity|null,MmvGenerationSeverity|null],
):MmvGenerationAssessment{
 const labels=['design','powertrain','dimensions'] as const;
 return {
  previousMmvId:'haval-h6-phev19',currentMmvId:'haval-h6-phev19',
  previousModelYear:2026,currentModelYear:2027,
  signals:labels.map((dimension,index)=>({
   dimension,severity:scores[index],
   reason:scores[index]===null?'no source':dimension+' source checked',
   evidence:scores[index]===null?[]:[{
    sourceUrl:'https://example.org/official/h6.pdf',
    sourceKind:'MANUFACTURER' as const,
    excerpt:'Evidence of the '+dimension+' change',
    modelYear:2027,
   }],
  }))
 };
}
describe('MMV Generation Change Classifier (review-only)',()=>{
 it('holds 35/35/30 weights, and minor change for flex conversion only',()=>{
  expect(MMV_GENERATION_WEIGHTS).toEqual({design:0.35,powertrain:0.35,dimensions:0.30});
  const r=classifyMmvGenerationChange(assessment([0,1,0]));
  expect(r.changeType).toBe('MINOR_CHANGE');
  expect(r.weightedScore).toBe(0.35);
  expect(r.specCarryOverPolicy).toBe('CANDIDATE_HIGH');
  expect(r.requiresReview).toBe(true);
  expect(r.revalidateSubsystems).toEqual(['POWERTRAIN','HOMOLOGATION']);
 });
 it('does not call a strong propulsion change a new generation',()=>{
  const r=classifyMmvGenerationChange(assessment([0,3,0]));
  expect(r.changeType).toBe('MINOR_CHANGE');
  expect(r.weightedScore).toBe(1.05);
 });
 it('classifies facelift when design is strong but dimensions remain stable',()=>{
  const r=classifyMmvGenerationChange(assessment([3,0,0]));
  expect(r.changeType).toBe('FACELIFT');
  expect(r.specCarryOverPolicy).toBe('CANDIDATE_SELECTIVE');
 });
 it('prioritizes combined structural change even if powertrain unchanged',()=>{
  const r=classifyMmvGenerationChange(assessment([2,0,2]));
  expect(r.changeType).toBe('NEW_GENERATION');
  expect(r.specCarryOverPolicy).toBe('DO_NOT_ASSUME');
  expect(r.revalidateSubsystems).toContain('SAFETY');
 });
 it('strong dimension changes alone remain for review rather than new generation',()=>{
  expect(classifyMmvGenerationChange(assessment([0,1,3])).changeType)
    .toBe('MINOR_CHANGE');
 });
 it('unknown evidence does not become severity zero',()=>{
  const r=classifyMmvGenerationChange(assessment([0,1,null]));
  expect(r.changeType).toBe('UNKNOWN');
  expect(r.weightedScore).toBe(null);
  expect(r.insufficientDimensions).toEqual(['dimensions']);
 });
 it('does not infer unchanged from year change alone',()=>{
  const r=classifyMmvGenerationChange(assessment([0,0,0]));
  expect(r.changeType).toBe('UNCHANGED');
  expect(r.requiresReview).toBe(true);
 });
 it('rejects fabricated 0 scores without evidence',()=>{
  const v=assessment([0,0,0]);
  const broken={...v,signals:v.signals.map((s,i)=>i===0?{...s,evidence:[]}:s)};
  expect(()=>classifyMmvGenerationChange(broken)).toThrow('MMV_GENERATION_EVIDENCE_REQUIRED');
 });
 it('does not accept inconsistent MY pair or duplicate dimensions',()=>{
  const v=assessment([1,1,1]);
  expect(()=>classifyMmvGenerationChange({...v,currentModelYear:2025}))
    .toThrow('MMV_GENERATION_IDENTITY_INVALID');
  expect(()=>classifyMmvGenerationChange({...v,signals:[v.signals[0]!,v.signals[0]!,v.signals[2]!]}))
    .toThrow('MMV_GENERATION_SIGNALS_INVALID');
 });
});
