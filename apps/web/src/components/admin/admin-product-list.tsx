import type { AdminProductListItem } from '@/server/admin-product-service';

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
      className={
        positive
          ? 'inline-flex rounded-full border border-emerald-800 bg-emerald-950/50 px-2.5 py-1 text-xs font-semibold text-emerald-300'
          : 'inline-flex rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-400'
      }
    >
      {children}
    </span>
  );
}

export function AdminProductList({ products }: AdminProductListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <caption className="sr-only">Veículos cadastrados</caption>
          <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                ID
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Veículo
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Versão
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Ano
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Atividade
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Publicação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.map((product) => (
              <tr className="align-top transition hover:bg-slate-900/80" key={product.id}>
                <td className="px-4 py-4 font-mono text-xs text-slate-500">{product.id}</td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-100">{product.model}</p>
                  <p className="mt-1 text-slate-400">{product.brand}</p>
                </td>
                <td className="max-w-xs px-4 py-4 text-slate-300">{product.version}</td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                  {product.modelYear}/{product.productionYear}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge positive={product.isActive}>
                    {product.isActive ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge positive={product.isPublic}>
                    {product.isPublic ? 'Público' : 'Privado'}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
        {products.length} {products.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}
      </p>
    </div>
  );
}
