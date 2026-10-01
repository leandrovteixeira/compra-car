import 'server-only';
import {
  AgentPlatformSupabaseAdapter,
  CanonicalMmvSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import {
  mmvApplyEligibility,
  type CanonicalMmvRepository,
} from '@compra-car/core/agents';
import {
  assertAgentUuid,
  type AgentPlatformRepository,
} from '@compra-car/core/agent-platform';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export interface MmvApplyActionState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
}

export interface MmvAdminDependencies {
  readonly authorize: () => Promise<{ readonly profile: { readonly id: string } }>;
  readonly platform: () => AgentPlatformRepository;
  readonly repository: () => CanonicalMmvRepository;
  readonly revalidate: (path: string) => void;
}

const defaults: MmvAdminDependencies = {
  authorize: () => requireRole('admin'),
  platform: () => new AgentPlatformSupabaseAdapter(createPrivilegedAdminClient()),
  repository: () => new CanonicalMmvSupabaseAdapter(createPrivilegedAdminClient()),
  revalidate: revalidatePath,
};

export async function applyAcceptedMmvFinding(
  data: FormData,
  deps: MmvAdminDependencies = defaults,
): Promise<MmvApplyActionState> {
  const { profile } = await deps.authorize();
  try {
    const findingId = data.get('findingId');
    const expectedFingerprint = data.get('expectedFingerprint');
    if (typeof findingId !== 'string' || typeof expectedFingerprint !== 'string')
      throw new Error('INVALID_INPUT');
    assertAgentUuid(findingId);

    const detail = await deps.platform().getFinding(findingId);
    if (!detail) throw new Error('MMV_FINDING_REQUIRED');
    const eligibility = mmvApplyEligibility(detail, { expectedFingerprint });
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
    } catch {
      return {
        status: 'success',
        message:
          rows.length +
          ' MMV(s) aplicado(s) ao catálogo MMV. Nenhum Product/MY foi criado. Recarregue a página para atualizar.',
      };
    }
    return {
      status: 'success',
      message: rows.length + ' MMV(s) aplicado(s) ao catálogo MMV. Nenhum Product/MY foi criado.',
    };
  } catch {
    return {
      status: 'error',
      message:
        'Não foi possível aplicar o MMV. Recarregue o finding e confirme que a revisão ACCEPT e a proposta ainda são atuais.',
    };
  }
}
