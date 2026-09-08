import { describe, expect, it } from 'vitest';

import {
  buildVehicleSpecsCsvDryRunReport,
  reconcileVehicleSpecCatalog,
  type CatalogSpec,
  type ExcelMasterSpec,
} from '../src';

const spec = (code: string, override: Partial<CatalogSpec> = {}): CatalogSpec => ({
  id: code,
  code,
  type: 'numeric',
  groupName: 'Powertrain',
  equipmentGroup: 'Engine',
  specSet: code,
  detail: code,
  unit: null,
  valueDirection: null,
  unitPerceivedValue: 0,
  relativeValue: 0,
  isBaseline: false,
  isActive: true,
  notes: null,
  commercialCategory: null,
  ...override,
});

const appCore: readonly CatalogSpec[] = [
  spec('PW_0045', {
    type: 'scale',
    equipmentGroup: 'Transmission',
    specSet: 'Transmission type',
    detail: 'AT',
  }),
  spec('PW_0012', { unit: 'Nm' }),
  spec('PW_0023', { unit: 'Nm' }),
  spec('PW_0026', { unit: 'Nm' }),
  spec('PW_0033', { unit: 'Nm' }),
];
const appSpecs: readonly CatalogSpec[] = [
  ...appCore,
  ...Array.from({ length: 315 }, (_, index) => spec(`ZZ_${String(index).padStart(4, '0')}`)),
];
const excelSpecs: readonly ExcelMasterSpec[] = appSpecs.slice(0, 10).map((item) => ({
  code: item.code,
  groupName: item.groupName,
  equipmentGroup: item.equipmentGroup,
  specSet: item.specSet,
  detail: item.detail,
  type: item.type,
  unit: item.unit,
  valueDirection: item.valueDirection,
  unitPerceivedValue: item.unitPerceivedValue,
  relativeValue: item.relativeValue,
  isBaseline: item.isBaseline,
  notes: item.notes,
}));

describe('vehicle specs catalog reconciliation', () => {
  it('reassigns PW_0045 to REEV and proposes unused PW_1045 for historical AT', () => {
    const result = reconcileVehicleSpecCatalog({
      appSpecs,
      excelSpecs,
      stagingSpecs: appSpecs.slice(0, 3),
      matrixSpecCodes: ['PW_0045', 'PW_0012'],
      appPw0045UsageCount: 0,
    });
    expect(result.totals.reconciled).toBe(321);
    expect(result.candidateCatalog.find((item) => item.code === 'PW_0045')).toMatchObject({
      type: 'scale',
      specSet: 'Engine tech',
      detail: 'REEV',
    });
    expect(result.candidateCatalog.find((item) => item.code === 'PW_1045')).toMatchObject({
      type: 'scale',
      specSet: 'Transmission type',
      detail: 'AT',
    });
    expect(result.sourceCodeMap).toEqual({ PW_0045: 'PW_1045' });
    expect(result.specialRules).toMatchObject({
      canonicalTorqueUnit: 'Nm',
      derivedTorqueUnit: 'kgfm',
      excludedTorqueCodes: ['PW_0013', 'PW_0024', 'PW_0027', 'PW_0034'],
    });
  });

  it('refuses the override when PW_0045 is in use', () => {
    expect(() =>
      reconcileVehicleSpecCatalog({
        appSpecs,
        excelSpecs,
        stagingSpecs: [],
        matrixSpecCodes: [],
        appPw0045UsageCount: 1,
      }),
    ).toThrow('possui associações');
  });

  it('maps historical matrix PW_0045 values to the proposed AT code', () => {
    const catalog = reconcileVehicleSpecCatalog({
      appSpecs,
      excelSpecs,
      stagingSpecs: [],
      matrixSpecCodes: ['PW_0045'],
      appPw0045UsageCount: 0,
    });
    const report = buildVehicleSpecsCsvDryRunReport({
      source: 'fixture',
      sourceSha256: 'fixture',
      csv: [
        'SC_0001;SC_0002;SC_0003;SC_0004;SC_0005;SC_0006;PW_0045',
        'Car 2526;Brand;Model;Version;2025;2026;S',
      ].join('\n'),
      specs: catalog.candidateCatalog,
      products: [],
      sourceCodeMap: catalog.sourceCodeMap,
    });
    expect(report.vehicles[0]?.specs).toContainEqual({
      code: 'PW_1045',
      specId: 'candidate:PW_1045',
      kind: 'scale',
      isPresent: true,
      resolution: 'explicit',
    });
    expect(report.totals.uniqueUnknownSpecCodes).toBe(0);
  });

  it('accepts an already-applied PW_1045 in Staging only when it is the reconciled AT member', () => {
    const stagingAt = spec('PW_1045', {
      type: 'scale',
      equipmentGroup: 'Transmission',
      specSet: 'Transmission type',
      detail: 'AT',
    });

    expect(() =>
      reconcileVehicleSpecCatalog({
        appSpecs,
        excelSpecs,
        stagingSpecs: [stagingAt],
        matrixSpecCodes: ['PW_0045'],
        appPw0045UsageCount: 0,
      }),
    ).not.toThrow();

    expect(() =>
      reconcileVehicleSpecCatalog({
        appSpecs,
        excelSpecs,
        stagingSpecs: [spec('PW_1045', { type: 'scale', specSet: 'Wrong', detail: 'AT' })],
        matrixSpecCodes: ['PW_0045'],
        appPw0045UsageCount: 0,
      }),
    ).toThrow('não corresponde ao AT reconciliado');
  });
});
