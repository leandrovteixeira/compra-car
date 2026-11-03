import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLegacyServerRuntime } from './client';

/** Read-only QA coverage query. Uses a server-held Supabase client only. */
export interface SpecCoverageRow27 {
  productId: number;
  modelYear: number;
  status: 'AWAITING_SOURCE'|'PENDING_REVIEW'|'CONFIRMED';
  statusReason: string|null;
  confirmedCount: number;
  pendingCount: number;
  inheritedCount: number;
  updatedAt: string;
}
export type SpecCoverageFilter27 = {
  status?: SpecCoverageRow27['status'];
  productId?: number;
  limit?: number;
  offset?: number;
};
export class SpecAgentSupabaseCoverageReader27 {
  constructor(private readonly client:SupabaseClient){assertLegacyServerRuntime();}
  async list(filter:SpecCoverageFilter27={}):Promise<readonly SpecCoverageRow27[]>{
    const limit=filter.limit??100,offset=filter.offset??0;
    if(!Number.isSafeInteger(limit)||limit<1||limit>500||
      !Number.isSafeInteger(offset)||offset<0) throw new Error('SPEC_COVERAGE_PAGINATION_INVALID');
    if(filter.productId!==undefined && (!Number.isSafeInteger(filter.productId)||filter.productId<1))
      throw new Error('SPEC_COVERAGE_PRODUCT_INVALID');
    let query=this.client.from('agent_spec_coverage')
      .select('product_id,model_year,status,status_reason,confirmed_count,pending_count,inherited_count,updated_at')
      .order('updated_at',{ascending:false})
      .range(offset,offset+limit-1);
    if(filter.status) query=query.eq('status',filter.status);
    if(filter.productId!==undefined) query=query.eq('product_id',filter.productId);
    const {data,error}=await query;
    if(error) throw new Error('SPEC_COVERAGE_READ_FAILED');
    return (data??[]).map(row=>({
      productId:Number(row.product_id),modelYear:Number(row.model_year),
      status:row.status as SpecCoverageRow27['status'],
      statusReason:row.status_reason,
      confirmedCount:Number(row.confirmed_count),
      pendingCount:Number(row.pending_count),
      inheritedCount:Number(row.inherited_count),
      updatedAt:String(row.updated_at),
    }));
  }
}
