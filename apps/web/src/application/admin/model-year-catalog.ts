import 'server-only';
import {
  AgentPlatformSupabaseAdapter,
  CanonicalModelYearSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import {
  modelYearApplyEligibility,
  type CanonicalMmvModelYearRepository,
} from '@compra-car/core/agents';
import { assertAgentUuid, type AgentPlatformRepository } from '@compra-car/core/agent-platform';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export interface ModelYearApplyActionState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
}

export interface ModelYearAdminDependencies {
  readonly authorize: () => Promise<{ readonly profile: { readonly id: string } }>;
  readonly platform: () => AgentPlatformRepository;
  readonly repository: () => CanonicalMmvModelYearRepository;
  readonly revalidate: (path: string) => void;
}

const defaults: ModelYearAdminDependencies = {
  authorize: () => requireRole('admin'),
  platform: () => new AgentPlatformSupabaseAdapter(createPrivilegedAdminClient()),
  repository: () => new CanonicalModelYearSupabaseAdapter(createPrivilegedAdminClient()),
  revalidate: revalidatePath,
};

export async function applyAcceptedModelYearFinding(
  data: FormData,
  deps: ModelYearAdminDependencies = defaults,
): Promise<ModelYearApplyActionState> {
  const { profile } = await deps.authorize();
  try {
    const findingId = data.get('findingId');
    const expectedFingerprint = data.get('expectedFingerprint');
    if (typeof findingId !== 'string' || typeof expectedFingerprint !== 'string')
      throw new Error('INVALID_INPUT');
    assertAgentUuid(findingId);

    const detail = await deps.platform().getFinding(findingId);
    if (!detail) throw new Error('PRODUCT_YEAR_FINDING_REQUIRED');
    const eligibility = modelYearApplyEligibility(detail, { expectedFingerprint });
    if (!eligibility.eligible) throw new Error(eligibility.code);

    const rows = await deps.repository().applyAcceptedProposal({
      findingId,
      actor: profile.id,
      proposal: eligibility.proposal,
      expectedFingerprint: eligibility.findingFingerprint,
    });

    try {
      deps.revalidate('/admin/agents');
      deps.revalidate('/admin/agents/findings/' + findingId);
      deps.revalidate('/admin/products');
    } catch {
      return {
        status: 'success',
        message:
          rows.length +
          ' ano(s)-modelo aplicado(s). O produto foi materializado como ativo e privado. Recarregue a página para atualizar.',
      };
    }
    return {
      status: 'success',
      message:
        rows.length +
        ' ano(s)-modelo aplicado(s). O produto foi materializado como ativo e privado.',
    };
  } catch {
    return {
      status: 'error',
      message:
        'Não foi possível aplicar o ano-modelo. Recarregue o finding e confirme que a revisão ACCEPT e a proposta ainda são atuais.',
    };
  }
}
