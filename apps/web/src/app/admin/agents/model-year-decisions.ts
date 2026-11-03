'use server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
export type ModelYearDecisionState={status:'idle'|'success'|'error';message:string};
export async function reviewModelYearAction(
 _state:ModelYearDecisionState,data:FormData,
):Promise<ModelYearDecisionState>{
 const {profile}=await requireRole('admin');
 const id=data.get('findingId'),fp=data.get('fingerprint'),decision=data.get('decision');
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/iu.test(id)||
    typeof fp!=='string'||fp.length>4000||
    !['ACCEPT','REJECT','DEFER'].includes(String(decision)))
   return {status:'error',message:'Decisão inválida.'};
 const client=createPrivilegedAdminClient();
 const {error}=await client.rpc('s26_decide_model_year',{
   p_finding:id,p_fingerprint:fp,p_decision:decision,p_actor:profile.id,
 });
 if(error)return {status:'error',message:'Decisão não concluída; nenhuma aplicação parcial foi gravada. '+error.message};
 revalidatePath('/admin/agents');
 revalidatePath('/admin/agents/findings/'+id);
 return {status:'success',message:decision==='ACCEPT'?
 'Ano-modelo aprovado e aplicado na mesma operação.':'Decisão registrada; catálogo inalterado.'};
}
