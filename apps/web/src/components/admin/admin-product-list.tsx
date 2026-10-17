'use client';

import type { AdminProductListItem } from '@/server/admin-product-service';
import { Fragment, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  duplicateAdminProductInlineAction,
  updateAdminProductInlineAction,
} from '@/app/admin/products/actions';
import { AdminProductStatusToggle } from './admin-product-status-toggle';

interface AdminProductListProps {
  readonly products: readonly AdminProductListItem[];
}

type Mode = 'edit' | 'duplicate';
type Draft = {
  brand: string;
  model: string;
  version: string;
  modelYear: string;
  productionYear: string;
  isActive: boolean;
  isPublic: boolean;
};

function draftFrom(product: AdminProductListItem, mode: Mode): Draft {
  return {
    brand: product.brand,
    model: product.model,
    version: product.version,
    modelYear: mode === 'duplicate'
      ? String(Number(product.modelYear) + 1)
      : product.modelYear,
    productionYear: mode === 'duplicate' ? String(Number(product.modelYear) + 1) : product.productionYear,
    isActive: mode === 'edit' ? product.isActive : false,
    isPublic: mode === 'edit' ? product.isPublic : false,
  };
}

const cellInput =
  'h-8 w-full min-w-0 rounded-md border border-[#D6DEE3] bg-white px-2 text-sm text-[#1A1D21] focus:border-[#9ABCC8] focus:outline-none focus:ring-2 focus:ring-[#9ABCC8]/25';

