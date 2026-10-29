import { describe, expect, it } from 'vitest';
import {
  buildReviewProjection,
  isResolvedMmvCase,
  type LegacyDiscovery, type LegacyRun,
} from './agent-review-projection';

const run = (id:string,type:string):LegacyRun=>({
  id,agent_type:type,brand:'VW',market:'BR',status:'COMPLETED',
  started_at:'2026-10-07T10:00:00Z',
});
function finding(input:Partial<LegacyDiscovery> & {id:string;run_id:string}):LegacyDiscovery{
  const {id,run_id,...overrides}=input;
  return {
    id,run_id,
    finding_type:'NEW_MODEL',fingerprint:input.id,
    subject_key:JSON.stringify(['BR','VW','ID.4']),
    title:'VW ID.4',summary:'Official model',confidence:0.90,
    subject:{brand:'VW',model:'ID.4'},
    proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
      {brand:'VW',model:'ID.4',officialVersionLabel:'Pro',propulsion:'BEV'},
    ]},
    payload:{reasonCode:'NEW_MODEL'},
    created_at:'2026-10-07T10:00:00Z',...overrides,
  };
}
const runs=new Map<string,LegacyRun>([
  ['r1',run('r1','MMV_DISCOVERY')],['r2',run('r2','MMV_DISCOVERY')],
  ['r3',run('r3','PRODUCT_YEAR')],['r4',run('r4','MODEL_YEAR')],
  ['r5',run('r5','BRAND_CONNECTOR')],
]);

