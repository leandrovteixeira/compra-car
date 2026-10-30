import 'server-only';
import {requireRole} from '@/auth/authorization';
import {createPrivilegedAdminClient} from '@/auth/admin-client';

export type FipeReviewItem={
 id:string; brand:string;model:string;version:string|null;fipeCode:string;
 fipeLabel:string;confidence:number;decision:string;sourceUrl:string;dependencyState:string;
};
export async function loadFipeReviewItems():Promise<FipeReviewItem[]>{
 await requireRole('admin');
 const client=createPrivilegedAdminClient();
 const {data,error}=await client.from('agent_fipe_mapping_candidates')
  .select('id,mmv_id,fipe_code,fipe_model_label,match_confidence,decision,source_url,created_at')
  .eq('decision','PENDING').order('created_at',{ascending:false}).limit(50);
 if(error||!data)throw new Error('FIPE_REVIEW_CANDIDATES_UNAVAILABLE');
 if(!data.length)return [];
 const ids=[...new Set(data.map(item=>item.mmv_id))];
 const [mmvs,deps]=await Promise.all([
  client.from('catalog_mmvs').select('id,brand,model,official_version_label').in('id',ids),
  client.from('agent_dependency_nodes').select('node_key,state')
   .in('node_key',data.map(item=>'fipe-candidate:'+item.id)),
 ]);
 if(mmvs.error||!mmvs.data||deps.error||!deps.data)
   throw new Error('FIPE_REVIEW_DEPENDENCIES_UNAVAILABLE');
 const byMmv=new Map(mmvs.data.map(m=>[m.id,m]));
 const byDependency=new Map(deps.data.map(n=>[n.node_key,n.state]));
 return data.flatMap(item=>{
  const mmv=byMmv.get(item.mmv_id);
  if(!mmv)return [];
  return [{
   id:item.id,brand:mmv.brand,model:mmv.model,version:mmv.official_version_label,
   fipeCode:item.fipe_code,fipeLabel:item.fipe_model_label,
   confidence:Number(item.match_confidence),decision:item.decision,
   sourceUrl:item.source_url,dependencyState:byDependency.get('fipe-candidate:'+item.id)??'BLOCKED',
  }];
 });
}
