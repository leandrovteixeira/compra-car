'use client';

import type {
  AdministrativeVehicleActionStateDto,
  AdministrativeVehicleFormValuesDto,
} from '@compra-car/contracts';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

import {
  createModelYearOptions,
  createProductionYearOptions,
  productionYearAfterModelYearChange,
} from '@/application/admin/vehicle-year-options';

const emptyValues: AdministrativeVehicleFormValuesDto = {
  brand: '',
  model: '',
  version: '',
  modelYear: '',
  productionYear: '',
  isActive: false,
  isPublic: false,
};

type AdminProductFormAction = (
  state: AdministrativeVehicleActionStateDto,
  formData: FormData,
) => Promise<AdministrativeVehicleActionStateDto>;

export type AdminProductFormMode = 'create' | 'duplicate' | 'edit';

function FieldError({ messages }: { readonly messages?: readonly string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-rose-300">{messages[0]}</p>;
}

const inputClass =
  'mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

function SuccessDialog({ productId }: { readonly productId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    listLinkRef.current?.focus();
  }, []);

  return (
    <dialog
      aria-labelledby="creation-success-title"
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
      onCancel={(event) => event.preventDefault()}
      ref={dialogRef}
    >
      <div className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
          Cadastro concluído
        </p>
        <h2 className="mt-2 text-2xl font-bold" id="creation-success-title">
          Veículo cadastrado com sucesso.
        </h2>
        <p className="mt-3 text-slate-300">O que deseja fazer agora?</p>
        <p className="mt-1 text-xs text-slate-500">Identificador criado: {productId}</p>

        <div className="mt-6 grid gap-3">
          <button
            className="min-h-12 cursor-not-allowed rounded-xl border border-slate-700 bg-slate-800 px-4 text-left text-slate-400"
            disabled
            type="button"
          >
            <span className="block font-semibold">Cadastrar equipamentos</span>
            <span className="text-xs">Disponível em breve</span>
          </button>
          <Link
            className="flex min-h-12 items-center rounded-xl border border-slate-700 bg-slate-800 px-4 text-left text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
            href={`/admin/products/${productId}/edit`}
          >
            <span className="font-semibold">Editar veículo</span>
          </Link>
          <Link
            className="flex min-h-12 items-center justify-center rounded-xl bg-sky-500 px-4 font-semibold text-slate-950 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
            href="/admin/products"
            ref={listLinkRef}
          >
            Voltar para a lista
          </Link>
        </div>
      </div>
    </dialog>
  );
}

interface ProductFieldsProps {
  readonly action: (formData: FormData) => void;
  readonly currentYear: number;
  readonly mode: AdminProductFormMode;
  readonly pending: boolean;
  readonly state: AdministrativeVehicleActionStateDto;
}

