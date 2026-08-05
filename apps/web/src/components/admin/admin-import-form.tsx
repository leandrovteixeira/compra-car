'use client';

import type { ChangeEvent, DragEvent } from 'react';
import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ImportBatchActionStateDto } from '@compra-car/contracts';

import {
  IMPORT_DOCUMENT_ROLES,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_MAX_PDF_BYTES,
} from '@compra-car/core';

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
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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
  const [files, setFiles] = useState<readonly File[]>([]);
  const [roles, setRoles] = useState<readonly string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const replaceFiles = (next: readonly File[]) => {
    const limited = next.slice(0, IMPORT_ENGINE_MAX_DOCUMENTS);
    setFiles(limited);
    setRoles((current) =>
      limited.map((_, index) => current[index] ?? (index === 0 ? 'primary' : 'other')),
    );
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
  const removeFile = (index: number) =>
    replaceFiles(files.filter((_, candidate) => candidate !== index));

  return (
    <form action={formAction} className="grid gap-6" encType="multipart/form-data">
      <input name="idempotencyKey" type="hidden" value={state.values.idempotencyKey} />
      <div className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-200 md:col-span-2">
          Título do dossiê
          <input
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white"
            defaultValue={state.values.title}
            maxLength={160}
            name="title"
            placeholder="Jeep — Julho/2026"
            required
          />
          {state.fieldErrors.title?.map((error) => (
            <span className="text-sm text-rose-300" key={error}>
              {error}
            </span>
          ))}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Plugin
          <input
            className="min-h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-slate-400"
            disabled
            value="Cartas Comerciais"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Competência
          <input
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white"
            defaultValue={state.values.competence}
            name="competence"
            required
            type="month"
          />
          {state.fieldErrors.competence?.map((error) => (
            <span className="text-sm text-rose-300" key={error}>
              {error}
            </span>
          ))}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200 md:col-span-2">
          Observação <span className="font-normal text-slate-500">(opcional)</span>
          <textarea
            className="min-h-24 rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            defaultValue={state.values.notes}
            maxLength={2000}
            name="notes"
          />
        </label>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div>
          <h2 className="text-lg font-bold text-white">Documentos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Até {IMPORT_ENGINE_MAX_DOCUMENTS} PDFs de no máximo{' '}
            {formatBytes(IMPORT_ENGINE_MAX_PDF_BYTES)} cada.
          </p>
        </div>
        <div
          className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-sky-700 bg-sky-950/20 p-5 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <label className="cursor-pointer text-sm font-semibold text-sky-200">
            Selecione PDFs ou arraste-os para esta área
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
