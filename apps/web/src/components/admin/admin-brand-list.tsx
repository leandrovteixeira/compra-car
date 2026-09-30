import type { MonitoredBrandListItem } from '@/application/admin/brand-monitoring';

interface AdminBrandListProps {
  readonly brands: readonly MonitoredBrandListItem[];
}

export function AdminBrandList({ brands }: AdminBrandListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Marca</th>
              <th className="px-4 py-3 font-semibold">Chave</th>
              <th className="px-4 py-3 font-semibold">Mercado</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td className="px-4 py-3 font-medium text-text-primary">{brand.brand}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">{brand.brandKey}</td>
                <td className="px-4 py-3 text-text-secondary">{brand.market}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {brand.origin === 'MANUAL' ? 'Manual' : 'Catálogo'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Monitorada
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
