'use server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
export type FipeDecisionState={status:'idle'|'success'|'error';message:string};
export async function reviewFipeCandidateAction(_state:FipeDecisionState,data:FormData):Promise<FipeDecisionState>{
 const {profile}=await requireRole('admin');
 const candidate=data.get('candidateId'),decision=data.get('decision');
 if(typeof candidate!=='string'||!/^[a-f\d-]{36}$/i.test(candidate)||
 !['ACCEPT','REJECT','DEFER'].includes(String(decision)))
  return {status:'error',message:'Decisão FIPE inválida.'};
 const client=createPrivilegedAdminClient();
 const {error}=await client.rpc('s26_decide_fipe_candidate',{
  p_candidate:candidate,p_decision:decision,p_actor:profile.id,
 });
 if(error)return {status:'error',message:'Falha na revisão FIPE: '+error.message};
 revalidatePath('/admin/agents');
 return {status:'success',message:decision==='ACCEPT'?
  'FIPE aprovado, vinculado ao MMV e dependências sinalizadas.':'Decisão FIPE registrada.'};
}
