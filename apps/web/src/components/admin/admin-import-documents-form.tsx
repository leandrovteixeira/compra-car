'use client';

import type { ChangeEvent, DragEvent } from 'react';
import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ImportDocumentsActionStateDto } from '@compra-car/contracts';
import { IMPORT_DOCUMENT_ROLES, IMPORT_ENGINE_MAX_PDF_BYTES } from '@compra-car/core';

const ROLE_LABELS: Readonly<Record<string, string>> = {
  primary: 'Carta principal',
  errata: 'Errata',
  complement: 'Complemento',
  financial_appendix: 'Anexo financeiro',
  trade_in_appendix: 'Anexo de Trade-In',
  technical_appendix: 'Anexo tÃ©cnico',
  other: 'Outro',
};

function formatBytes(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1024 / 1024)} MB`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-11 rounded-xl bg-sky-500 px-5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Enviando documentosâ€¦' : 'Adicionar documentos'}
    </button>
  );
}

export function AdminImportDocumentsForm({
  action,
  initialState,
  maximumFiles,
}: {
  readonly action: (
    state: ImportDocumentsActionStateDto,
    formData: FormData,
  ) => Promise<ImportDocumentsActionStateDto>;
  readonly initialState: ImportDocumentsActionStateDto;
  readonly maximumFiles: number;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [files, setFiles] = useState<readonly File[]>([]);
  const [roles, setRoles] = useState<readonly string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const replaceFiles = (next: readonly File[]) => {
    const limited = next.slice(0, maximumFiles);
    setFiles(limited);
    setRoles((current) => limited.map((_, index) => current[index] ?? 'other'));
    if (inputRef.current && typeof DataTransfer !== 'undefined') {
      const transfer = new DataTransfer();
      limited.forEach((file) => transfer.items.add(file));
      inputRef.current.files = transfer.files;
    }
  };
  const onFiles = (event: ChangeEvent<HTMLInputElement>) =>
    replaceFiles(Array.from(event.target.files ?? []));
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    replaceFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <form action={formAction} className="grid gap-5" encType="multipart/form-data">
      <input name="batchId" type="hidden" value={state.values.batchId} />
      <input name="expectedLockVersion" type="hidden" value={state.values.expectedLockVersion} />
      <input name="operationId" type="hidden" value={state.values.operationId} />
      <div
        className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-sky-700 bg-sky-950/20 p-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <label className="cursor-pointer text-sm font-semibold text-sky-200">
          Selecione PDFs ou arraste-os para esta Ã¡rea
          <span className="mt-1 block font-normal text-slate-400">
            AtÃ© {maximumFiles} arquivo(s), {formatBytes(IMPORT_ENGINE_MAX_PDF_BYTES)} por PDF.
          </span>
          <input
            ref={inputRef}
            accept="application/pdf,.pdf"
            className="sr-only"
            multiple
            name="documents"
            onChange={onFiles}
            required
            type="file"
          />
        </label>
      </div>
      {state.fieldErrors.documents?.map((error) => (
        <p className="text-sm text-rose-300" key={error}>
          {error}
        </p>
      ))}
      <ul className="grid gap-3">
        {files.map((file, index) => (
          <li
            className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto] sm:items-center"
            key={`${file.name}-${file.size}-${index}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              {state.fieldErrors[`document.${index}`]?.map((error) => (
                <p className="text-xs text-rose-300" key={error}>
                  {error}
                </p>
              ))}
            </div>
            <select
              aria-label={`Papel de ${file.name}`}
              className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
              name="documentRoles"
              onChange={(event) =>
                setRoles((current) =>
                  current.map((role, candidate) =>
                    candidate === index ? event.target.value : role,
                  ),
                )
              }
              value={roles[index] ?? 'other'}
            >
              {IMPORT_DOCUMENT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <button
              className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm text-slate-200"
              onClick={() => replaceFiles(files.filter((_, candidate) => candidate !== index))}
              type="button"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {state.status === 'duplicate' ? (
        <div className="rounded-2xl border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-bold">{state.message}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.duplicates.map((duplicate) => (
              <li key={`${duplicate.batchId}-${duplicate.contentSha256}`}>
                {duplicate.originalFileName} â€” {duplicate.batchTitle} ({duplicate.batchStatus})
              </li>
            ))}
          </ul>
          <label className="mt-4 flex min-h-11 items-center gap-3">
            <input name="acknowledgeDuplicates" type="checkbox" value="true" />
            Confirmo que desejo reutilizar estes documentos neste dossiÃª.
          </label>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div
          className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200"
          role="alert"
        >
          {state.message}
          {state.correlationId ? ` ReferÃªncia: ${state.correlationId}` : ''}
        </div>
      ) : null}
      {state.status === 'success' ? (
        <div
          className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          role="status"
        >
          {state.message}{' '}
          <a className="font-bold underline" href={`/admin/imports/${state.batchId}`}>
            Voltar ao dossiÃª
          </a>
        </div>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