export function AdminProductList({ products }: AdminProductListProps) {
  const router = useRouter();
  const [opened, setOpened] = useState<{ id: string; mode: Mode } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const brands = [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const start = (product: AdminProductListItem, mode: Mode) => {
    setOpened({ id: product.id, mode });
    setDraft(draftFrom(product, mode));
    setMessage(null);
  };

  const cancel = () => {
    setOpened(null);
    setDraft(null);
    setMessage(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>, product: AdminProductListItem, mode: Mode) => {
    event.preventDefault();
    if (!draft || pending) return;
    const data = new FormData();
    data.set('brand', draft.brand);
    data.set('model', draft.model);
    data.set('version', draft.version);
    data.set('modelYear', draft.modelYear);
    // Preserved for the legacy canonical contract; PY is not user-editable in the new catalog.
    // Keep the legacy required field synchronized with MY until the canonical model drops PY.
    data.set('productionYear', mode === 'duplicate' ? draft.modelYear : draft.productionYear);
    data.set('isActive', String(draft.isActive));
    data.set('isPublic', String(draft.isPublic));
    setMessage(null);
    startTransition(async () => {
      try {
        const result = mode === 'edit'
          ? await updateAdminProductInlineAction(product.id, data)
          : await duplicateAdminProductInlineAction(product.id, data);
        if (result.status === 'success') {
          cancel();
          router.refresh();
        } else {
          const firstError = Object.values(result.fieldErrors).flat()[0];
          setMessage(('message' in result && typeof result.message === 'string' ? result.message : '') || firstError || 'Revise os campos informados.');
        }
      } catch {
        setMessage('Não foi possível salvar. Nenhuma alteração foi confirmada.');
      }
    });
  };

  const editor = (product: AdminProductListItem, mode: Mode) => {
    if (!draft) return null;
    return (
      <tr className="border-l-4 border-l-[#EF7732] bg-[#F4F9FB]" key={product.id + '-' + mode}>
        <td colSpan={5} className="px-3 py-3">
          <form onSubmit={(event) => submit(event, product, mode)}>
            {mode === 'duplicate' && (
              <div className="mb-2 text-xs font-semibold text-[#61747B]">
                NOVO MODELO — CÓPIA DE {product.brand} {product.model} {product.version} {product.modelYear}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-w-[7.5rem] flex-[1_1_8rem]">
                <span className="sr-only">Marca</span>
                <select aria-label="Marca" className={cellInput} value={draft.brand}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>
                  {[...new Set([...brands, draft.brand])].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })).map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-[8rem] flex-[1_1_11rem]">
                <span className="sr-only">Modelo</span>
                <input aria-label="Modelo" className={cellInput} required value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}/>
              </label>
              <label className="min-w-[12rem] flex-[2_1_21rem]">
                <span className="sr-only">Versão</span>
                <input aria-label="Versão" className={cellInput} required value={draft.version}
                  onChange={(e) => setDraft({ ...draft, version: e.target.value })}/>
              </label>
              <label className="w-24">
                <span className="sr-only">Ano-modelo</span>
                <input aria-label="Ano-modelo" className={cellInput} inputMode="numeric" required
                  value={draft.modelYear} onChange={(e) => setDraft({ ...draft, modelYear: e.target.value })}/>
              </label>
              {mode === 'duplicate' && (
                <>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked, isPublic: e.target.checked ? draft.isPublic : false })}/> Ativo</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.isPublic}
                    disabled={!draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isPublic: e.target.checked })}/> Público</label>
                </>
              )}
              <button type="submit" disabled={pending}
                className="cc-btn cc-btn--p cc-btn--primary">
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" disabled={pending} onClick={cancel}
                className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action">
                Cancelar
              </button>
            </div>
            {message && <p role="alert" className="mt-2 text-sm text-red-700">{message}</p>}
          </form>
        </td>
      </tr>
    );
  };

  return (
    <div className="admin-catalog-table-frame overflow-hidden rounded-lg border border-[#D6DEE3] bg-white">
      <div className="admin-catalog-table-scroll overflow-x-auto">
        <table className="ui-table w-full min-w-[68rem] table-fixed">
          <caption className="sr-only">Veículos cadastrados</caption>
          <colgroup><col /><col style={{ width: 160 }} /><col style={{ width: 160 }} /><col style={{ width: 160 }} /><col style={{ width: 160 }} /></colgroup>
          <thead className="admin-catalog-table-header bg-[#DCE8ED]">
            <tr>
              <th scope="col">Veículo</th>
              <th className="text-center" scope="col">Atividade</th>
              <th className="text-center" scope="col">Publicação</th>
              <th className="text-center" scope="col">Editar</th>
              <th className="text-center" scope="col">Duplicar</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const identity = [product.brand, product.model, product.version, product.modelYear].join(' ');
              return (
                <Fragment key={product.id}>
                  {opened?.id === product.id && opened.mode === 'duplicate' && editor(product, 'duplicate')}
                  <tr
                    className={`group cursor-pointer align-middle transition-colors ${opened?.id === product.id ? "bg-[#EAF1F4]" : opened ? "odd:bg-white even:bg-[#F8FAFB]" : "odd:bg-white even:bg-[#F8FAFB] hover:bg-[#EAF1F4]"}`}
                    onClick={(event) => {
                      const target = event.target;
                      if (opened || (target instanceof Element && target.closest('a, button, input, select, textarea, label'))) return;
                      router.push(`/admin/products/${product.id}/specs`);
                    }}
                  >
                    <td>
                      {opened?.id === product.id && opened.mode === 'edit' && draft ? (
                        <form id={`catalog-edit-${product.id}`} onSubmit={(event) => submit(event, product, 'edit')}
                          className="grid grid-cols-[1fr_1fr_2fr_5rem] items-center gap-2">
                          <select aria-label="Marca" className={cellInput} value={draft.brand}
                            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>
                            {[...new Set([...brands, draft.brand])].sort((a,b) => a.localeCompare(b,'pt-BR',{sensitivity:'base'})).map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                          </select>
                          <input aria-label="Modelo" className={cellInput} required value={draft.model}
                            onChange={(e) => setDraft({ ...draft, model: e.target.value })}/>
                          <input aria-label="Versão" className={cellInput} required value={draft.version}
                            onChange={(e) => setDraft({ ...draft, version: e.target.value })}/>
                          <input aria-label="Ano-modelo" className={cellInput} required inputMode="numeric" value={draft.modelYear}
                            onChange={(e) => setDraft({ ...draft, modelYear: e.target.value })}/>
                        </form>
                      ) : (
                        <Link className="block text-[0.8125rem] font-semibold text-[#1A1D21] hover:underline"
                          href={`/admin/products/${product.id}/specs`} title="Abrir ficha técnica">{identity}</Link>
                      )}
                      {opened?.id === product.id && opened.mode === 'edit' && message &&
                        <p role="alert" className="mt-1 text-xs text-red-700">{message}</p>}
                    </td>
                    <td className="text-center">
                      <AdminProductStatusToggle productId={product.id} productName={identity}
                        field="isActive" isActive={product.isActive} value={product.isActive}/>
                    </td>
                    <td className="text-center">
                      <AdminProductStatusToggle productId={product.id} productName={identity}
                        field="isPublic" isActive={product.isActive} value={product.isPublic}/>
                    </td>
                    <td className="text-center">
                      {opened?.id === product.id && opened.mode === 'edit' ? (
                        <button type="submit" form={`catalog-edit-${product.id}`} disabled={pending}
                          className="cc-btn cc-btn--p cc-btn--primary">{pending ? 'Salvando…' : 'Salvar'}</button>
                      ) : (
                        <button type="button" disabled={pending || Boolean(opened)} onClick={(event) => { event.stopPropagation(); window.setTimeout(() => start(product, 'edit'), 0); }}
                          className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action">Editar</button>
                      )}
                    </td>
                    <td className="text-center">
                      {opened?.id === product.id && opened.mode === 'edit' ? (
                        <button type="button" disabled={pending} onClick={cancel}
                          className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action">Cancelar</button>
                      ) : (
                        <button type="button" disabled={pending || Boolean(opened)} onClick={() => start(product, 'duplicate')}
                          className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action">Duplicar</button>
                      )}
                    </td>
                  </tr>
                </Fragment>
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
