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
      <div className="sticky top-[4.25rem] z-30 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar especificações</span>
            <input
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar especificações..."
              type="search"
              value={query}
            />
          </label>
          <p className="text-sm text-slate-400">
            {counts.filled} / {counts.total} preenchidos
          </p>
          <p className="text-sm text-amber-300">
            {changed
              ? `${changeCount} ${changeCount === 1 ? 'alteração não salva' : 'alterações não salvas'}`
              : 'Nenhuma alteração pendente'}
          </p>
          <button
            className="min-h-11 rounded-xl border border-slate-700 px-4 font-semibold text-slate-200 disabled:opacity-50"
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
            className="min-h-11 rounded-xl bg-sky-500 px-4 font-semibold text-slate-950 disabled:opacity-50"
            disabled={!changed || pending}
            onClick={save}
            type="button"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
        {feedback ? (
          <p
            className={`mt-3 text-sm ${feedback.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {groups.map((group) => {
          const groupCounts = counts.byGroup[group.name]!;
          let previousEquipment = '';
          return (
            <details
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
              key={group.name}
              open={query ? true : undefined}
            >
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-5 py-3 font-bold text-slate-100">
                {group.name}
                <span className="text-xs font-normal text-slate-400">
                  {groupCounts.filled} / {groupCounts.total}
                </span>
              </summary>
              <div className="divide-y divide-slate-800 border-t border-slate-800">
                {group.fields.map((field) => {
                  const showEquipment = field.equipmentGroup !== previousEquipment;
                  previousEquipment = field.equipmentGroup;
                  const empty =
                    field.kind !== 'binary' &&
                    (field.kind === 'numeric' ? field.value === '' : !field.selectedSpecId);
                  return (
                    <div
                      className={`px-5 py-4 ${empty ? 'bg-amber-950/10' : ''}`}
                      key={field.kind === 'scale' ? field.key : field.specId}
                    >
                      {showEquipment ? (
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-sky-300">
                          {field.equipmentGroup}
                        </h3>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)] md:items-center">
                        <div>
                          <p className="font-medium text-slate-100">{field.label}</p>
                          {field.specSet !== field.label ? (
                            <p className="text-xs text-slate-500">{field.specSet}</p>
                          ) : null}
                          <p className="text-[0.6875rem] text-slate-600">
                            {field.kind === 'scale'
                              ? field.options.map((o) => o.code).join(' · ')
                              : field.code}
                          </p>
                        </div>
                        {field.kind === 'numeric' ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-right tabular-nums"
                              inputMode="decimal"
                              onChange={(event) =>
                                update(field, { ...field, value: event.target.value })
                              }
                              value={field.value}
                            />
                            {field.supportsTorqueUnit ? (
                              <select
                                aria-label={`Unidade de ${field.label}`}
                                className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3"
                                onChange={(event) =>
                                  update(field, { ...field, inputUnit: event.target.value })
                                }
                                value={field.inputUnit ?? 'Nm'}
                              >
                                <option value="Nm">Nm</option>
                                <option value="kgfm">kgfm</option>
                              </select>
                            ) : (
                              <span className="w-16 text-sm text-slate-400">{field.unit}</span>
                            )}
                          </div>
                        ) : field.kind === 'binary' ? (
                          <label className="flex min-h-11 cursor-pointer items-center justify-end gap-3">
                            <input
                              checked={field.present}
                              className="size-5 accent-sky-500"
                              onChange={(event) =>
                                update(field, { ...field, present: event.target.checked })
                              }
                              type="checkbox"
                            />
                            <span className="sr-only">{field.label}</span>
                          </label>
                        ) : (
                          <select
                            className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"
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
          <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
            Nenhuma especificação corresponde à busca.
          </p>
        ) : null}
      </div>
    </section>
  );
}
