'use server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
export type ConnectorDecisionState={status:'idle'|'success'|'error';message:string};
export async function reviewConnectorAction(
  _state:ConnectorDecisionState,data:FormData,
):Promise<ConnectorDecisionState>{
  const {profile}=await requireRole('admin');
  const findingId=data.get('findingId'),fingerprint=data.get('fingerprint'),
    decision=data.get('decision');
  if(typeof findingId!=='string'||!/^[a-f0-9-]{36}$/iu.test(findingId)||
     typeof fingerprint!=='string'||fingerprint.length>4000||
     !['ACCEPT','REJECT','DEFER'].includes(String(decision)))
    return {status:'error',message:'Decisão inválida.'};
  const client=createPrivilegedAdminClient();
  const {error}=await client.rpc('s26_decide_connector',{
    p_finding:findingId,p_fingerprint:fingerprint,
    p_decision:decision,p_actor:profile.id,
  });
  if(error)return {status:'error',message:'A decisão não foi concluída: '+error.message};
  revalidatePath('/admin/agents');
  revalidatePath('/admin/agents/brands');
  revalidatePath('/admin/agents/findings/'+findingId);
  return {status:'success',message:decision==='ACCEPT'?
    'Connector aprovado e ativado na mesma operação.':'Decisão registrada.'};
}
