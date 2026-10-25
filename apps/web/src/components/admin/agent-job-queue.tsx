import Link from 'next/link';
import type { AgentJobListItem } from '@/application/admin/agent-runner';

const labels: Record<string, string> = {
  QUEUED: 'Na fila',
  RUNNING: 'Executando',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

export function AgentJobQueue({ items }: { readonly items: readonly AgentJobListItem[] }) {
  return (
    <section className="ui-form-section space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Execuções em background</h2>
        <p className="mt-1 text-sm text-text-secondary">
          O navegador pode ser fechado depois do enqueue. O worker do QA continua a execução.
        </p>
      </div>
      {!items.length ? (
        <p className="text-sm text-text-muted">Nenhum job recente.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <tr>
                {['Marca', 'Agente', 'Status', 'Criado', 'Run'].map((heading) => (
                  <th key={heading} className="p-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((job) => (
                <tr key={job.id} className="border-t border-border first:border-t-0">
                  <td className="p-3 font-medium">{job.brand}</td>
                  <td className="p-3 text-text-secondary">{job.jobType}</td>
                  <td className="p-3">{labels[job.status] ?? job.status}</td>
                  <td className="p-3 text-text-secondary">
                    {new Date(job.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3">
                    {job.runId ? (
                      <Link className="underline-offset-2 hover:underline" href={'/admin/agents/runs/' + job.runId}>
                        Abrir run
                      </Link>
                    ) : job.status === 'FAILED' ? (
                      <span className="text-text-muted">{String(job.error?.code ?? 'Erro')}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
