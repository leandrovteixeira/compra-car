import type { AgentCostAdmission, AgentCostReservation } from '@compra-car/adapter-openai';

/** RPC methods must be deployed to QA beforehand; unavailable accounting fails closed. */
export interface SpendBudgetRpc {
 rpc(name: string, args: Record<string, unknown>): PromiseLike<{
  data: unknown; error: { message: string } | null;
 }>;
}
export class SupabaseAgentCostAdmission implements AgentCostAdmission {
 constructor(
   private readonly client: SpendBudgetRpc,
   private readonly budgetKey: string,
   private readonly reserves: Readonly<Record<string, number>>,
 ) {
   if (!budgetKey.trim() || budgetKey.length > 120) throw new Error('COST_BUDGET_KEY_INVALID');
 }
 async reserve(model: string): Promise<AgentCostReservation> {
   const amount = this.reserves[model];
   if (!Number.isFinite(amount) || amount === undefined || amount <= 0)
     throw new Error('COST_PRICING_UNKNOWN');
   const result = await this.client.rpc('agent_spend_reserve', {
     p_budget_key: this.budgetKey, p_model: model, p_amount_usd: amount,
   });
   if (result.error || typeof result.data !== 'string' ||
     !/^[0-9a-f-]{36}$/iu.test(result.data))
     throw new Error('COST_ADMISSION_FAILED');
   return { id: result.data, reservedUsd: amount };
 }
 async complete(reservation: AgentCostReservation, usageKnown: boolean): Promise<void> {
   const result = await this.client.rpc('agent_spend_complete', {
     p_id: reservation.id, p_usage_known: usageKnown,
   });
   if (result.error) throw new Error('COST_ACCOUNTING_FAILED');
 }
}
