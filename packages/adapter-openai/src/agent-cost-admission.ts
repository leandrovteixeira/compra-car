/** Paid admission contract. Provider must fail closed unless a trusted controller reserves
 * before dispatch. This is NOT proof of a provider billing hard stop. */
export interface AgentCostReservation {
  readonly id: string;
  readonly reservedUsd: number;
}
export interface AgentCostAdmission {
  reserve(model: string): Promise<AgentCostReservation>;
  /** Keep the reservation charged on unknown/failed usage; never release optimistically. */
  complete(reservation: AgentCostReservation, usageKnown: boolean): Promise<void>;
}
/** Single-process offline/test coordinator. Not suitable for distributed paid production. */
export class InMemoryAgentCostAdmission implements AgentCostAdmission {
  private committed = 0;
  private sequence = 0;
  private readonly pending = new Map<string, number>();
  constructor(private readonly budgetUsd: number, private readonly reserves: Readonly<Record<string,number>>) {
    if(!Number.isFinite(budgetUsd)||budgetUsd<=0)throw new Error('INVALID_BUDGET');
  }
  async reserve(model:string):Promise<AgentCostReservation> {
    const amount=this.reserves[model];
    if(amount===undefined||!Number.isFinite(amount)||amount<=0)
      throw new Error('COST_PRICING_UNKNOWN');
    if(this.committed + amount > this.budgetUsd + 1e-9)
      throw new Error('COST_BUDGET_EXHAUSTED');
    const id=String(++this.sequence);
    this.committed+=amount; this.pending.set(id,amount);
    return {id,reservedUsd:amount};
  }
  async complete(reservation:AgentCostReservation, _usageKnown:boolean):Promise<void>{
    if(!this.pending.has(reservation.id))throw new Error('COST_RESERVATION_UNKNOWN');
    this.pending.delete(reservation.id);
    // Conservatively hold full admission reserve even after known usage.
  }
  snapshot(){return {budgetUsd:this.budgetUsd,consumedReserveUsd:this.committed,pending:this.pending.size};}
}