function ProductFields({ action, currentYear, mode, pending, state }: ProductFieldsProps) {
  const [isActive, setIsActive] = useState(state.values.isActive);
  const [isPublic, setIsPublic] = useState(state.values.isPublic);
  const [modelYear, setModelYear] = useState(state.values.modelYear);
  const [productionYear, setProductionYear] = useState(state.values.productionYear);
  const modelYearOptions = createModelYearOptions(currentYear);
  const productionYearOptions = createProductionYearOptions(modelYear);

  function changeActive(checked: boolean) {
    setIsActive(checked);
    if (!checked) setIsPublic(false);
  }

  function changePublic(checked: boolean) {
    setIsPublic(checked);
    if (checked) setIsActive(true);
  }

  function changeModelYear(nextModelYear: string) {
    setModelYear(nextModelYear);
    setProductionYear(productionYearAfterModelYearChange(nextModelYear, productionYear));
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-7"
    >
      <fieldset disabled={pending || (mode !== 'edit' && state.status === 'success')}>
        {state.status === 'error' && state.message ? (
          <div
            className="mb-6 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}
        {mode === 'edit' && state.status === 'success' ? (
          <div
            className="mb-6 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200"
            role="status"
          >
            {state.message}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr_1.4fr]">
          <label className="block text-sm font-semibold text-slate-200">
            Marca
            <input
              aria-describedby={state.fieldErrors.brand ? 'brand-error' : undefined}
              aria-invalid={Boolean(state.fieldErrors.brand)}
              className={inputClass}
              defaultValue={state.values.brand}
              name="brand"
              required
            />
            <span id="brand-error">
              <FieldError messages={state.fieldErrors.brand} />
            </span>
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            Modelo
            <input
              aria-describedby={state.fieldErrors.model ? 'model-error' : undefined}
              aria-invalid={Boolean(state.fieldErrors.model)}
              className={inputClass}
              defaultValue={state.values.model}
              name="model"
              required
            />
            <span id="model-error">
              <FieldError messages={state.fieldErrors.model} />
            </span>
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            Versão
            <input
              aria-describedby={state.fieldErrors.version ? 'version-error' : undefined}
              aria-invalid={Boolean(state.fieldErrors.version)}
              className={inputClass}
              defaultValue={state.values.version}
              name="version"
              required
            />
            <span id="version-error">
              <FieldError messages={state.fieldErrors.version} />
            </span>
          </label>
        </div>

        <div className="mt-5 grid items-start gap-y-5 sm:gap-x-5 lg:grid-cols-[1fr_1fr_auto_auto] lg:gap-x-4">
          <label className="block text-sm font-semibold text-slate-200">
            Ano modelo
            <select
              aria-describedby={state.fieldErrors.modelYear ? 'model-year-error' : undefined}
              aria-invalid={Boolean(state.fieldErrors.modelYear)}
              className={inputClass}
              name="modelYear"
              onChange={(event) => changeModelYear(event.target.value)}
              required
              value={modelYear}
            >
              <option value="">Selecione</option>
              {modelYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span id="model-year-error">
              <FieldError messages={state.fieldErrors.modelYear} />
            </span>
          </label>
          <label className="block text-sm font-semibold text-slate-200">
            Ano produção
            <select
              aria-describedby={
                state.fieldErrors.productionYear ? 'production-year-error' : undefined
              }
              aria-invalid={Boolean(state.fieldErrors.productionYear)}
              className={inputClass}
              disabled={!modelYear}
              name="productionYear"
              onChange={(event) => setProductionYear(event.target.value)}
              required
              value={productionYear}
            >
              <option value="">Selecione</option>
              {productionYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span id="production-year-error">
              <FieldError messages={state.fieldErrors.productionYear} />
            </span>
          </label>

          <label className="flex min-h-11 min-w-24 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-200 lg:mt-7">
            <input
              checked={isActive}
              className="size-5 accent-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              onChange={(event) => changeActive(event.target.checked)}
              type="checkbox"
            />
            Ativo
            <input name="isActive" type="hidden" value={String(isActive)} />
          </label>
          <label className="flex min-h-11 min-w-24 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-200 lg:mt-7">
            <input
              checked={isPublic}
              className="size-5 accent-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              onChange={(event) => changePublic(event.target.checked)}
              type="checkbox"
            />
            Público
            <input name="isPublic" type="hidden" value={String(isPublic)} />
          </label>
        </div>
        <FieldError messages={state.fieldErrors.isPublic} />

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
          <Link
            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-5 font-semibold text-slate-200 transition hover:bg-slate-800"
            href="/admin/products"
          >
            Cancelar
          </Link>
          <button
            className="min-h-11 rounded-xl bg-sky-500 px-5 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending
              ? 'Salvando…'
              : mode === 'edit'
                ? 'Salvar alterações'
                : mode === 'duplicate'
                  ? 'Criar veículo'
                  : 'Salvar'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

interface AdminProductFormProps {
  readonly action: AdminProductFormAction;
  readonly currentYear: number;
  readonly initialValues?: AdministrativeVehicleFormValuesDto;
  readonly mode: AdminProductFormMode;
}

export function AdminProductForm({
  action: formAction,
  currentYear,
  initialValues = emptyValues,
  mode,
}: AdminProductFormProps) {
  const initialState: AdministrativeVehicleActionStateDto = {
    status: 'idle',
    values: initialValues,
    fieldErrors: {},
  };
  const [state, action, pending] = useActionState(formAction, initialState);
  const stateKey = [
    state.status,
    state.values.brand,
    state.values.model,
    state.values.version,
    state.values.modelYear,
    state.values.productionYear,
    state.values.isActive,
    state.values.isPublic,
  ].join('\u001f');

  return (
    <>
      <ProductFields
        action={action}
        currentYear={currentYear}
        key={stateKey}
        mode={mode}
        pending={pending}
        state={state}
      />
      {mode !== 'edit' && state.status === 'success' ? (
        <SuccessDialog productId={state.id} />
      ) : null}
    </>
  );
}
