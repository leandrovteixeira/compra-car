'use client';

import type { CatalogVehicleDto } from '@compra-car/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getCatalogVehicles } from '@/app/actions/catalog';
import { formatProductionModelYears } from '@/application/catalog/vehicle-presentation';
import {
  EMPTY_VEHICLE_SELECTION,
  MAX_SELECTED_VEHICLES,
  addSelectedVehicle,
  canAddSelectedVehicle,
  findAvailableVehicles,
  removeSelectedVehicle,
} from '@/application/catalog/vehicle-selection-state';

const EMPTY_VEHICLES: readonly CatalogVehicleDto[] = [];

function vehicleIdentity(vehicle: CatalogVehicleDto): string {
  return `${vehicle.brand} ${vehicle.model} · ${vehicle.version} · ${formatProductionModelYears(
    vehicle.productionYear,
    vehicle.modelYear,
  )}`;
}

export function VehicleSelection() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState(EMPTY_VEHICLES);
  const [selection, setSelection] = useState(EMPTY_VEHICLE_SELECTION);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCatalogVehicles().then((result) => {
      if (!active) return;
      if (result.ok) setCatalog(result.data);
      else setError(result.error.message);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(
    () => findAvailableVehicles(catalog, query, selection.selectedVehicles),
    [catalog, query, selection.selectedVehicles],
  );
  const limitReached = selection.selectedVehicles.length >= MAX_SELECTED_VEHICLES;
  const canCompare = selection.selectedVehicles.length >= 2;

  function selectVehicle(vehicle: CatalogVehicleDto) {
    if (!canAddSelectedVehicle(selection, vehicle)) return;
    setSelection((current) => addSelectedVehicle(current, vehicle));
    setQuery('');
    setError(null);
    searchRef.current?.focus();
  }

  function removeVehicle(id: string) {
    setSelection((current) => removeSelectedVehicle(current, id));
  }

  function goToComparison() {
    if (!canCompare) return;
    const ids = selection.selectedVehicles.map((vehicle) => vehicle.id).join(',');
    router.push(`/comparar?vehicles=${ids}`);
  }

  return (
    <main className="min-h-[calc(100dvh-var(--app-topbar-height))] bg-canvas px-3 py-5 sm:px-5 sm:py-7">
      <section className="mx-auto w-full max-w-3xl">
        <header className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-interactive">
            Compra Car
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
            Escolha os veículos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Busque e selecione pelo menos dois veículos. O primeiro será o principal.
          </p>
        </header>

        <section aria-labelledby="search-title" className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary" id="search-title">
                Adicionar veículo
              </h2>
              <p className="text-xs text-text-muted">Marca, modelo ou versão</p>
            </div>
            <span className="text-xs tabular-nums text-text-muted">
              {selection.selectedVehicles.length}/{MAX_SELECTED_VEHICLES}
            </span>
          </div>

          <div className="relative mt-2">
            <input
              aria-controls="vehicle-search-results"
              autoComplete="off"
              className="ui-field min-h-11 pr-12 text-base"
              disabled={loading || limitReached}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar veículo..."
              ref={searchRef}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Limpar busca"
                className="absolute right-0 top-0 grid min-h-11 min-w-11 place-items-center text-lg text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>

          <div
            aria-live="polite"
            className="mt-2 overflow-hidden rounded-md border border-border bg-surface"
            id="vehicle-search-results"
          >
            {loading ? (
              <p className="px-3 py-3 text-sm text-text-muted">Carregando catálogo…</p>
            ) : error ? (
              <p className="px-3 py-3 text-sm text-status-error" role="alert">
                {error}
              </p>
            ) : limitReached ? (
              <p className="px-3 py-3 text-sm text-text-muted">
                Limite de {MAX_SELECTED_VEHICLES} veículos atingido. Remova um para escolher outro.
              </p>
            ) : !query.trim() ? (
              <p className="px-3 py-3 text-sm text-text-muted">
                Busque por marca, modelo ou versão.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-text-muted">Nenhum veículo encontrado.</p>
            ) : (
              <ul className="max-h-[min(42dvh,22rem)] divide-y divide-border overflow-y-auto overscroll-contain">
                {results.map((vehicle) => (
                  <li key={vehicle.id}>
                    <button
                      className="min-h-14 w-full px-3 py-2.5 text-left transition hover:bg-selection focus-visible:bg-selection focus-visible:outline-2 focus-visible:outline-focus"
                      onClick={() => selectVehicle(vehicle)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold text-text-primary">
                        {vehicle.model} · {vehicle.version}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {vehicle.brand} ·{' '}
                        {formatProductionModelYears(vehicle.productionYear, vehicle.modelYear)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="selected-title" className="mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-text-primary" id="selected-title">
              Selecionados
            </h2>
            <span className="text-xs text-text-muted">Ordem da comparação</span>
          </div>

          {selection.selectedVehicles.length === 0 ? (
            <p className="border-b border-border px-2 py-4 text-sm text-text-muted">
              Nenhum veículo selecionado.
            </p>
          ) : (
            <ol className="divide-y divide-border border-b border-border">
              {selection.selectedVehicles.map((vehicle, index) => {
                const identity = vehicleIdentity(vehicle);
                return (
                  <li
                    className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto_2.75rem] items-center gap-2 py-2"
                    key={vehicle.id}
                  >
                    <span className="text-center text-xs font-semibold tabular-nums text-text-muted">
                      {index + 1}
                    </span>
                    <p className="min-w-0 text-sm font-medium text-text-primary" title={identity}>
                      <span className="sm:hidden">
                        {vehicle.brand} {vehicle.model} · {vehicle.version}
                      </span>
                      <span className="hidden sm:inline">{identity}</span>
                      <span className="block text-xs font-normal text-text-muted sm:hidden">
                        {formatProductionModelYears(vehicle.productionYear, vehicle.modelYear)}
                      </span>
                    </p>
                    {index === 0 ? (
                      <span className="ui-badge border-selection-strong bg-selection text-text-primary">
                        Principal
                      </span>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                    <button
                      aria-label={`Remover ${identity}`}
                      className="col-start-4 row-start-1 grid min-h-11 min-w-11 place-items-center text-lg text-text-muted hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus"
                      onClick={() => removeVehicle(vehicle.id)}
                      title="Remover"
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="mt-5 flex flex-col items-start justify-between gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
          <p className="text-xs text-text-muted">
            {canCompare
              ? `${selection.selectedVehicles.length} veículos prontos para comparar.`
              : 'Selecione pelo menos 2 veículos.'}
          </p>
          <button
            className="ui-button ui-button--interactive ui-button--commit w-full sm:w-auto"
            disabled={!canCompare}
            onClick={goToComparison}
            type="button"
          >
            Comparar veículos
          </button>
        </div>
      </section>
    </main>
  );
}
