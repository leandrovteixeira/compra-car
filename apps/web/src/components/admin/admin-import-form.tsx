'use client';

import type { ChangeEvent, DragEvent } from 'react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ImportBatchActionStateDto } from '@compra-car/contracts';

import {
  IMPORT_DOCUMENT_ROLES,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_MAX_PDF_BYTES,
} from '@compra-car/core';

import {
  IMPORT_ENGINE_MAX_SELECTION_BYTES,
  IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE,
} from '@/config/import-engine-upload';
import { importDocumentRoleFieldName } from '@/application/admin/import-document-submission';

import {
  appendImportFiles,
  removeImportFile,
  updateImportFileRole,
  type SelectedImportFile,
} from './admin-import-file-selection';
import { AdminImportFileInput } from './admin-import-file-input';
import { buttonClassName, fieldClassName, formGridClassName, labelClassName } from '@compra-car/ui';

const ROLE_LABELS: Readonly<Record<string, string>> = {
  primary: 'Carta principal',
  errata: 'Errata',
  complement: 'Complemento',
  financial_appendix: 'Anexo financeiro',
  trade_in_appendix: 'Anexo de Trade-In',
  technical_appendix: 'Anexo técnico',
  other: 'Outro',
};

function formatBytes(value: number): string {
  return (
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + ' MB'
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className={buttonClassName({ variant: 'interactive' })}
      disabled={pending}
      type="submit"
    >
      {pending ? 'Enviando documentos…' : 'Criar importação'}
    </button>
  );
}

interface AdminImportFormProps {
  readonly action: (
    state: ImportBatchActionStateDto,
    formData: FormData,
  ) => Promise<ImportBatchActionStateDto>;
  readonly initialState: ImportBatchActionStateDto;
}

export function AdminImportForm({ action, initialState }: AdminImportFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [selection, setSelection] = useState<readonly SelectedImportFile[]>([]);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const addFiles = (incoming: readonly File[]) => {
    const result = appendImportFiles(
      selection,
      incoming,
      IMPORT_ENGINE_MAX_DOCUMENTS,
      IMPORT_ENGINE_MAX_SELECTION_BYTES,
      'primary',
    );
    setSelection(result.selection);
    const notices: string[] = [];
    if (result.duplicateNames.length)
      notices.push(`Arquivo já selecionado: ${[...new Set(result.duplicateNames)].join(', ')}.`);
    if (result.rejectedByLimit)
      notices.push(`O dossiê aceita no máximo ${IMPORT_ENGINE_MAX_DOCUMENTS} documentos.`);
    if (result.rejectedByTotalBytes) notices.push(IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE);
    setSelectionNotice(notices.length ? notices.join(' ') : null);
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };
  const removeFile = (index: number) => {
    setSelection((current) => removeImportFile(current, index));
    setSelectionNotice(null);
  };

  return (
    <form action={formAction} className="grid gap-5">
      <input name="idempotencyKey" type="hidden" value={state.values.idempotencyKey} />
      <div className={formGridClassName}>
        <label className={`${labelClassName} grid gap-1.5`}>
          Plugin
          <input
            className={`${fieldClassName} bg-surface-muted text-text-muted`}
            disabled
            value="Cartas Comerciais"
          />
        </label>
        <label className={`${labelClassName} grid gap-1.5`}>
          Competência, se conhecida <span className="font-normal text-text-muted">(opcional)</span>
          <input
            className={fieldClassName}
            defaultValue={state.values.competence}
            name="competence"
            type="month"
          />
          <span className="text-xs font-normal text-text-muted">
            Futuramente ela poderá ser identificada a partir do conteúdo dos documentos.
          </span>
          {state.fieldErrors.competence?.map((error) => (
            <span className="text-sm text-rose-300" key={error}>
              {error}
            </span>
          ))}
        </label>
        <label className={`${labelClassName} grid gap-1.5 sm:col-span-2`}>
          Observação <span className="font-normal text-text-muted">(opcional)</span>
          <textarea
            className={`${fieldClassName} min-h-20 py-2`}
            defaultValue={state.values.notes}
            maxLength={2000}
            name="notes"
          />
        </label>
      </div>

      <div className="ui-form-section grid gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Documentos</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Até {IMPORT_ENGINE_MAX_DOCUMENTS} PDFs de no máximo{' '}
            {formatBytes(IMPORT_ENGINE_MAX_PDF_BYTES)} cada.
          </p>
        </div>
        <div
          className="grid min-h-24 place-items-center rounded-md border border-dashed border-selection-strong bg-selection p-4 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <label className="cursor-pointer text-sm font-semibold text-interactive">
            Selecione PDFs ou arraste-os para esta área
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              multiple
              onChange={onFiles}
              type="file"
            />
          </label>
        </div>
        {state.fieldErrors.documents?.map((error) => (
          <p className="text-sm text-rose-300" key={error}>
            {error}
          </p>
        ))}
        {selectionNotice ? (
          <p className="text-sm text-amber-300" role="status">
            {selectionNotice}
          </p>
        ) : null}
        <ul className="grid gap-3">
          {selection.map((item, index) => (
            <li
              className="grid gap-3 border-t border-border py-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto] sm:items-center"
              key={item.id}
            >
              <AdminImportFileInput item={item} rehydrationToken={state} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{item.file.name}</p>
                <p className="text-xs text-text-muted">{formatBytes(item.file.size)}</p>
                {state.fieldErrors[`document.${index}`]?.map((error) => (
                  <p className="text-xs text-rose-300" key={error}>
                    {error}
                  </p>
                ))}
              </div>
              <select
                aria-label={`Papel de ${item.file.name}`}
                className={fieldClassName}
                name={importDocumentRoleFieldName(item.id)}
                onChange={(event) =>
                  setSelection((current) =>
                    updateImportFileRole(
                      current,
                      index,
                      event.target.value as SelectedImportFile['role'],
                    ),
                  )
                }
                value={item.role}
              >
                {IMPORT_DOCUMENT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <button
                className={buttonClassName({ compact: true, variant: 'ghost' })}
                onClick={() => removeFile(index)}
                type="button"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state.status === 'duplicate' ? (
        <div className="rounded-2xl border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-bold">{state.message}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.duplicates.map((duplicate) => (
              <li key={`${duplicate.batchId}-${duplicate.contentSha256}`}>
                {duplicate.originalFileName} — {duplicate.batchTitle} ({duplicate.batchStatus})
              </li>
            ))}
          </ul>
          <label className="mt-4 flex min-h-11 items-center gap-3">
            <input name="acknowledgeDuplicates" type="checkbox" value="true" />
            Confirmo que desejo reutilizar estes documentos em um novo dossiê.
          </label>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div
          className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200"
          role="alert"
        >
          {state.message}
          {state.correlationId ? ` Referência: ${state.correlationId}` : ''}
        </div>
      ) : null}
      {state.status === 'success' ? (
        <div
          className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          role="status"
        >
          {state.message}{' '}
          <a className="font-bold underline" href={`/admin/imports/${state.batchId}`}>
            Abrir dossiê
          </a>
        </div>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
