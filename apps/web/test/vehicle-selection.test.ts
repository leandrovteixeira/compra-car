import type { CatalogVehicleDto } from '@compra-car/contracts';
import { describe, expect, it } from 'vitest';

import {
  formatCompactVehicleName,
  formatModelProductionYears,
  formatVehicleVersionOption,
} from '../src/application/catalog/vehicle-presentation';
import {
  EMPTY_VEHICLE_SELECTION,
  addSelectedVehicle,
  canAddSelectedVehicle,
  changeSelectedBrand,
  changeSelectedModel,
  changeSelectedVersion,
  type VehicleSelectionState,
} from '../src/application/catalog/vehicle-selection-state';

function vehicle(id: string, version = `Versão ${id}`): CatalogVehicleDto {
  return {
    id,
    brand: 'BYD',
    model: 'Song Plus',
    version,
    modelYear: '2027',
    productionYear: '2026',
    displayName: `BYD Song Plus ${version}`,
  };
}

function readyState(
  selectedVehicles: readonly CatalogVehicleDto[] = [],
  vehicleId = '1',
): VehicleSelectionState {
  return {
    brand: 'BYD',
    model: 'Song Plus',
    vehicleId,
    selectedVehicles,
  };
}

describe('seleção explícita de veículos', () => {
  it('selecionar uma versão não adiciona o veículo automaticamente', () => {
    const selected = [vehicle('9')];
    const next = changeSelectedVersion(readyState(selected, ''), '1');

    expect(next.vehicleId).toBe('1');
    expect(next.selectedVehicles).toBe(selected);
  });

  it('mantém Adicionar desabilitado sem uma versão válida', () => {
    expect(canAddSelectedVehicle(readyState([], ''), [vehicle('1')])).toBe(false);
    expect(canAddSelectedVehicle(readyState([], 'inexistente'), [vehicle('1')])).toBe(false);
  });

  it('adiciona no comando explícito e limpa os três campos', () => {
    const candidate = vehicle('1');
    const next = addSelectedVehicle(readyState(), [candidate]);

    expect(next.selectedVehicles).toEqual([candidate]);
    expect(next).toMatchObject({ brand: '', model: '', vehicleId: '' });
  });

  it('preserva os veículos selecionados anteriormente', () => {
    const first = vehicle('1');
    const second = vehicle('2');

    expect(addSelectedVehicle(readyState([first], '2'), [second]).selectedVehicles).toEqual([
      first,
      second,
    ]);
  });

  it('impede duplicidade antes da inclusão', () => {
    const duplicate = vehicle('1');
    const state = readyState([duplicate]);

    expect(canAddSelectedVehicle(state, [duplicate])).toBe(false);
    expect(addSelectedVehicle(state, [duplicate])).toBe(state);
  });

  it('não permite adicionar um quarto veículo', () => {
    const state = readyState([vehicle('1'), vehicle('2'), vehicle('3')], '4');

    expect(canAddSelectedVehicle(state, [vehicle('4')])).toBe(false);
    expect(addSelectedVehicle(state, [vehicle('4')])).toBe(state);
  });

  it('mudar a marca limpa modelo e versão, preservando os selecionados', () => {
    const selected = [vehicle('1')];
    const next = changeSelectedBrand(readyState(selected), 'Honda');

    expect(next).toMatchObject({ brand: 'Honda', model: '', vehicleId: '' });
    expect(next.selectedVehicles).toBe(selected);
  });

  it('mudar o modelo limpa somente a versão da seleção progressiva', () => {
    const next = changeSelectedModel(readyState(), 'Dolphin');

    expect(next).toMatchObject({ brand: 'BYD', model: 'Dolphin', vehicleId: '' });
  });
});

describe('apresentação compacta de MY/PY', () => {
  it('formata MY2027/PY2026 como 27/26', () => {
    expect(formatModelProductionYears('2027', '2026')).toBe('27/26');
    expect(formatCompactVehicleName(vehicle('1', 'GS 1.5 TGDI PHEV DHT'))).toBe(
      'BYD Song Plus GS 1.5 TGDI PHEV DHT · 27/26',
    );
  });

  it('mantém zero à esquerda nos dois últimos dígitos', () => {
    expect(formatModelProductionYears('2007', '2006')).toBe('07/06');
  });

  it('uma descrição longa não altera o valor real do veículo', () => {
    const longVersion = `Versão ${'muito longa '.repeat(20).trim()}`;
    const original = vehicle('1', longVersion);
    const before = structuredClone(original);

    expect(formatVehicleVersionOption(original)).toContain(longVersion);
    expect(formatCompactVehicleName(original)).toContain(longVersion);
    expect(original).toEqual(before);
    expect(original.version).toBe(longVersion);
  });

  it('parte de um estado inicial sem versão e sem adição implícita', () => {
    expect(EMPTY_VEHICLE_SELECTION).toEqual({
      brand: '',
      model: '',
      vehicleId: '',
      selectedVehicles: [],
    });
  });
});
