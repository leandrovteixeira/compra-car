'use client';

import type { CatalogOptionDto, CatalogVehicleDto } from '@compra-car/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getBrands, getModels, getVehicles } from '@/app/actions/catalog';
import {
  formatCompactVehicleName,
  formatVehicleVersionOption,
} from '@/application/catalog/vehicle-presentation';
import {
  EMPTY_VEHICLE_SELECTION,
  addSelectedVehicle,
  canAddSelectedVehicle,
  changeSelectedBrand,
  changeSelectedModel,
  changeSelectedVersion,
} from '@/application/catalog/vehicle-selection-state';
import { CatalogCombobox, type CatalogComboboxOption } from '@/components/catalog-combobox';

const EMPTY_OPTIONS: readonly CatalogOptionDto[] = [];
const EMPTY_VEHICLES: readonly CatalogVehicleDto[] = [];

export function VehicleSelection() {
  const router = useRouter();
  const brandTriggerRef = useRef<HTMLButtonElement>(null);
  const [brands, setBrands] = useState(EMPTY_OPTIONS);
  const [models, setModels] = useState(EMPTY_OPTIONS);
  const [vehicles, setVehicles] = useState(EMPTY_VEHICLES);
  const [selection, setSelection] = useState(EMPTY_VEHICLE_SELECTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getBrands().then((result) => {
      if (!active) return;
      if (result.ok) setBrands(result.data);
      else setError(result.error.message);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const selectedIds = useMemo(
    () => new Set(selection.selectedVehicles.map((vehicle) => vehicle.id)),
    [selection.selectedVehicles],
  );

  const vehicleOptions = useMemo<readonly CatalogComboboxOption[]>(
    () =>
      vehicles.map((vehicle) => ({
        value: vehicle.id,
        label: formatVehicleVersionOption(vehicle),
        disabled: selectedIds.has(vehicle.id),
      })),
    [selectedIds, vehicles],
  );

  async function selectBrand(nextBrand: string) {
    setSelection((current) => changeSelectedBrand(current, nextBrand));
    setModels(EMPTY_OPTIONS);
    setVehicles(EMPTY_VEHICLES);
    setError(null);
    if (!nextBrand) return;

    setLoading(true);
    const result = await getModels(nextBrand);
    if (result.ok) setModels(result.data);
    else setError(result.error.message);
    setLoading(false);
  }

  async function selectModel(nextModel: string) {
    setSelection((current) => changeSelectedModel(current, nextModel));
    setVehicles(EMPTY_VEHICLES);
    setError(null);
    if (!selection.brand || !nextModel) return;

    setLoading(true);
    const result = await getVehicles(selection.brand, nextModel);
    if (result.ok) setVehicles(result.data);
    else setError(result.error.message);
    setLoading(false);
  }

  function selectVersion(nextVehicleId: string) {
    setSelection((current) => changeSelectedVersion(current, nextVehicleId));
  }

  function handleAddVehicle() {
    if (!canAddSelectedVehicle(selection, vehicles)) return;

    setSelection((current) => addSelectedVehicle(current, vehicles));
    setModels(EMPTY_OPTIONS);
    setVehicles(EMPTY_VEHICLES);
    setError(null);
    brandTriggerRef.current?.focus();
  }

  function removeVehicle(id: string) {
    setSelection((current) => ({
      ...current,
      selectedVehicles: current.selectedVehicles.filter((vehicle) => vehicle.id !== id),
    }));
  }

  function goToComparison() {
    if (selection.selectedVehicles.length < 2) return;
    const ids = selection.selectedVehicles.map((vehicle) => vehicle.id).join(',');
    router.push(`/comparar?vehicles=${ids}`);
  }

  const canAdd = canAddSelectedVehicle(selection, vehicles);

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">
          Compra Car
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Escolha os veículos
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
          Selecione pelo menos dois veículos. O primeiro será o veículo principal da comparação.
        </p>

        <div className="mt-8 grid min-w-0 gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/40 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:p-7">
          <CatalogCombobox
            disabled={loading && brands.length === 0}
            label="Marca"
            onChange={(value) => void selectBrand(value)}
            options={brands}
            ref={brandTriggerRef}
            value={selection.brand}
          />

          <CatalogCombobox
            disabled={!selection.brand || loading}
            label="Modelo"
            onChange={(value) => void selectModel(value)}
            options={models}
            value={selection.model}
          />

          <CatalogCombobox
            disabled={!selection.model || loading}
            label="Versão"
            onChange={selectVersion}
            options={vehicleOptions}
            value={selection.vehicleId}
          />

          <button
            className="min-h-12 w-full self-end rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 sm:w-auto"
            disabled={!canAdd}
            onClick={handleAddVehicle}
            type="button"
          >
            Adicionar
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-400">Carregando catálogo…</p> : null}
        {error ? (
          <p
            className="mt-4 rounded-xl border border-rose-800 bg-rose-950/60 p-4 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="mt-8" aria-labelledby="selected-title">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold" id="selected-title">
              Selecionados
            </h2>
            <span className="text-sm text-slate-400">{selection.selectedVehicles.length}</span>
          </div>

          <div className="mt-3 grid gap-3">
            {selection.selectedVehicles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                Nenhum veículo selecionado.
              </p>
            ) : null}
            {selection.selectedVehicles.map((vehicle, index) => {
              const compactName = formatCompactVehicleName(vehicle);

              return (
                <article
                  className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  key={vehicle.id}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {index === 0 ? 'Veículo principal' : `Concorrente ${index}`}
                    </p>
                    <p className="mt-1 truncate font-medium" title={compactName}>
                      {compactName}
                    </p>
                  </div>
                  <button
                    className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    onClick={() => removeVehicle(vehicle.id)}
                    type="button"
                  >
                    Remover
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <button
          className="mt-8 min-h-12 w-full rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          disabled={selection.selectedVehicles.length < 2}
          onClick={goToComparison}
          type="button"
        >
          {selection.selectedVehicles.length < 2
            ? 'Selecione pelo menos 2 veículos'
            : 'Comparar veículos'}
        </button>
      </section>
    </main>
  );
}
