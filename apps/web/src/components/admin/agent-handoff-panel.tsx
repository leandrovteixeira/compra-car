import type { AgentHandoffSummary } from '@/application/admin/agent-handoff-summary';

const statusLabel:Record<string,string>={
  QUEUED:'Aguardando agente', CLAIMED:'Em processamento', BLOCKED:'Dependência',
  COMPLETED:'Resolvida', EXHAUSTED:'Limite atingido', CANCELLED:'Cancelada',
};
export function AgentHandoffPanel({summary}:{readonly summary:AgentHandoffSummary}) {
  return <section className="space-y-3" aria-labelledby="handoff-section-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="handoff-section-title" className="text-base font-semibold">
          Delegações entre agentes
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Pendências internas, separadas das decisões do operador. Despacho automático desabilitado no piloto.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-[#EAF1F4] px-3 py-2">{summary.queued} na fila</span>
        <span className="rounded bg-[#EAF1F4] px-3 py-2">{summary.blocked} bloqueadas</span>
        <span className="rounded bg-[#EAF1F4] px-3 py-2">{summary.completed} resolvidas</span>
      </div>
    </div>
    {!summary.items.length ? <div className="ui-surface p-4 text-sm text-text-secondary">
      Ainda não existem delegações no pool. Nas próximas execuções de Ano-modelo, faltas de
      identidade MMV serão registradas aqui sem gerar aprovação na Fila de Revisões.
    </div>:
    <div className="overflow-x-auto rounded-md border border-[#D6DEE3]">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-[#DCE8ED] text-[#526670]">
          <tr>
            <th className="p-3">Veículo</th><th className="p-3">Origem</th>
            <th className="p-3">Destino</th><th className="p-3">Situação</th>
            <th className="p-3">Despacho</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EAF1F4] bg-white">
          {summary.items.map(item=><tr key={item.id}>
            <td className="p-3 font-medium">{[item.brand,item.model,item.versionLabel].filter(Boolean).join(' ')}</td>
            <td className="p-3">{item.sourceAgent}</td>
            <td className="p-3">{item.targetAgent}</td>
            <td className="p-3">{statusLabel[item.status]??item.status}</td>
            <td className="p-3">{item.dispatchEnabled?'Autorizado':'Desabilitado'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </section>;
}
