import { describe, expect, it } from 'vitest';
import { scoreEngineeringGolden, evaluateEngineeringGoldenGate } from '../src/agents/engineering-golden-benchmark';
const golden = [
  { id:'kia-sorento', expectedIdentityKeys:['KIA|SORENTO|EX|2026'], expectedRejectedKeys:['KIA|SORENTO|EX|2025'] },
  { id:'vw-nivus', expectedIdentityKeys:['VW|NIVUS|HIGHLINE|2026'], expectedRejectedKeys:[] },
];
const observed = [
  {id:'kia-sorento',resolvedIdentityKeys:['KIA|SORENTO|EX|2026'],rejectedKeys:['KIA|SORENTO|EX|2025'],ambiguousKeys:[]},
  {id:'vw-nivus',resolvedIdentityKeys:['VW|NIVUS|HIGHLINE|2026'],rejectedKeys:[],ambiguousKeys:[]},
];
describe('Sprint 22.5C golden benchmark',()=>{
  it('scores correct matches and independently reviewed rejection',()=>{
    expect(scoreEngineeringGolden(golden,observed)).toMatchObject({
      cases:2,truePositives:2,falsePositives:0,falseNegatives:0,rejectedCorrectly:1,precision:1,recall:1,
    });
  });
  it('blocks a swapped identity even when counts remain unchanged',()=>{
    const before=scoreEngineeringGolden(golden,observed);
    const after=scoreEngineeringGolden(golden,[observed[0]!,{...observed[1]!,resolvedIdentityKeys:['VW|NIVUS|COMFORTLINE|2026']}]);
    expect(after.truePositives).toBe(1);
    expect(after.falsePositives).toBe(1);
    expect(evaluateEngineeringGoldenGate(before,after)).toMatchObject({accepted:false});
  });
  it('rejects incompatible, duplicate, and conflicting fixtures',()=>{
    expect(()=>scoreEngineeringGolden(golden,observed.slice(0,1))).toThrow('ENGINEERING_CASE_SET_MISMATCH');
    expect(()=>scoreEngineeringGolden([...golden,golden[0]!],observed)).toThrow('ENGINEERING_INVALID_IDENTITY');
    expect(()=>scoreEngineeringGolden(golden,[{...observed[0]!,ambiguousKeys:observed[0]!.resolvedIdentityKeys},observed[1]!])).toThrow('ENGINEERING_CONFLICTING_LABELS');
  });
  it('blocks newly ambiguous outputs',()=>{
    const before=scoreEngineeringGolden(golden,observed);
    const after=scoreEngineeringGolden(golden,[observed[0]!,{...observed[1]!,resolvedIdentityKeys:[],ambiguousKeys:['VW|NIVUS|HIGHLINE|2026']}]);
    expect(evaluateEngineeringGoldenGate(before,after).reasons).toContain('AMBIGUITY_REGRESSION');
  });
});
