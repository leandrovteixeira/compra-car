import type { AdminProductListItem } from '@/server/admin-product-service';
import Link from 'next/link';
import { AdminProductStatusToggle } from './admin-product-status-toggle';

interface AdminProductListProps {
  readonly products: readonly AdminProductListItem[];
}

/** Compact MMVY catalog. Keep edit/duplicate server workflows until inline mutations are validated. */
export function AdminProductList({ products }: AdminProductListProps) {
  return (
    <div className="admin-catalog-table-frame overflow-hidden rounded-lg border border-[#D6DEE3] bg-white">
      <div className="admin-catalog-table-scroll overflow-x-auto">
        <table className="ui-table min-w-[52rem] lg:min-w-0">
          <caption className="sr-only">Veículos cadastrados</caption>
          <thead className="admin-catalog-table-header bg-[#DCE8ED]">
            <tr>
              <th className="w-[52%]" scope="col">Veículo</th>
              <th className="w-28 text-center" scope="col">Atividade</th>
              <th className="w-28 text-center" scope="col">Publicação</th>
              <th className="w-44 text-center" scope="col">Editar</th>
              <th className="w-28 text-center" scope="col">Duplicar</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const identity = [product.brand, product.model, product.version, product.modelYear].join(' ');
              return (
                <tr className="align-middle transition-colors odd:bg-white even:bg-[#F8FAFB] hover:bg-[#EAF1F4]" key={product.id}>
                  <td>
                    <Link className="block font-semibold text-[#1A1D21] hover:underline"
                      href={`/admin/products/${product.id}/specs`} title="Abrir ficha técnica">
                      {identity}
                    </Link>
                  </td>
                  <td className="text-center">
                    <AdminProductStatusToggle productId={product.id} productName={identity}
                      field="isActive" isActive={product.isActive} value={product.isActive} />
                  </td>
                  <td className="text-center">
                    <AdminProductStatusToggle productId={product.id} productName={identity}
                      field="isPublic" isActive={product.isActive} value={product.isPublic} />
                  </td>
                  <td className="text-center">
                    <Link className="inline-flex min-h-9 items-center justify-center rounded-md px-3 text-xs font-semibold text-[#1A1D21] hover:bg-[#DCE8ED]"
                      href={`/admin/products/${product.id}/edit`}>EDITAR</Link>
                  </td>
                  <td className="text-center">
                    <Link className="inline-flex min-h-9 items-center justify-center rounded-md px-3 text-xs font-semibold text-[#1A1D21] hover:bg-[#DCE8ED]"
                      href={`/admin/products/${product.id}/duplicate`}>DUPLICAR</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#D6DEE3] px-3 py-2 text-xs text-[#61747B]">
        {products.length} {products.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}
      </p>
    </div>
  );
}
