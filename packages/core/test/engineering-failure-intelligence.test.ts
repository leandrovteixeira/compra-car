import {describe,it,expect} from 'vitest';
import {clusterEngineeringFailures} from '../src/agents/engineering-failure-intelligence';
describe('engineering failure clustering',()=>{
  it('clusters repeated structural failures and returns bounded representatives',()=>{
    const failures=Array.from({length:7},(_,i)=>({
      targetId:'target-'+i,brand:'Kia',model:'Sportage',sourceType:'OFFICIAL_MODEL_PAGE',
      reason:'STRUCTURED_PARSE_FAILED',sourceStructure:'json-ld',
    }));
    const result=clusterEngineeringFailures(failures,2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({kind:'STRUCTURED_PARSE_FAILED',count:7});
    expect(result[0]?.representativeTargetIds).toHaveLength(2);
  });
  it('does not mix models or diagnostic classes',()=>{
    const base={targetId:'a',brand:'VW',model:'Nivus',sourceType:'MODEL_PAGE',sourceStructure:'html'};
    expect(clusterEngineeringFailures([
      {...base,reason:'CACHE_MISS'}, {...base,targetId:'b',model:'Polo',reason:'CACHE_MISS'},
      {...base,targetId:'c',reason:'MODEL_SOURCE_SKIP'},
    ])).toHaveLength(3);
  });
  it('rejects invalid input and representative limit',()=>{
    expect(()=>clusterEngineeringFailures([],0)).toThrow();
    expect(()=>clusterEngineeringFailures([{targetId:'',brand:'Kia',model:'',sourceType:'x',sourceStructure:'',reason:'CACHE_MISS'}])).toThrow();
  });
});
