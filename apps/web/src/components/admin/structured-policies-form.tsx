'use client';

import { useRef, useState, type FormEvent } from 'react';
import { buttonClassName, fieldClassName } from '@compra-car/ui';
import { validateStructuredPolicies } from '@/app/admin/imports/structured-policies/actions';
import {
  checkStructuredPoliciesFile,
  XLSX_MIME,
  type StructuredPoliciesResult,
} from '@/application/admin/structured-policies';
import { StructuredPoliciesPreview } from './structured-policies-preview';

export function StructuredPoliciesForm() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<StructuredPoliciesResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || loading) return;
    setLoading(true);
    setResult(null);
    const data = new FormData();
    data.set('file', file);
    try {
      setResult(await validateStructuredPolicies(data));
    } catch {
      setResult({
        status: 'TECHNICAL_ERROR',
        message: 'Não foi possível validar o arquivo. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <form
        onSubmit={submit}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
        aria-busy={loading}
      >
        <label htmlFor="structured-workbook" className="block text-sm font-semibold">
          Arquivo Excel
        </label>
        <p id="structured-format" className="text-sm text-text-secondary">
          CommercialImportContract/1 · Somente .xlsx · Até 25 MiB. Arquivo usado apenas para
          validação, sem armazenamento.
        </p>
        <input
          ref={input}
          id="structured-workbook"
          name="file"
          type="file"
          accept={`.xlsx,${XLSX_MIME}`}
          disabled={loading}
          aria-describedby="structured-format"
          className={fieldClassName}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            const rejected = selected ? checkStructuredPoliciesFile(selected) : null;
            setFile(rejected ? null : selected);
            setResult(rejected);
          }}
        />
        {file && <p className="break-all text-sm">Selecionado: {file.name}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!file || loading}
            className={buttonClassName({ size: 'action', variant: 'interactive' })}
          >
            {loading ? 'Validando…' : 'Validar estrutura'}
          </button>
          <button
            type="button"
            disabled={loading || (!file && !result)}
            className={buttonClassName({ size: 'action', variant: 'secondary' })}
            onClick={() => {
              setFile(null);
              setResult(null);
              if (input.current) input.current.value = '';
            }}
          >
            Remover arquivo
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {loading ? (
          <p role="status">Validando estrutura do arquivo…</p>
        ) : (
          result && <StructuredPoliciesPreview result={result} />
        )}
      </div>
    </div>
  );
}
