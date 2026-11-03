import 'server-only';
import { AgentPlatformSupabaseAdapter } from '@compra-car/adapter-supabase';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { brandKey, type BrandConnectorRepository } from '@compra-car/core/agents';
import {
  assertAgentUuid,
  type AgentPlatformRepository,
  type AgentRunListItem,
} from '@compra-car/core/agent-platform';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
export interface BrandAdminDependencies {
  readonly authorize: () => Promise<{ readonly profile: { readonly id: string } }>;
  readonly repository: () => BrandConnectorRepository;
  readonly platform: () => AgentPlatformRepository;
  readonly revalidate: (path: string) => void;
}
const defaults: BrandAdminDependencies = {
  authorize: () => requireRole('admin'),
  repository: () => new BrandConnectorSupabaseAdapter(createPrivilegedAdminClient()),
  platform: () => new AgentPlatformSupabaseAdapter(createPrivilegedAdminClient()),
  revalidate: revalidatePath,
};
export async function loadBrandTargets(deps = defaults) {
  await deps.authorize();
  const repository = deps.repository(),
    targets = await repository.listTargets();
  const runs: AgentRunListItem[] = [];
  const platform = deps.platform();
  for (let offset = 0; ; offset += 100) {
    const page = await platform.listRuns({ agentType: 'BRAND_CONNECTOR', offset, limit: 100 });
    runs.push(...page.items);
    if (offset + page.items.length >= page.total || !page.items.length) break;
  }
  return Promise.all(
    targets.map(async (target) => ({
      target,
      active: await repository.getActiveConnector(target.brand, target.market),
      latestRun:
        runs
          .filter(
            ({ run }) =>
              run.brand && brandKey(run.brand) === target.brandKey && run.market === target.market,
          )
          .sort((a, b) => Date.parse(b.run.startedAt) - Date.parse(a.run.startedAt))[0]?.run ??
        null,
    })),
  );
}
export async function loadBrandConnectorDetail(id: string, deps = defaults) {
  await deps.authorize();
  assertAgentUuid(id);
  const repository = deps.repository(),
    target = (await repository.listTargets()).find((t) => t.id === id);
  return target ? { target, versions: await repository.listConnectorVersions(id) } : null;
}
export interface BrandActionState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
}
export async function manageBrandConnector(
  data: FormData,
  deps = defaults,
): Promise<BrandActionState> {
  const { profile } = await deps.authorize();
  let message: string;
  let activatedTargetId: string | undefined;
  try {
    const repository = deps.repository();
    const field = (name: string) => {
      const v = data.get(name);
      if (typeof v !== 'string') throw new Error('INVALID_INPUT');
      return v;
    };
    switch (field('operation')) {
      case 'add':
        await repository.addManualTarget(field('brand'), field('market'), profile.id);
        message = 'Marca registrada. Nenhum produto foi criado.';
        break;
      case 'sync': {
        const result = await repository.syncCatalogBrands();
        message = `${result.added} novas marcas adicionadas; ${result.existing} já existentes.`;
        break;
      }
      case 'enable': {
        const value = field('enabled');
        if (!['true', 'false'].includes(value)) throw new Error('INVALID_INPUT');
        await repository.setEnabled(field('targetId'), value === 'true');
        message = value === 'true' ? 'Monitoramento habilitado.' : 'Monitoramento pausado.';
        break;
      }
      case 'activate':
        activatedTargetId = (await repository.activateConnector(field('findingId'), profile.id))
          .targetId;
        message = 'Connector ativado. Catálogo preservado.';
        break;
      default:
        throw new Error('INVALID_INPUT');
    }
  } catch {
    return {
      status: 'error',
      message:
        'Não foi possível concluir. Confira os dados e, para ativação, a revisão ACCEPT, a proposta e a versão ativa. Recarregue antes de tentar novamente.',
    };
  }
  try {
    deps.revalidate('/admin/agents');
    deps.revalidate('/admin/agents/brands');
    if (activatedTargetId) deps.revalidate('/admin/agents/brands/' + activatedTargetId);
    const id = data.get('findingId');
    if (typeof id === 'string') deps.revalidate('/admin/agents/findings/' + id);
    const targetId = data.get('targetId');
    if (typeof targetId === 'string') deps.revalidate('/admin/agents/brands/' + targetId);
  } catch {
    message += ' Recarregue a página para atualizar os dados.';
  }
  return { status: 'success', message };
}
