import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {SpecAgentSupabaseCoverageReader27} from '../src/spec-agent-coverage-reader';
describe('Spec Agent QA coverage reader',()=>{
 it('queries status and product filters without any write operation',async()=>{
  const calls:string[]=[];
  const query={
   select:vi.fn(function(this:unknown){calls.push('select');return query;}),
   order:vi.fn(function(this:unknown){calls.push('order');return query;}),
   range:vi.fn(function(this:unknown){calls.push('range');return query;}),
   eq:vi.fn(function(this:unknown,k:string,v:unknown){calls.push('eq:'+k+':'+String(v));return query;}),
   then(resolve:(v:unknown)=>void){resolve({data:[{product_id:123,model_year:2027,status:'PENDING_REVIEW',status_reason:'INHERITED',confirmed_count:20,pending_count:2,inherited_count:1,updated_at:'2026-11-03T17:00:00Z'}],error:null});}
  };
  const from=vi.fn(()=>query);
  const client={from} as unknown as SupabaseClient;
  const reader=new SpecAgentSupabaseCoverageReader27(client);
  const rows=await reader.list({status:'PENDING_REVIEW',productId:123,limit:20});
  expect(rows[0]).toMatchObject({productId:123,modelYear:2027,confirmedCount:20,pendingCount:2,status:'PENDING_REVIEW'});
  expect(calls).toContain('eq:status:PENDING_REVIEW');
  expect(calls).toContain('eq:product_id:123');
  expect(from).toHaveBeenCalledWith('agent_spec_coverage');
 });
 it('rejects invalid pagination before querying',async()=>{
  const client={from:vi.fn()} as unknown as SupabaseClient;
  await expect(new SpecAgentSupabaseCoverageReader27(client).list({limit:501})).rejects.toThrow('SPEC_COVERAGE_PAGINATION_INVALID');
  expect(client.from).not.toHaveBeenCalled();
 });
});
