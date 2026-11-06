'use server';

import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireFeatureIdentity23C} from '@/auth/account-tier-server';
import {createMutableServerClient} from '@/auth/server-client';

export type SpecValueDecisionState={status:'idle'|'success'|'error';message:string};
const s=(value:FormDataEntryValue|null)=>typeof value==='string'?value.trim():'';
export async function reviewSpecValueAction(
 _state:SpecValueDecisionState,data:FormData
):Promise<SpecValueDecisionState>{
 const {profile}=await requireFeatureIdentity23C('agents','write');
 const findingId=s(data.get('findingId'));
 const fingerprint=s(data.get('fingerprint'));
 const revision=Number(s(data.get('caseRevision')));
 const decision=s(data.get('decision'));
 const selected=s(data.get('targetSpecId'));
 const targetSpecId=selected?Number(selected):null;
 if(!/^[0-9a-f-]{36}$/iu.test(findingId)||fingerprint.length<16||fingerprint.length>128||
   !Number.isSafeInteger(revision)||revision<1||
   !['MERGE','CREATE','REJECT','POSTPONE'].includes(decision))
  return {status:'error',message:'A decisão está incompleta ou desatualizada.'};
 if(decision==='MERGE'&&(!Number.isSafeInteger(targetSpecId)||targetSpecId===null||targetSpecId<=0))
  return {status:'error',message:'Selecione uma especificação canônica válida para o Merge.'};
 const canonical=decision==='CREATE'?{
   code:s(data.get('code')),detail:s(data.get('detail')),
   group_name:s(data.get('group_name')),equipment_group:s(data.get('equipment_group')),
   spec_set:s(data.get('spec_set')),type:s(data.get('type')),unit:s(data.get('unit')),
   display_pt:s(data.get('display_pt')),detail_pt:s(data.get('detail_pt')),
   group_name_pt:s(data.get('group_name_pt')),
   equipment_group_pt:s(data.get('equipment_group_pt')),
   spec_set_pt:s(data.get('spec_set_pt')),
   display_order:s(data.get('display_order'))||null,
   unit_perceived_value:s(data.get('unit_perceived_value'))||'0',
   relative_value:s(data.get('relative_value'))||'0'
  }:null;
 if(decision==='CREATE'&&(
  !canonical||!['binary','numeric'].includes(canonical.type)||
  !canonical.code||!canonical.detail||!canonical.group_name||
  !canonical.equipment_group||!canonical.spec_set))
  return {status:'error',message:'Preencha os campos obrigatórios do novo spec.'};
 const idempotency=createHash('sha256').update(JSON.stringify([
  'S27D',profile.id,findingId,fingerprint,revision,decision,targetSpecId,canonical
 ])).digest('hex');
 const db=await createMutableServerClient();
 const {data:result,error}=await db.rpc('s27d_commit_ford_spec_value',{
  p_finding:findingId,p_fingerprint:fingerprint,p_revision:revision,
  p_action:decision,p_target_spec:decision==='MERGE'?targetSpecId:null,
  p_canonical_input:canonical,p_idempotency:idempotency
 });
 if(error){
  const code=error.message.match(/(?:SPEC_VALUE|SPEC_REVIEW)_[A-Z0-9_]+/u)?.[0];
  return {status:'error',message:code?
    'Não foi possível aplicar a decisão: '+code+'. Nenhuma gravação parcial foi confirmada.':
    'Não foi possível concluir a decisão. Nenhuma alteração parcial foi aplicada.'};
 }
 revalidatePath('/admin/agents');
 revalidatePath('/admin/agents/findings/'+findingId);
 const outcome=(result as {status?:string}|null)?.status??'APPROVED';
 return {status:'success',message:outcome==='REPLAYED'?'Decisão já concluída anteriormente.':
  decision==='MERGE'||decision==='CREATE'?
  'Spec canonicalizado e valor salvo no veículo na mesma transação.':
  'Decisão registrada. Nenhum spec do veículo foi modificado.'};
}
