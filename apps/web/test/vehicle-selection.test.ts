import type { CatalogVehicleDto } from '@compra-car/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  formatCompactVehicleName,
  formatProductionModelYears,
  formatVehicleVersionOption,
} from '../src/application/catalog/vehicle-presentation';
import {
  EMPTY_VEHICLE_SELECTION,
  MAX_SELECTED_VEHICLES,
  addSelectedVehicle,
  canAddSelectedVehicle,
  findAvailableVehicles,
  removeSelectedVehicle,
  type VehicleSelectionState,
} from '../src/application/catalog/vehicle-selection-state';

const source = (relativePath: string) => readFileSync(resolve(__dirname, relativePath), 'utf8');

function vehicle(id: string, overrides: Partial<CatalogVehicleDto> = {}): CatalogVehicleDto {
  return {
    id,
    brand: 'BYD',
    model: 'Song Plus',
    version: `Versão ${id}`,
    modelYear: '2027',
    productionYear: '2026',
    displayName: `BYD Song Plus Versão ${id}`,
    ...overrides,
  };
}

function state(selectedVehicles: readonly CatalogVehicleDto[] = []): VehicleSelectionState {
  return { selectedVehicles };
}

const catalog = [
  vehicle('1', { model: 'Dolphin', version: 'GS EV' }),
  vehicle('2', { model: 'Dolphin Mini', version: 'Comfort' }),
  vehicle('3', { brand: 'GAC', model: 'GS4', version: 'Premium 2.0 HEV CVT' }),
];

describe('busca unificada de veículos do vendedor', () => {
  it.each([
    ['BYD', ['1', '2']],
    ['Dolphin', ['1', '2']],
    ['GS EV', ['1']],
    ['BYD Dolphin', ['1', '2']],
    ['Dolphin GS', ['1']],
    ['GS4', ['3']],
  ])('busca marca/modelo/versão com tokens em %s', (query, expectedIds) => {
    expect(findAvailableVehicles(catalog, query, []).map(({ id }) => id)).toEqual(expectedIds);
  });

  it('não mostra centenas no estado vazio e remove os já selecionados dos resultados', () => {
    expect(findAvailableVehicles(catalog, '', [])).toEqual([]);
    expect(findAvailableVehicles(catalog, 'BYD', [catalog[0]!])).toEqual([catalog[1]]);
  });
});

describe('seleção direta e limites da comparação', () => {
  it('adiciona em uma única ação, preserva a ordem e impede duplicidade', () => {
    const first = addSelectedVehicle(state(), catalog[0]!);
    const second = addSelectedVehicle(first, catalog[2]!);

    expect(second.selectedVehicles.map(({ id }) => id)).toEqual(['1', '3']);
    expect(addSelectedVehicle(second, catalog[0]!)).toBe(second);
  });

  it('aceita quatro veículos e impede a quinta seleção', () => {
    const selected = Array.from({ length: MAX_SELECTED_VEHICLES }, (_, index) =>
      vehicle(String(index + 1)),
    );
    const full = state(selected);
    const fifth = vehicle('5');

    expect(MAX_SELECTED_VEHICLES).toBe(4);
    expect(canAddSelectedVehicle(full, fifth)).toBe(false);
    expect(addSelectedVehicle(full, fifth)).toBe(full);
  });

  it('remove sem reordenar manualmente e promove implicitamente o próximo primeiro', () => {
    const first = vehicle('1');
    const second = vehicle('2');
    const next = removeSelectedVehicle(state([first, second]), first.id);

    expect(next.selectedVehicles).toEqual([second]);
    expect(next.selectedVehicles[0]).toBe(second);
  });

  it('mantém mínimo de dois e navega com IDs na ordem selecionada', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    expect(component).toContain('selection.selectedVehicles.length >= 2');
    expect(component).toContain(".map((vehicle) => vehicle.id).join(',')");
    expect(component).toContain('router.push(`/comparar?vehicles=${ids}`)');
    expect(component).toContain('disabled={!canCompare}');
  });
});

describe('estrutura responsiva da experiência do vendedor', () => {
  it('substitui selects e Adicionar por busca e clique direto no resultado', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    expect(component).toContain('placeholder="Buscar veículo..."');
    expect(component).toContain('onClick={() => selectVehicle(vehicle)}');
    expect(component).toContain("setQuery('')");
    expect(component).toContain('aria-label="Limpar busca"');
    expect(component).not.toContain('<select');
    expect(component).not.toContain('CatalogCombobox');
    expect(component).not.toMatch(/>\s*Adicionar\s*</);
  });

  it('mostra helper vazio sem superfície e mantém superfície para resultados com query', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    expect(component).toContain('!loading && !error && !limitReached && !query.trim()');
    expect(component).toContain('className="mt-2 text-xs leading-5 text-text-muted"');
    expect(component).toContain('Busque por marca, modelo ou versão.');
    expect(component).toContain(
      'className="mt-2 overflow-hidden rounded-md border border-border bg-surface"',
    );
    expect(component).not.toContain(
      'className="px-3 py-3 text-sm text-text-muted">\n                Busque por marca',
    );
  });

  it('renderiza selected list, Principal, remoção acessível e estados de limite', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    expect(component).toContain('<ol');
    expect(component).toContain('Ordem da comparação');
    expect(component).toContain('Principal');
    expect(component).toContain('aria-label={`Remover ${identity}`}');
    expect(component).toContain('Limite de {MAX_SELECTED_VEHICLES} veículos atingido');
  });

  it('preserva fonte móvel, touch targets, largura limitada e ausência de overflow global', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    expect(component).toContain('max-w-3xl');
    expect(component).toContain('text-base');
    expect(component).toContain('min-h-11');
    expect(component).toContain('min-w-11');
    expect(component).toContain('overflow-y-auto');
    expect(component).not.toContain('overflow-x-auto');
  });

  it('usa a action autorizada e cacheada para um catálogo público unificado', () => {
    const component = source('../src/components/vehicle-selection.tsx');
    const actions = source('../src/app/actions/catalog.ts');
    const cache = source('../src/server/catalog-cache.ts');
    expect(component).toContain('getCatalogVehicles()');
    expect(actions).toContain('export async function getCatalogVehicles');
    expect(actions).toContain("await requireRole('seller')");
    expect(cache).toContain('getCachedCatalogVehicles');
    expect(cache).toContain('listAvailableVehicles.execute()');
  });
});

describe('apresentação compacta de produção/modelo', () => {
  it('formata produção/modelo como 26/27 em resultados e selecionados', () => {
    const sample = vehicle('1', { version: 'GS 1.5 TGDI PHEV DHT' });
    const component = source('../src/components/vehicle-selection.tsx');
    expect(formatProductionModelYears('2026', '2027')).toBe('26/27');
    expect(formatCompactVehicleName(sample)).toBe('BYD Song Plus GS 1.5 TGDI PHEV DHT · 26/27');
    expect(component).toContain('formatProductionModelYears');
  });

  it('mantém zero à esquerda e não altera uma descrição longa', () => {
    const longVersion = `Versão ${'muito longa '.repeat(20).trim()}`;
    const original = vehicle('1', { version: longVersion });
    const before = structuredClone(original);

    expect(formatProductionModelYears('2006', '2007')).toBe('06/07');
    expect(formatVehicleVersionOption(original)).toContain(longVersion);
    expect(original).toEqual(before);
  });

  it('parte somente da lista vazia de selecionados', () => {
    expect(EMPTY_VEHICLE_SELECTION).toEqual({ selectedVehicles: [] });
  });
});
