'use client';

import type {
  AdministrativeProductSpecsModel,
  AdministrativeSpecField,
  AdministrativeSpecSubmission,
} from '@compra-car/contracts';
import { useMemo, useState, useTransition } from 'react';
import { AdminSpecDropdown } from './admin-spec-dropdown';

import {
  countAdministrativeSpecs,
  countAdministrativeSpecChanges,
  filterAdministrativeSpecGroups,
  hasAdministrativeSpecChanges,
  toAdministrativeSpecSubmissions,
} from '@/application/admin/admin-product-specs-state';
interface AdminProductSpecsEditorProps {
  readonly initialModel: AdministrativeProductSpecsModel;
  readonly saveAction: (
    submissions: readonly AdministrativeSpecSubmission[],
  ) => Promise<
    | { readonly ok: true; readonly model: AdministrativeProductSpecsModel }
    | { readonly ok: false; readonly message: string }
  >;
}

function formatNumericForDisplay(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  // Accept pt-BR grouped input or a compact integer/decimal entered by the user.
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) return value;
  const normalized = /^-?\d+\.\d{1,2}$/.test(value) ? value.replace('.', ',') : value;
  if (!/^-?\d+(?:,\d{1,2})?$/.test(normalized)) return raw;
  const [integer, decimal] = normalized.split(',');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimal === undefined ? grouped : grouped + ',' + decimal;
}

function replaceField(
  model: AdministrativeProductSpecsModel,
  target: AdministrativeSpecField,
  replacement: AdministrativeSpecField,
): AdministrativeProductSpecsModel {
  return {
    ...model,
    groups: model.groups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => (field === target ? replacement : field)),
    })),
  };
}

export function AdminProductSpecsEditor({
  initialModel: loadedModel,
  saveAction,
}: AdminProductSpecsEditorProps) {
  const [baseline, setBaseline] = useState(loadedModel);
  const [model, setModel] = useState(loadedModel);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const groups = useMemo(() => filterAdministrativeSpecGroups(model, query), [model, query]);
  const counts = countAdministrativeSpecs(model);
  const changed = hasAdministrativeSpecChanges(baseline, model);
  const changeCount = countAdministrativeSpecChanges(baseline, model);

  function update(field: AdministrativeSpecField, replacement: AdministrativeSpecField) {
    setModel((current) => replaceField(current, field, replacement));
    setFeedback(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveAction(toAdministrativeSpecSubmissions(model));
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.message });
        return;
      }
      setBaseline(result.model);
      setModel(result.model);
      setFeedback({ kind: 'success', message: 'Alterações salvas com sucesso.' });
    });
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#D6DEE3] bg-white">
      <div className="sticky top-0 z-30 border-b border-[#D6DEE3] bg-white px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-md">
            <img src="/carboot/search.svg" alt="" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 object-contain"/>
            <span className="sr-only">Buscar especificações</span>
            <input
              className="ui-field min-h-9 !pl-10 text-[0.8125rem]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar especificações..."
              type="search"
              value={query}
            />
          </label>
          <p className="whitespace-nowrap text-xs text-text-muted">
            {counts.filled} / {counts.total} preenchidos
          </p>
          <p className="whitespace-nowrap text-xs text-status-warning">
            {changed
              ? `${changeCount} ${changeCount === 1 ? 'alteração não salva' : 'alterações não salvas'}`
              : 'Nenhuma alteração pendente'}
          </p>
          <button
            className="cc-btn cc-btn--m cc-btn--secondary"
            disabled={!changed || pending}
            onClick={() => {
              setModel(baseline);
              setFeedback(null);
            }}
            type="button"
          >
            Descartar
          </button>
          <button
            className="cc-btn cc-btn--m cc-btn--primary"
            disabled={!changed || pending}
            onClick={save}
            type="button"
          >
            {pending ? 'SALVANDO…' : 'SALVAR'}
          </button>
        </div>
        {feedback ? (
          <p
            className={`mt-1 text-xs ${feedback.kind === 'error' ? 'text-status-error' : 'text-status-success'}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div data-spec-scroll-frame className="max-h-[calc(100dvh-17rem)] overflow-auto">
        <div className="sticky top-0 z-20 grid h-11 grid-cols-[minmax(15rem,1fr)_minmax(15rem,24rem)_14rem] items-center gap-3 bg-[#DCE8ED] px-4 text-xs font-semibold uppercase text-[#1A1D21]"><span>Especificação</span><span className="text-center">Valor</span><span className="text-center">Unidade</span></div>
        {groups.map((group) => {
          const groupCounts = counts.byGroup[group.name]!;
          return (
            <details
              className="border-b border-[#D6DEE3] bg-white"
              key={group.name}
              open={query ? true : undefined}
            >
              <summary className="sticky top-11 z-10 flex h-9 cursor-pointer items-center justify-between gap-3 bg-[#EAF1F4] px-4 text-[0.8125rem] font-semibold text-text-primary">
                {group.name}
                <span className="text-xs font-normal text-text-muted">
                  {groupCounts.filled} / {groupCounts.total}
                </span>
              </summary>
              <div className="divide-y divide-border border-t border-border">
                {group.fields.map((field) => {
                  return (
                    <div
                      className={`px-3 py-1.5 ${group.fields.indexOf(field) % 2 ? 'bg-[#F8FAFB]' : 'bg-white'}`}
                      key={field.kind === 'scale' ? field.key : field.specId}
                    >
                      <div className="grid grid-cols-[minmax(15rem,1fr)_minmax(15rem,24rem)_14rem] items-center gap-2 md:min-h-7">
                        <div>
                          <p className="text-[0.8125rem] font-medium leading-4 text-text-primary">
                            {field.label}
                          </p>
                        </div>
                        <div className="contents">
                          {field.kind === 'numeric' ? (
                            <input aria-label={field.label} className="min-h-8 min-w-0 rounded-md border border-[#D6DEE3] bg-white px-2 text-right text-[0.8125rem] tabular-nums focus:border-[#9ABCC8] focus:outline-none" inputMode="decimal" value={field.value} onChange={(event) => update(field, { ...field, value: event.target.value })} onBlur={(event) => update(field, { ...field, value: formatNumericForDisplay(event.target.value) })} />
                          ) : field.kind === 'binary' ? (
                            <AdminSpecDropdown label={field.label}
                              value={field.present === null ? 'unknown' : field.present ? 'present' : 'absent'}
                              options={[{ value: 'unknown', label: 'Não informado' }, { value: 'present', label: 'Presente' }, { value: 'absent', label: 'Ausente' }]}
                              onChange={(v) => update(field, { ...field, present: v === 'unknown' ? null : v === 'present' })}/>
                          ) : (
                            <AdminSpecDropdown label={field.label} value={field.selectedSpecId ?? ''}
                              options={[{ value: '', label: 'Não informado' }, ...field.options.map((option) => ({ value: option.specId, label: option.label }))]}
                              onChange={(v) => update(field, { ...field, selectedSpecId: v || null })}/>
                          )}
                          <span className="text-center text-xs text-[#61747B]">{field.kind === 'numeric' ? field.unit : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
        {groups.length === 0 ? (
          <p className="border border-border p-5 text-center text-sm text-text-muted">
            Nenhuma especificação corresponde à busca.
          </p>
        ) : null}
      </div>
    </section>
  );
}
