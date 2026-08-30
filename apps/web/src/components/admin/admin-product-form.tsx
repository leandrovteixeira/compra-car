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
  modelYearAfterProductionYearChange,
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
  return <p className="mt-1 text-xs text-status-error">{messages[0]}</p>;
}

const inputClass = 'ui-field mt-1 min-h-9 text-base sm:text-[0.8125rem]';

function SuccessDialog({
  mode,
  productId,
}: {
  readonly mode: AdminProductFormMode;
  readonly productId: string;
}) {
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
          <Link
            className="min-h-12 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-100 transition hover:bg-slate-700"
            href={`/admin/products/${productId}/specs`}
          >
            <span className="block font-semibold">
              {mode === 'duplicate' ? 'Revisar equipamentos copiados' : 'Cadastrar equipamentos'}
            </span>
            <span className="text-xs text-slate-400">Abrir ficha técnica</span>
          </Link>
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
  const productionYearOptions = createProductionYearOptions(currentYear);
  const modelYearOptions = createModelYearOptions(productionYear, currentYear);

  function changeActive(checked: boolean) {
    setIsActive(checked);
    if (!checked) setIsPublic(false);
  }

  function changePublic(checked: boolean) {
    setIsPublic(checked);
    if (checked) setIsActive(true);
  }

  function changeProductionYear(nextProductionYear: string) {
    setProductionYear(nextProductionYear);
    setModelYear(modelYearAfterProductionYearChange(nextProductionYear, modelYear, currentYear));
  }

  return (
    <form action={action} className="ui-surface w-full max-w-5xl p-4 sm:p-5">
      <fieldset disabled={pending || (mode !== 'edit' && state.status === 'success')}>
        {state.status === 'error' && state.message ? (
          <div
            className="mb-4 rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-status-error"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}
        {mode === 'edit' && state.status === 'success' ? (
          <div
            className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-status-success"
            role="status"
          >
            {state.message}
          </div>
        ) : null}

        <div className="ui-form-grid sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.35fr)]">
          <label className="ui-label block min-w-0">
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
          <label className="ui-label block min-w-0">
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
          <label className="ui-label block min-w-0">
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

        <div className="mt-4 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8.5rem,0.75fr)_minmax(8.5rem,0.75fr)_auto_auto] lg:gap-x-4">
          <label className="ui-label block min-w-0">
            Ano produção
            <select
              aria-describedby={
                state.fieldErrors.productionYear ? 'production-year-error' : undefined
              }
              aria-invalid={Boolean(state.fieldErrors.productionYear)}
              className={inputClass}
              name="productionYear"
              onChange={(event) => changeProductionYear(event.target.value)}
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
          <label className="ui-label block min-w-0">
            Ano modelo
            <select
              aria-describedby={state.fieldErrors.modelYear ? 'model-year-error' : undefined}
              aria-invalid={Boolean(state.fieldErrors.modelYear)}
              className={inputClass}
              disabled={!productionYear}
              name="modelYear"
              onChange={(event) => setModelYear(event.target.value)}
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

          <label className="touch-target flex min-h-9 cursor-pointer items-center gap-2 px-1 text-[0.8125rem] font-medium text-text-secondary lg:mt-5 lg:min-w-20">
            <input
              checked={isActive}
              className="size-4 accent-selection-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onChange={(event) => changeActive(event.target.checked)}
              type="checkbox"
            />
            Ativo
            <input name="isActive" type="hidden" value={String(isActive)} />
          </label>
          <label className="touch-target flex min-h-9 cursor-pointer items-center gap-2 px-1 text-[0.8125rem] font-medium text-text-secondary lg:mt-5 lg:min-w-20">
            <input
              checked={isPublic}
              className="size-4 accent-selection-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onChange={(event) => changePublic(event.target.checked)}
              type="checkbox"
            />
            Público
            <input name="isPublic" type="hidden" value={String(isPublic)} />
          </label>
        </div>
        <FieldError messages={state.fieldErrors.isPublic} />

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Link className="ui-button ui-button--ghost ui-button--action" href="/admin/products">
            Cancelar
          </Link>
          <button
            className="ui-button ui-button--primary ui-button--commit"
            disabled={pending}
            type="submit"
          >
            {pending
              ? 'Salvando…'
              : mode === 'edit'
                ? 'Salvar alterações'
                : mode === 'duplicate'
                  ? 'Criar veículo'
                  : 'Criar veículo'}
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
        <SuccessDialog mode={mode} productId={state.id} />
      ) : null}
    </>
  );
}
