import { describe, expect, it } from 'vitest';
import {
  buildReviewProjection,
  type LegacyDiscovery, type LegacyRun,
} from './agent-review-projection';

const run = (id:string,type:string):LegacyRun=>({
  id,agent_type:type,brand:'VW',market:'BR',status:'COMPLETED',
  started_at:'2026-10-07T10:00:00Z',
});
function finding(input:Partial<LegacyDiscovery> & {id:string;run_id:string}):LegacyDiscovery{
  return {
    id:input.id,run_id:input.run_id,
    finding_type:'NEW_MODEL',fingerprint:input.id,
    subject_key:JSON.stringify(['BR','VW','ID.4']),
    title:'VW ID.4',summary:'Official model',confidence:0.90,
    subject:{brand:'VW',model:'ID.4'},
    proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
      {brand:'VW',model:'ID.4',officialVersionLabel:'Pro',propulsion:'BEV'},
    ]},
    payload:{reasonCode:'NEW_MODEL'},
    created_at:'2026-10-07T10:00:00Z',...input,
  };
}
const runs=new Map<string,LegacyRun>([
  ['r1',run('r1','MMV_DISCOVERY')],['r2',run('r2','MMV_DISCOVERY')],
  ['r3',run('r3','PRODUCT_YEAR')],['r4',run('r4','MODEL_YEAR')],
  ['r5',run('r5','BRAND_CONNECTOR')],
]);

describe('Sprint 26 human review inbox projection',()=>{
  it('consolidates model discovery by brand+model, prioritizing fuller version proposals',()=>{
    const old=finding({id:'old',run_id:'r1',created_at:'2026-10-08T10:00:00Z'});
    const rich=finding({id:'rich',run_id:'r2',
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {officialVersionLabel:'Pro',propulsion:'BEV',powertrainLabel:'Electric'},
        {officialVersionLabel:'Pro S',propulsion:'BEV'},
      ]},
    });
    const {cases}=buildReviewProjection([old,rich],runs,new Map());
    expect(cases).toHaveLength(1);
    expect(cases[0]?.finding.id).toBe('rich');
    expect(cases[0]?.discovery).toContain('2 versões: Pro, Pro S');
    expect(cases[0]?.priorRuns).toBe(2);
  });
  it('does not silently merge different commercial versions',()=>{
    const a=finding({id:'a',run_id:'r1',finding_type:'NEW_VERSION',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro'}});
    const b=finding({id:'b',run_id:'r2',finding_type:'NEW_VERSION',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'GTX'}});
    expect(buildReviewProjection([a,b],runs,new Map()).cases).toHaveLength(2);
  });
  it('keeps generic SUV/car-body descriptions out of human work',()=>{
    const base=finding({id:'base',run_id:'r1'});
    const body=finding({id:'body',run_id:'r2',finding_type:'AMBIGUOUS_MMV',
      title:'VW ID.4 SUV',subject:{brand:'VW',model:'ID.4',bodyStyle:'SUV'},
      payload:{reasonCode:'POSSIBLE_BODY_SPLIT'},
      proposal:{action:'REVIEW_MODEL_BODY_SPLIT',proposedModel:'ID.4 SUV'},
    });
    const p=buildReviewProjection([base,body],runs,new Map());
    expect(p.cases).toHaveLength(1);
    expect(p.diagnostics.genericBodySplit).toBe(1);
  });
  it('does not ask operator of Model Year to create MMV',()=>{
    const year=finding({id:'year',run_id:'r3',finding_type:'POSSIBLE_NEW_MMV',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro',modelYear:2027},
      proposal:null,payload:{reasonCode:'POSSIBLE_NEW_MMV'}});
    const p=buildReviewProjection([year],runs,new Map());
    expect(p.cases).toHaveLength(0);
    expect(p.diagnostics.yearToMmv).toBe(1);
    expect(p.diagnostics.yearToMmvIdentities).toBe(1);
  });
  it('shows old and new Year agent findings as the same operational family',()=>{
    const a=finding({id:'a',run_id:'r4',finding_type:'NEW_MODEL_YEAR',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro',modelYear:2026},
      proposal:null,payload:{}});
    const b=finding({id:'b',run_id:'r3',finding_type:'NEW_PRODUCT_YEAR',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro',modelYear:2027},
      proposal:{action:'STAGE_PRODUCT_YEAR'},payload:{reasonCode:'NEW_MODEL_YEAR'}});
    const p=buildReviewProjection([a,b],runs,new Map());
    expect(p.cases).toHaveLength(2);
    expect(p.cases.every(x=>x.kind==='MODEL_YEAR_NEW')).toBe(true);
  });
  it('simplifies brand connector messages without losing technical payload',()=>{
    const f=finding({id:'brand',run_id:'r5',finding_type:'CONNECTOR_DRIFT',
      subject:{brand:'Kia',market:'BR'},summary:'The Sorento PDF returned 404 and replacement path changed',
      proposal:{allowedDomains:['kia.com.br']}});
    const p=buildReviewProjection([f],runs,new Map());
    expect(p.cases[0]?.discovery).toBe('Mudança de endereço de fonte');
    expect(p.cases[0]?.recommendation).toBe('Validar substituição do link');
  });
  it('does not mark old ACCEPT reviews as applied',()=>{
    const f=finding({id:'a',run_id:'r1'});
    const p=buildReviewProjection([f],runs,new Map([
      ['a',{finding_id:'a',decision:'ACCEPT',created_at:'2026-10-07T10:02:00Z'}],
    ]));
    expect(p.cases[0]?.reviewedSameFingerprint).toBe('ACCEPT');
  });
});