describe('Sprint 26 human review inbox projection',()=>{
  it('splits each version into one case and prioritizes complete source snapshots',()=>{
    const old=finding({id:'old',run_id:'r1',created_at:'2026-10-08T10:00:00Z'});
    const rich=finding({id:'rich',run_id:'r2',
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {officialVersionLabel:'Pro',propulsion:'BEV',powertrainLabel:'Electric'},
        {officialVersionLabel:'Pro S',propulsion:'BEV'},
      ]},
    });
    const {cases}=buildReviewProjection([old,rich],runs,new Map());
    expect(cases).toHaveLength(2);
    const pro=cases.find(c=>c.version==='Pro');
    const pros=cases.find(c=>c.version==='Pro S');
    expect(pro?.finding.id).toBe('rich');
    expect(pro?.priorRuns).toBe(2);
    expect(pros?.finding.id).toBe('rich');
    expect(pros?.priorRuns).toBe(1);
    expect(new Set(cases.map(c=>c.businessKey)).size).toBe(2);
  });
  it('removes Kia Niro batch only after both proposed variants are canonical',()=>{
    const found=finding({id:'niro',run_id:'r1',subject:{brand:'Kia',model:'Niro'},
      title:'Kia Niro',
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {brand:'Kia',model:'Niro',officialVersionLabel:'EX',propulsion:'HEV',powertrainLabel:'HEV'},
        {brand:'Kia',model:'Niro',officialVersionLabel:'SX PRESTIGE',propulsion:'HEV',powertrainLabel:'HEV'},
      ]},
    });
    const cases=buildReviewProjection([found],runs,new Map()).cases;
    expect(cases).toHaveLength(2);
    const c=cases[0]!;
    const ex={id:'mmv-ex',market:'BR',brand:'Kia',model:'Niro',
      official_version_label:'EX',propulsion:'HEV',powertrain_label:'HEV',status:'ACTIVE'};
    const sx={...ex,id:'mmv-sx',official_version_label:'SX PRESTIGE'};
    const exCase=cases.find(c=>c.version==='EX')!;
    const sxCase=cases.find(c=>c.version==='SX PRESTIGE')!;
    expect(isResolvedMmvCase(exCase,[ex])).toBe(true);
    expect(isResolvedMmvCase(sxCase,[ex])).toBe(false);
    expect(c.version).toBe('EX');
    expect(isResolvedMmvCase(sxCase,[ex,sx])).toBe(true);
    expect(isResolvedMmvCase(sxCase,[ex,{...sx,propulsion:'BEV'}])).toBe(false);
  });
  it('does not recreate a previously matched ambiguous commercial version',()=>{
    const found=finding({id:'niro-ambiguous',run_id:'r1',
      finding_type:'AMBIGUOUS_MMV',proposal:null,
      subject:{brand:'Kia',model:'Niro',officialVersionLabel:'SX PRESTIGE',
        canonicalMmv:[{id:'mmv-sx'}]},
      payload:{reasonCode:'AMBIGUOUS_IDENTITY'},
    });
    const c=buildReviewProjection([found],runs,new Map()).cases[0]!;
    const sx={id:'mmv-sx',market:'BR',brand:'Kia',model:'Niro',
      official_version_label:'SX PRESTIGE',propulsion:'HEV',
      powertrain_label:'HEV',status:'ACTIVE'};
    expect(isResolvedMmvCase(c,[sx])).toBe(true);
    expect(isResolvedMmvCase(c,[{...sx,id:'different'}])).toBe(false);
  });
  it('offers identity resolution for GTL FOSCO without automatically merging finish and price',()=>{
    const ev9=finding({id:'ev9',run_id:'r1',
      subject:{brand:'Kia',model:'EV9'},title:'Kia EV9',
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {brand:'Kia',model:'EV9',officialVersionLabel:'GTL',propulsion:'BEV'},
        {brand:'Kia',model:'EV9',officialVersionLabel:'GTL FOSCO',propulsion:'BEV'},
      ]}});
    const cases=buildReviewProjection([ev9],runs,new Map()).cases;
    expect(cases).toHaveLength(2);
    expect(cases.find(c=>c.version==='GTL')?.kind).toBe('MMV_NEW');
    const fosco=cases.find(c=>c.version==='GTL FOSCO')!;
    expect(fosco.kind).toBe('MMV_AMBIGUOUS');
    expect(fosco.possibleAppearanceVariant).toBe(true);
    expect(fosco.recommendation).toBe('Criar ou vincular à GTL');
    expect(fosco.selectedIdentity?.officialVersionLabel).toBe('GTL FOSCO');
    expect(fosco.businessKey).not.toBe(cases.find(c=>c.version==='GTL')?.businessKey);
  });
  it('does not silently merge different commercial versions',()=>{
    const a=finding({id:'a',run_id:'r1',finding_type:'NEW_VERSION',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro'}});
    const b=finding({id:'b',run_id:'r2',finding_type:'NEW_VERSION',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'GTX'},
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {brand:'VW',model:'ID.4',officialVersionLabel:'GTX',propulsion:'BEV'},
      ]}});
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
  it('suppresses Saveiro cab-size descriptors when full versions are in the NEW_MODEL proposal',()=>{
    const model=finding({id:'saveiro-new',run_id:'r1',
      subject:{brand:'VW',model:'Saveiro'},
      proposal:{action:'STAGE_MMV_IDENTITIES',identities:[
        {officialVersionLabel:'Robust CS',bodyStyle:'Picape cabine simples'},
        {officialVersionLabel:'Robust CD',bodyStyle:'Picape cabine dupla'},
        {officialVersionLabel:'Trendline CS',bodyStyle:'Picape cabine simples'},
        {officialVersionLabel:'Extreme CD',bodyStyle:'Picape cabine dupla'},
      ]},
    });
    const body=finding({id:'saveiro-body',run_id:'r2',finding_type:'AMBIGUOUS_MMV',
      subject:{brand:'VW',model:'Saveiro',bodyStyle:'Picape cabine dupla'},
      payload:{reasonCode:'POSSIBLE_BODY_SPLIT'},
      proposal:{action:'REVIEW_MODEL_BODY_SPLIT',proposedModel:'Saveiro Picape cabine dupla'},
    });
    const projected=buildReviewProjection([model,body],runs,new Map());
    expect(projected.cases).toHaveLength(4);
    expect(projected.cases.map(c=>c.version).sort()).toEqual(
      ['Robust CS','Robust CD','Trendline CS','Extreme CD'].sort());
    expect(projected.cases.every(c=>c.discovery==='Nova versão')).toBe(true);
    expect(projected.diagnostics.genericBodySplit).toBe(1);
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
  it('excludes historical Year proposals that lack a canonical MMV, retaining current ones',()=>{
    const a=finding({id:'a',run_id:'r4',finding_type:'NEW_MODEL_YEAR',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro',modelYear:2026},
      proposal:null,payload:{}});
    const b=finding({id:'b',run_id:'r3',finding_type:'NEW_PRODUCT_YEAR',
      subject:{brand:'VW',model:'ID.4',officialVersionLabel:'Pro',modelYear:2027},
      proposal:{action:'STAGE_PRODUCT_YEAR'},payload:{reasonCode:'NEW_MODEL_YEAR'}});
    const p=buildReviewProjection([a,b],runs,new Map());
    expect(p.cases).toHaveLength(1);
    expect(p.cases[0]?.run.agent_type).toBe('PRODUCT_YEAR');
    expect(p.cases[0]?.kind).toBe('MODEL_YEAR_NEW');
    expect(p.diagnostics.legacyYear).toBe(1);
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
