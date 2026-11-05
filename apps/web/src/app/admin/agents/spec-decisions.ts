'use server';
import {revalidatePath} from 'next/cache';
import {requireFeatureIdentity23C} from '@/auth/account-tier-server';
import {createPrivilegedAdminClient} from '@/auth/admin-client';

export type SpecDecisionState={status:'idle'|'success'|'error';message:string};
export async function reviewSpecFindingAction(
  _previous:SpecDecisionState,data:FormData,
):Promise<SpecDecisionState>{
  const {profile}=await requireFeatureIdentity23C('agents','write');
  const findingId=data.get('findingId');
  const fingerprint=data.get('fingerprint');
  const decision=data.get('decision');
  const rawTarget=data.get('targetSpecId');
  if(typeof findingId!=='string'||!/^[a-f\d-]{36}$/iu.test(findingId)||
    typeof fingerprint!=='string'||fingerprint.length<10||fingerprint.length>512||
    !['CANONICALIZE','REJECT','DEFER'].includes(String(decision)))
    return {status:'error',message:'Decisão inválida ou desatualizada.'};
  const client=createPrivilegedAdminClient();
  if(decision==='CANONICALIZE'){
    const target=typeof rawTarget==='string'?Number(rawTarget):NaN;
    if(!Number.isSafeInteger(target)||target<=0)
      return {status:'error',message:'Selecione uma especificação canônica válida.'};
    const {data:receipt,error}=await client.rpc('s27_canonicalize_spec_finding',{
      p_finding:findingId,p_fingerprint:fingerprint,p_target_spec:target,p_actor:profile.id,
    });
    if(error)return {status:'error',message:'Não foi possível canonicalizar: '+error.message};
    revalidatePath('/admin/agents');
    const code=typeof receipt?.specCode==='string'?receipt.specCode:'';
    return {status:'success',message:'Alias confirmado'+(code?' → '+code:'')+'. Nenhuma ficha de produto foi alterada.'};
  }
  const {error}=await client.rpc('s27_decide_spec_finding',{
    p_finding:findingId,p_fingerprint:fingerprint,
    p_decision:decision,p_actor:profile.id,
  });
  if(error)return {status:'error',message:'Não foi possível registrar a decisão: '+error.message};
  revalidatePath('/admin/agents');
  return {status:'success',message:decision==='REJECT'
    ?'Candidato rejeitado, sem alterar o catálogo.'
    :'Candidato adiado para análise posterior.'};
}
