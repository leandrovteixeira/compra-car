'use client';

import type {
  AdministrativeProductSpecsModel,
  AdministrativeSpecField,
  AdministrativeSpecSubmission,
} from '@compra-car/contracts';
import { useMemo, useState, useTransition } from 'react';

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
    <section className="min-w-0">
      <div className="admin-specs-toolbar border-b border-border bg-surface py-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="min-w-0 flex-1 lg:max-w-md">
            <span className="sr-only">Buscar especificações</span>
            <input
              className="ui-field min-h-9 text-[0.8125rem]"
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
            className="ui-button ui-button--ghost ui-button--compact"
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
            className="ui-button ui-button--primary ui-button--compact"
            disabled={!changed || pending}
            onClick={save}
            type="button"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
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

      <div className="mt-3 space-y-2">
        {groups.map((group) => {
          const groupCounts = counts.byGroup[group.name]!;
          let previousEquipment = '';
          return (
            <details
              className="overflow-hidden border border-border bg-surface"
              key={group.name}
              open={query ? true : undefined}
            >
              <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-3 bg-surface-muted px-3 py-1 text-[0.8125rem] font-semibold text-text-primary">
                {group.name}
                <span className="text-xs font-normal text-text-muted">
                  {groupCounts.filled} / {groupCounts.total}
                </span>
              </summary>
              <div className="divide-y divide-border border-t border-border">
                {group.fields.map((field) => {
                  const showEquipment = field.equipmentGroup !== previousEquipment;
                  previousEquipment = field.equipmentGroup;
                  const empty =
                    field.kind === 'binary'
                      ? field.present === null
                      : field.kind === 'numeric'
                        ? field.value === ''
                        : !field.selectedSpecId;
                  return (
                    <div
                      className={`px-3 py-2 ${empty ? 'bg-amber-950/10' : ''}`}
                      key={field.kind === 'scale' ? field.key : field.specId}
                    >
                      {showEquipment ? (
                        <h3 className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                          {field.equipmentGroup}
                        </h3>
                      ) : null}
                      <div className="grid gap-2 md:min-h-7 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:gap-4">
                        <div>
                          <p className="text-[0.8125rem] font-medium leading-4 text-text-primary">
                            {field.label}
                          </p>
                          {field.specSet !== field.label ? (
                            <p className="text-[0.6875rem] leading-3 text-text-muted">
                              {field.specSet}
                            </p>
                          ) : null}
                          <p className="text-[0.625rem] leading-3 text-text-muted">
                            {field.kind === 'scale'
                              ? field.options.map((o) => o.code).join(' · ')
                              : field.code}
                          </p>
                        </div>
                        {field.kind === 'numeric' ? (
                          <div className="flex w-full items-center gap-2 md:justify-self-end">
                            <input
                              aria-label={field.label}
                              className="ui-field min-h-8 min-w-0 flex-1 text-right text-xs tabular-nums"
                              inputMode="decimal"
                              onChange={(event) =>
                                update(field, { ...field, value: event.target.value })
                              }
                              value={field.value}
                            />
                            {field.supportsTorqueUnit ? (
                              <select
                                aria-label={`Unidade de ${field.label}`}
                                className="ui-field min-h-8 w-16 shrink-0 text-xs"
                                onChange={(event) =>
                                  update(field, { ...field, inputUnit: event.target.value })
                                }
                                value={field.inputUnit ?? 'Nm'}
                              >
                                <option value="Nm">Nm</option>
                                <option value="kgfm">kgfm</option>
                              </select>
                            ) : (
                              <span className="w-16 shrink-0 text-xs text-text-muted">
                                {field.unit}
                              </span>
                            )}
                          </div>
                        ) : field.kind === 'binary' ? (
                          <div
                            aria-label={`Estado de ${field.label}`}
                            className="flex w-full justify-end md:justify-self-end"
                            role="radiogroup"
                          >
                            {(
                              [
                                { value: null, glyph: '-', label: 'Não informado' },
                                { value: true, glyph: '✓', label: 'Possui' },
                                { value: false, glyph: '□', label: 'Não possui' },
                              ] as const
                            ).map((option) => (
                              <button
                                aria-checked={field.present === option.value}
                                aria-label={`${field.label}: ${option.label}`}
                                className={`ui-button ui-button--compact min-w-8 border-border px-2 text-sm first:rounded-l-md last:rounded-r-md ${
                                  field.present === option.value
                                    ? 'bg-selection-strong font-bold text-text-primary'
                                    : 'bg-surface text-text-secondary'
                                }`}
                                key={option.label}
                                onClick={() => update(field, { ...field, present: option.value })}
                                role="radio"
                                title={option.label}
                                type="button"
                              >
                                {option.glyph}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <select
                            aria-label={field.label}
                            className="ui-field min-h-8 w-full text-xs md:justify-self-end"
                            onChange={(event) =>
                              update(field, {
                                ...field,
                                selectedSpecId: event.target.value || null,
                              })
                            }
                            value={field.selectedSpecId ?? ''}
                          >
                            <option value="">-</option>
                            {field.options.map((option) => (
                              <option key={option.specId} value={option.specId}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
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
