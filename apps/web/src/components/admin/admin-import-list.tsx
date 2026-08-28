import Link from 'next/link';
import type { ImportBatchListItemDto } from '@compra-car/contracts';
import {
  buttonClassName,
  infoBadgeClassName,
  tableClassName,
  tableFrameClassName,
} from '@compra-car/ui';

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
      <div className="border-y border-border py-10 text-center text-text-muted">
        Nenhuma importação encontrada.
      </div>
    );
  return (
    <div className={`${tableFrameClassName} overflow-x-auto`}>
      <table className={`${tableClassName} min-w-[58rem]`}>
        <thead>
          <tr>
            <th>Dossiê</th>
            <th>Competência</th>
            <th>Status</th>
            <th>Documentos</th>
            <th>MMVs</th>
            <th>Atualizado</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="max-w-80">
                <p className="truncate font-semibold text-text-primary">{item.title}</p>
                <p className="text-xs text-text-muted">
                  #{item.id} · {item.createdByName ?? 'usuário removido'}
                </p>
              </td>
              <td>{item.competence ?? 'Não informada'}</td>
              <td>
                <span className={infoBadgeClassName}>{item.status}</span>
              </td>
              <td>{item.documentCount}</td>
              <td>{item.mmvCount}</td>
              <td className="whitespace-nowrap">{date(item.updatedAt)}</td>
              <td>
                <Link
                  className={buttonClassName({ compact: true, variant: 'secondary' })}
                  href={`/admin/imports/${item.id}`}
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
