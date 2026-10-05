import 'server-only';

import { resolve } from 'node:path';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { runNewProductCheckCli } from '@compra-car/agents/run-new-product-check';

export interface AgentLaunchState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
  readonly runId: string | null;
}

function inputText(data: FormData, name: string, maxLength: number): string {
  const value = data.get(name);
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error('INVALID_INPUT');
  return trimmed;
}

export async function launchMmvDiscovery(
  data: FormData,
): Promise<AgentLaunchState> {
  await requireRole('admin');

  if (process.env.APP_ENV !== 'qa') {
    return {
      status: 'error',
      message: 'Execução bloqueada: este launcher só funciona no ambiente QA.',
      runId: null,
    };
  }

  try {
    const brand = inputText(data, 'brand', 100);
    const marketReconcile = data.get('marketReconcile') === 'on';
    const marketModelRaw = data.get('marketModel');
    const marketModel =
      typeof marketModelRaw === 'string' && marketModelRaw.trim()
        ? marketModelRaw.trim()
        : null;
    if (marketModel && (!marketReconcile || marketModel.length > 200))
      throw new Error('INVALID_INPUT');

    const args = [
      '--brand',
      brand,
      '--provider',
      'openai',
      '--persist-findings',
      ...(marketReconcile ? ['--market-reconcile'] : []),
      ...(marketModel ? ['--market-model', marketModel] : []),
    ];

    const logs: string[] = [];
    const repositoryRoot = resolve(process.cwd(), '../..');
    const code = await runNewProductCheckCli(
      args,
      process.env,
      (line) => logs.push(line),
      repositoryRoot,
    );
    const runLine = logs.find((line) => line.startsWith('Run: '));
    const runId = runLine?.slice('Run: '.length).trim() || null;

    if (code !== 0 || !runId) {
      return {
        status: 'error',
        message:
          logs.find((line) => line.startsWith('NEW_PRODUCT_CHECK_FAILED:')) ??
          'A execução do agente falhou. Consulte Runs e os logs do QA.',
        runId,
      };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/agents?tab=runs');
    return {
      status: 'success',
      message: 'Run concluída e findings persistidos no QA.',
      runId,
    };
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível iniciar a run. Verifique marca, modelo e configuração do QA.',
      runId: null,
    };
  }
}
