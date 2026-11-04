'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { AgentPlatformSupabaseAdapter } from '@compra-car/adapter-supabase';
import { reviewPolicy } from '@compra-car/core/agent-platform';

export type GenerationDecisionState={status:'idle'|'success'|'error';message:string};

/**
 * One shared Findings/Reviews inbox, same operator verbs and statuses.
 * Generation approval records an evidence-backed CLASSIFICATION decision,
 * never creates another MMV, changes specs or applies carry-over automatically.
 */
export async function reviewGenerationDecisionAction(
  _state:GenerationDecisionState,
  data:FormData,
):Promise<GenerationDecisionState>{
  const {profile}=await requireRole('admin');
  const findingId=data.get('findingId');
  const fingerprint=data.get('fingerprint');
  const decision=data.get('decision');
  const note=data.get('note');
  if(typeof findingId!=='string'||!/^[0-9a-f-]{36}$/iu.test(findingId)||
     typeof fingerprint!=='string'||!fingerprint||fingerprint.length>128||
     !['ACCEPT','REJECT','DEFER'].includes(String(decision))||
     (note!==null&&(typeof note!=='string'||note.length>4000)))
    return {status:'error',message:'Decisão ou versão do finding inválida.'};
  // Shared review policy expressly forbids side effects for generation approval.
  if(reviewPolicy('MMV_GENERATION').approveEffect!=='NONE')
    return {status:'error',message:'Política de classificação geracional inconsistente.'};
  const repository=new AgentPlatformSupabaseAdapter(createPrivilegedAdminClient());
  try{
    const detail=await repository.getFinding(findingId);
    if(!detail ||detail.finding.fingerprint!==fingerprint||
       detail.finding.findingType!=='AMBIGUOUS_MMV'||
       detail.finding.payload.reasonCode!=='GENERATION_CHANGE_REVIEW'||
       detail.finding.proposal?.action!=='REVIEW_GENERATION_CHANGE'||
       detail.run.agentType!=='MMV_DISCOVERY'||detail.run.status!=='COMPLETED')
      return {status:'error',message:'Finding alterado ou não elegível. Recarregue a fila.'};
    if(detail.latestReview &&detail.latestReview.decision!=='DEFER')
      return {status:'error',message:'Classificação já decidida. Recarregue a fila.'};
    const assessment=detail.finding.payload.generationAssessment;
    const sourceSignals=assessment!==null && typeof assessment==='object' && !Array.isArray(assessment)
      ?assessment.signals:null;
    if(decision==='ACCEPT' &&
      (detail.finding.proposal.changeType==='UNKNOWN'||
       !Array.isArray(sourceSignals)))
      return {status:'error',message:'Evidências insuficientes para aprovar a classificação.'};
    await repository.addReview({
      findingId,decision:decision as 'ACCEPT'|'REJECT'|'DEFER',
      note:typeof note==='string'?note:null,
      reviewedBy:profile.id,
    });
  }catch{
    return {status:'error',message:'Não foi possível registrar a decisão. Recarregue a fila.'};
  }
  revalidatePath('/admin/agents');
  revalidatePath('/admin/agents/findings/'+findingId);
  return {status:'success',
    message:decision==='ACCEPT'
      ?'Classificação aprovada e registrada; nenhum MMV ou spec foi alterado.'
      :'Decisão registrada; nenhum MMV ou spec foi alterado.'};
}
