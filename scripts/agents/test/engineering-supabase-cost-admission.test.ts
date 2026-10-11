import { describe, expect, it, vi } from 'vitest';
import { SupabaseAgentCostAdmission } from '../engineering-supabase-cost-admission';

describe('distributed cost admission adapter', () => {
 it('reserves using a single server-side RPC and preserves amount', async () => {
   const rpc = vi.fn(async () => ({data:'11111111-1111-4111-8111-111111111111',error:null}));
   const ledger = new SupabaseAgentCostAdmission({rpc},'qa-kia-vw-pilot',{'test-model':1});
   const reservation=await ledger.reserve('test-model');
   expect(reservation).toEqual({id:'11111111-1111-4111-8111-111111111111',reservedUsd:1});
   expect(rpc).toHaveBeenCalledWith('agent_spend_reserve',{
     p_budget_key:'qa-kia-vw-pilot',p_model:'test-model',p_amount_usd:1,
   });
   await ledger.complete(reservation,false);
   expect(rpc).toHaveBeenCalledWith('agent_spend_complete',{
     p_id:reservation.id,p_usage_known:false,
   });
 });
 it('fails closed on unknown models, DB errors and missing result IDs',async () => {
   const rpc=vi.fn(async()=>({data:null,error:{message:'hidden database error'}}));
   const ledger=new SupabaseAgentCostAdmission({rpc},'qa-kia-vw-pilot',{'test-model':1});
   await expect(ledger.reserve('other')).rejects.toThrow('COST_PRICING_UNKNOWN');
   expect(rpc).not.toHaveBeenCalled();
   await expect(ledger.reserve('test-model')).rejects.toThrow('COST_ADMISSION_FAILED');
 });
 it('does not silently accept accounting failures',async () => {
   const ledger=new SupabaseAgentCostAdmission({
     rpc:async()=>({data:null,error:{message:'db connection lost'}}),
   },'qa-kia-vw-pilot',{'test-model':1});
   await expect(ledger.complete({
     id:'11111111-1111-4111-8111-111111111111',reservedUsd:1,
   },false)).rejects.toThrow('COST_ACCOUNTING_FAILED');
 });
});
