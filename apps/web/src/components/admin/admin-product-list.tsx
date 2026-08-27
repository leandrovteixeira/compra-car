import type { AdminProductListItem } from '@/server/admin-product-service';
import Link from 'next/link';

interface AdminProductListProps {
  readonly products: readonly AdminProductListItem[];
}

function StatusBadge({
  children,
  positive,
}: {
  readonly children: string;
  readonly positive: boolean;
}) {
  return (
    <span
      className={`ui-badge ${
        positive
          ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
          : 'border-border bg-surface-muted text-text-muted'
      }`}
    >
      {children}
    </span>
  );
}

export function AdminProductList({ products }: AdminProductListProps) {
  return (
    <div className="admin-catalog-table-frame overflow-hidden rounded-lg border border-border bg-surface">
      <div className="admin-catalog-table-scroll overflow-x-auto">
        <table className="ui-table min-w-[50rem] lg:min-w-0">
          <caption className="sr-only">Veículos cadastrados</caption>
          <thead className="admin-catalog-table-header bg-surface-muted">
            <tr>
              <th className="w-20" scope="col">
                ID
              </th>
              <th className="w-[18%]" scope="col">
                Veículo
              </th>
              <th className="w-[22%]" scope="col">
                Versão
              </th>
              <th className="w-24" scope="col">
                Ano
              </th>
              <th className="w-24" scope="col">
                Atividade
              </th>
              <th className="w-24" scope="col">
                Publicação
              </th>
              <th className="w-72" scope="col">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr className="align-middle transition hover:bg-surface-muted/60" key={product.id}>
                <td className="font-mono text-[0.6875rem] text-text-muted">{product.id}</td>
                <td>
                  <p className="font-semibold leading-4 text-text-primary">{product.model}</p>
                  <p className="text-xs leading-4 text-text-muted">{product.brand}</p>
                </td>
                <td className="max-w-xs text-text-secondary">{product.version}</td>
                <td className="whitespace-nowrap text-text-secondary">
                  {product.productionYear}/{product.modelYear}
                </td>
                <td>
                  <StatusBadge positive={product.isActive}>
                    {product.isActive ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <StatusBadge positive={product.isPublic}>
                    {product.isPublic ? 'Público' : 'Privado'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Link
                      className="ui-button ui-button--ghost ui-button--compact"
                      href={`/admin/products/${product.id}/edit`}
                    >
                      Editar
                    </Link>
                    <Link
                      className="ui-button ui-button--ghost ui-button--compact"
                      href={`/admin/products/${product.id}/duplicate`}
                    >
                      Duplicar
                    </Link>
                    <Link
                      className="ui-button ui-button--secondary ui-button--compact"
                      href={`/admin/products/${product.id}/specs`}
                    >
                      Especificações
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
        {products.length} {products.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}
      </p>
    </div>
  );
}
