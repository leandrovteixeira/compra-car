'use server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export type IdentityDecisionState = { status: 'idle'|'success'|'error'; message: string };
export async function reviewMmvIdentityAction(
  _state: IdentityDecisionState, data: FormData,
): Promise<IdentityDecisionState> {
  const { profile } = await requireRole('admin');
  const findingId = data.get('findingId');
  const identityKey = data.get('identityKey');
  const fingerprint = data.get('fingerprint');
  const decision = data.get('decision');
  if (typeof findingId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(findingId) ||
      typeof identityKey !== 'string' || identityKey.length < 1 || identityKey.length > 2000 ||
      typeof fingerprint !== 'string' || fingerprint.length > 4000 ||
      !['ACCEPT','REJECT','DEFER'].includes(String(decision))) {
    return {status:'error',message:'Decisão inválida.'};
  }
  const client = createPrivilegedAdminClient();
  const { data: finding, error } = await client.from('agent_findings')
    .select('id,fingerprint,finding_type,proposal,run_id').eq('id',findingId).single();
  if (error || !finding || finding.fingerprint !== fingerprint ||
      !['NEW_MODEL','NEW_VERSION'].includes(finding.finding_type) ||
      finding.proposal?.action !== 'STAGE_MMV_IDENTITIES') {
    return {status:'error',message:'Finding alterado ou não elegível. Recarregue a fila.'};
  }
  const {data: run,error: runError}=await client.from('agent_runs')
    .select('agent_type,status').eq('id',finding.run_id).single();
  if (runError || run?.agent_type !== 'MMV_DISCOVERY' || run.status !== 'COMPLETED')
    return {status:'error',message:'Execução não elegível.'};
  const identities = Array.isArray(finding.proposal.identities) ? finding.proposal.identities : [];
  if (identities.filter((item: {identityKey?: unknown})=>item?.identityKey===identityKey).length!==1)
    return {status:'error',message:'Identidade não encontrada ou duplicada neste finding.'};
  const {error:writeError}=await client.from('agent_mmv_identity_reviews').insert({
    finding_id:findingId,identity_key:identityKey,finding_fingerprint:fingerprint,
    decision,reviewed_by:profile.id,
  });
  if (writeError) return {status:'error',message:'Não foi possível registrar a decisão individual.'};
  revalidatePath('/admin/agents');
  revalidatePath('/admin/agents/findings/'+findingId);
  return {status:'success',message:'Decisão registrada apenas para esta identidade. Catálogo inalterado.'};
}
