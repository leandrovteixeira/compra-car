import Link from 'next/link';
import type { ImportBatchListItemDto } from '@compra-car/contracts';

function date(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

export function AdminImportList({ items }: { readonly items: readonly ImportBatchListItemDto[] }) {
  if (!items.length)
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
        Nenhuma importação encontrada.
      </div>
    );
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article
          className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(7rem,auto))] lg:items-center"
          key={item.id}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
              #{item.id} · Cartas Comerciais
            </p>
            <h2 className="truncate text-base font-bold text-white">{item.title}</h2>
            <p className="text-sm text-slate-500">
              Criado por {item.createdByName ?? 'usuário removido'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Competência</p>
            <p className="text-sm text-slate-200">{item.competence ?? 'Não informada'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="text-sm font-semibold text-emerald-300">{item.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Documentos</p>
            <p className="text-sm text-slate-200">{item.documentCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">MMVs</p>
            <p className="text-sm text-slate-200">{item.mmvCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Atualizado</p>
            <p className="text-sm text-slate-200">{date(item.updatedAt)}</p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-700 px-4 text-sm font-bold text-sky-200"
            href={`/admin/imports/${item.id}`}
          >
            Abrir
          </Link>
        </article>
      ))}
    </div>
  );
}
