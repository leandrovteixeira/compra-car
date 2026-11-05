import {describe,it,expect} from 'vitest';
import {classifySupervisedSpecClaims27} from '../src/agents/spec-agent-supervised-candidates';
const seed={
  brand:'Ford',model:'Ranger',version:'Limited',modelYear:2027,
  documentSha256:'a'.repeat(64),
  claims:[
    {ordinal:1,page:3,label:'Bloqueio eletrônico do diferencial traseiro',kind:'binary' as const,rawValue:'S'},
    {ordinal:2,page:5,label:'Tomada 110V na caçamba',kind:'binary' as const,rawValue:'S'},
  ],
  catalog:[{id:'1',code:'TR_0001',label:'Bloqueio eletrônico do diferencial traseiro',kind:'binary' as const}],
  aliases:[] as {label:string;specCode:string;approved:boolean}[],
};
describe('Ford supervised spec candidate detection',()=>{
  it('sends unknown equipment to SPEC_NEW, without inventing a canonical code',()=>{
    const result=classifySupervisedSpecClaims27(seed);
    expect(result[1]).toMatchObject({status:'SPEC_NEW',matchCode:null,candidateCodes:[],requiresReview:true});
  });
  it('does not assume same text means approved canonical match',()=>{
    expect(classifySupervisedSpecClaims27(seed)[0]).toMatchObject({
      status:'SPEC_AMBIGUOUS',candidateCodes:['TR_0001'],requiresReview:true
    });
  });
  it('recognizes only approved exact scoped aliases',()=>{
    const input={...seed,aliases:[{label:'Bloqueio eletrônico do diferencial traseiro',specCode:'TR_0001',approved:true}]};
    expect(classifySupervisedSpecClaims27(input)[0]).toMatchObject({
      status:'MATCHED_ALIAS',matchCode:'TR_0001',requiresReview:false
    });
  });
  it('rejects duplicate ordinals and mismatched numeric units',()=>{
    expect(()=>classifySupervisedSpecClaims27({...seed,claims:[seed.claims[0],seed.claims[0]]}))
      .toThrow('SPEC_SUPERVISED_CLAIM_INVALID');
    const numeric={...seed,claims:[{ordinal:1,page:4,label:'Potência',kind:'numeric' as const,unit:'kW',rawValue:'150'}],
      catalog:[{id:'1',code:'PW_0001',label:'Potência',kind:'numeric' as const,unit:'cv'}]};
    expect(classifySupervisedSpecClaims27(numeric)[0]?.status).toBe('SPEC_NEW');
  });
  it('keeps stable fingerprints for retries and changes for different source revision',()=>{
    const first=classifySupervisedSpecClaims27(seed)[0]!.fingerprint;
    expect(classifySupervisedSpecClaims27(seed)[0]!.fingerprint).toBe(first);
    expect(classifySupervisedSpecClaims27({...seed,documentSha256:'b'.repeat(64)})[0]!.fingerprint).not.toBe(first);
  });
  it('fails closed for claims without document hash',()=>{
    expect(()=>classifySupervisedSpecClaims27({...seed,documentSha256:'unknown'}))
      .toThrow('SPEC_SUPERVISED_INPUT_INVALID');
  });
});
