import { describe, expect, it } from 'vitest';

import {
  buildVehicleSpecsDryRunReport,
  buildVehicleSpecsCsvDryRunReport,
  canonicalizeProductSpecNumeric,
  parseAuthoritativeVehicleYears,
  parseSemicolonVehicleSpecsCsv,
  parseVehicleYears,
  transposeVehicleSpecsMatrix,
  type ExistingProductIdentity,
  type MasterSpec,
  type MatrixRow,
} from '../src';

const specs: readonly MasterSpec[] = [
  { id: 'n', code: 'DM_0001', type: 'numeric', unit: 'mm' },
  { id: 'b', code: 'SA_0001', type: 'binary', unit: null },
  {
    id: 's',
    code: 'TR_0001',
    type: 'scale',
    unit: null,
    specSet: 'Traction',
    isBaseline: false,
  },
  {
    id: 'sb',
    code: 'TR_0000',
    type: 'scale',
    unit: null,
    specSet: 'Traction',
    isBaseline: true,
  },
  {
    id: 's2',
    code: 'TR_0002',
    type: 'scale',
    unit: null,
    specSet: 'Traction',
    isBaseline: false,
  },
];

const rows: readonly MatrixRow[] = [
  { code: 'SC_0001', B: 'Toyota Corolla Cross XRX 2025/2026', C: 'GWM Haval H6 2026/2027' },
  { code: 'SC_0002', B: ' toyota ', C: 'GWM' },
  { code: 'SC_0003', B: 'corolla  cross', C: 'Haval H6' },
  { code: 'SC_0004', B: 'xrx', C: 'Premium' },
  { code: 'SC_0005', B: '25/26', C: '26/27' },
  { code: 'DM_0001', B: '5.200', C: '0,58' },
  { code: 'SA_0001', B: 'S', C: 's' },
  { code: 'TR_0001', B: '', C: 'S' },
  { code: 'XX_9999', B: '1', C: '' },
];

const existing: readonly ExistingProductIdentity[] = [
  {
    id: '42',
    brand: 'Toyota',
    model: 'Corolla cross',
    version: 'Xrx',
    productionYear: 2025,
    modelYear: 2026,
  },
];

describe('vehicle specs matrix dry-run', () => {
  it.each([
    [9.18128655, 9.1813],
    [61.27272727, 61.2727],
    [41.59581426, 41.5958],
    [1.2344, 1.2344],
    [1.23, 1.23],
    [0, 0],
    [-1.23445, -1.2345],
    [1.23444, 1.2344],
    [1.23445, 1.2345],
    [9.99995, 10],
  ])('canonicalizes %s with PostgreSQL numeric(14,4) semantics', (source, expected) => {
    expect(canonicalizeProductSpecNumeric(source)).toBe(expected);
  });

  it('canonicalizes PW_0035/PW_0036 only at the persistable association boundary', () => {
    const ratioSpecs: readonly MasterSpec[] = [
      { id: 'pw35', code: 'PW_0035', type: 'numeric', unit: 'kg/cv' },
      { id: 'pw36', code: 'PW_0036', type: 'numeric', unit: 'kg/Nm' },
    ];
    const ratioRows = [
      ...rows.slice(0, 5),
      { code: 'PW_0035', B: '9.18128655', C: '' },
      { code: 'PW_0036', B: '61.27272727', C: '' },
    ];
    const result = transposeVehicleSpecsMatrix(ratioRows, ratioSpecs, existing);
    expect(result[0]?.specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PW_0035',
          value: 9.1813,
          calculatedValue: 9.18128655,
          numericCanonicalization: 'numeric(14,4)',
        }),
        expect.objectContaining({
          code: 'PW_0036',
          value: 61.2727,
          calculatedValue: 61.27272727,
          numericCanonicalization: 'numeric(14,4)',
        }),
      ]),
    );
  });

  it.each([
    ['25/26', 2025, 2026],
    ['26/27', 2026, 2027],
    ['27/27', 2027, 2027],
  ])('parses conservative year pair %s', (source, productionYear, modelYear) => {
    expect(parseVehicleYears(source)).toEqual({
      ok: true,
      productionYear,
      modelYear,
      corrected: false,
    });
  });

  it('corrects 2.526 only with unequivocal evidence and reviews conflicts', () => {
    expect(parseVehicleYears('2.526', 'Veículo 2026')).toEqual({
      ok: true,
      productionYear: 2026,
      modelYear: 2026,
      corrected: true,
    });
    expect(parseVehicleYears('2.526', 'Veículo 2025/2026')).toMatchObject({
      ok: false,
      needsReview: true,
    });
    expect(parseVehicleYears('2.526', 'Veículo sem ano')).toMatchObject({
      ok: false,
      needsReview: true,
    });
  });

  it('transposes, parses pt-BR numbers, S/s, empty and unknown codes', () => {
    const result = transposeVehicleSpecsMatrix(rows, specs, existing);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      sourceColumn: 'B',
      brand: 'Toyota',
      model: 'Corolla cross',
      version: 'Xrx',
      matchStatus: 'EXISTING_EXACT',
      existingProductId: '42',
    });
    expect(result[0]?.specs).toEqual(
      expect.arrayContaining([
        { code: 'DM_0001', specId: 'n', kind: 'numeric', value: 5200 },
        { code: 'SA_0001', specId: 'b', kind: 'binary', isPresent: true },
      ]),
    );
    expect(result[0]?.specs.some((spec) => spec.kind === 'scale')).toBe(false);
    expect(result[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'unknown_spec_code', code: 'XX_9999' }),
      ]),
    );
    expect(result[1]).toMatchObject({ matchStatus: 'NEW_PRODUCT' });
    expect(result[1]?.specs).toEqual(
      expect.arrayContaining([
        { code: 'DM_0001', specId: 'n', kind: 'numeric', value: 0.58 },
        { code: 'SA_0001', specId: 'b', kind: 'binary', isPresent: true },
        {
          code: 'TR_0001',
          specId: 's',
          kind: 'scale',
          isPresent: true,
          resolution: 'explicit',
        },
      ]),
    );
  });

  it('applies confirmed conservative numeric decorations only', () => {
    const numericSpecs: readonly MasterSpec[] = [
      { id: 'ratio', code: 'EX_0004', type: 'numeric', unit: null },
      { id: 'inch', code: 'CO_0017', type: 'numeric', unit: 'inch' },
    ];
    const custom = [
      ...rows.slice(0, 5),
      { code: 'EX_0004', B: '215/60  R17', C: 'invalid tire' },
      { code: 'CO_0017', B: '7"', C: '7 cm' },
    ];
    const result = transposeVehicleSpecsMatrix(custom, numericSpecs, existing);
    expect(result[0]?.specs).toEqual(
      expect.arrayContaining([
        { code: 'EX_0004', specId: 'ratio', kind: 'numeric', value: 60 },
        { code: 'CO_0017', specId: 'inch', kind: 'numeric', value: 7 },
      ]),
    );
    expect(result[1]?.issues.filter((issue) => issue.category === 'NUMERIC_INVALID')).toHaveLength(
      2,
    );
  });

  it('preserves binary zero as false and reviews textual content', () => {
    const custom = rows.map((row) => (row.code === 'SA_0001' ? { ...row, B: '0', C: 'USB' } : row));
    const result = transposeVehicleSpecsMatrix(custom, specs, existing);
    expect(result[0]?.specs).toContainEqual({
      code: 'SA_0001',
      specId: 'b',
      kind: 'binary',
      isPresent: false,
    });
    expect(result[1]?.issues).toContainEqual(
      expect.objectContaining({
        code: 'SA_0001',
        value: 'USB',
        category: 'UNEXPECTED_BINARY_VALUE',
      }),
    );
  });

  it('resolves scales once by explicit member or baseline and reports conflicts', () => {
    const scaleRows = [
      ...rows.slice(0, 5),
      { code: 'TR_0000', B: '0', C: 'S' },
      { code: 'TR_0001', B: '0', C: 'S' },
    ];
    const result = transposeVehicleSpecsMatrix(scaleRows, specs, existing);
    expect(result[0]?.specs.filter((spec) => spec.kind === 'scale')).toEqual([
      {
        code: 'TR_0000',
        specId: 'sb',
        kind: 'scale',
        isPresent: true,
        resolution: 'baseline',
      },
    ]);
    expect(result[1]?.specs.filter((spec) => spec.kind === 'scale')).toEqual([
      {
        code: 'TR_0001',
        specId: 's',
        kind: 'scale',
        isPresent: true,
        resolution: 'explicit',
      },
    ]);
    expect(result[1]?.issues).not.toContainEqual(
      expect.objectContaining({ category: 'SCALE_CONFLICT' }),
    );
  });

  it('does not choose arbitrarily when a scale has multiple higher members', () => {
    const scaleRows = [
      ...rows.slice(0, 5),
      { code: 'TR_0000', B: '0', C: '' },
      { code: 'TR_0001', B: 'S', C: '' },
      { code: 'TR_0002', B: 'S', C: '' },
    ];
    const result = transposeVehicleSpecsMatrix(scaleRows, specs, existing);
    expect(result[0]?.specs.filter((spec) => spec.kind === 'scale')).toEqual([]);
    expect(result[0]?.issues).toContainEqual(
      expect.objectContaining({ category: 'SCALE_CONFLICT', code: 'TR_0001,TR_0002' }),
    );
  });

  it('applies only the explicit legacy source normalizations', () => {
    const legacySpecs: readonly MasterSpec[] = [
      {
        id: 'right',
        code: 'EX_0030',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Mirror Tilt Down',
        specSet: 'Tilt down',
      },
      {
        id: 'both',
        code: 'EX_0031',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Mirror Tilt Down',
        specSet: 'Tilt down',
      },
      {
        id: 'rvm',
        code: 'SF_0034',
        type: 'scale',
        unit: null,
        groupName: 'Safety',
        equipmentGroup: 'Parking Camera',
        specSet: 'Parking Camera',
      },
      {
        id: '360',
        code: 'SF_0035',
        type: 'scale',
        unit: null,
        groupName: 'Safety',
        equipmentGroup: 'Parking Camera',
        specSet: 'Parking Camera',
      },
      { id: 'speed', code: 'CO_0033', type: 'binary', unit: null },
      { id: 'dashcam', code: 'SF_0041', type: 'binary', unit: null },
    ];
    const legacyRows = [
      ...rows.slice(0, 5),
      { code: 'EX_0030', B: 'S', C: '' },
      { code: 'EX_0031', B: 'S', C: '' },
      { code: 'SF_0034', B: 'S', C: '' },
      { code: 'SF_0035', B: 'S', C: '' },
      { code: 'CO_0033', B: 'Alert&Can be closed', C: '' },
      { code: 'SF_0041', B: 'USB', C: '' },
    ];
    const generic = transposeVehicleSpecsMatrix(legacyRows, legacySpecs, existing);
    expect(generic[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'SCALE_CONFLICT' }),
        expect.objectContaining({ code: 'CO_0033', category: 'UNEXPECTED_BINARY_VALUE' }),
        expect.objectContaining({ code: 'SF_0041', category: 'UNEXPECTED_BINARY_VALUE' }),
      ]),
    );
    const historical = transposeVehicleSpecsMatrix(
      legacyRows,
      legacySpecs,
      existing,
      undefined,
      'legacy-staging-csv',
    );
    expect(historical[0]?.issues).toEqual([]);
    expect(historical[0]?.specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EX_0031',
          sourceNormalization: 'LEGACY_MIRROR_TILT_RIGHT_BOTH_TO_BOTH',
        }),
        expect.objectContaining({
          code: 'SF_0035',
          sourceNormalization: 'LEGACY_PARKING_CAMERA_RVM_360_TO_360',
        }),
        expect.objectContaining({
          code: 'CO_0033',
          isPresent: true,
          rawValue: 'Alert&Can be closed',
        }),
        expect.objectContaining({ code: 'SF_0041', isPresent: false, rawValue: 'USB' }),
      ]),
    );
  });

  it('separates homonymous scales by group and equipment group', () => {
    const fogSpecs: readonly MasterSpec[] = [
      {
        id: 'front-none',
        code: 'EX_1016',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Front fog lamps',
        specSet: 'Fog lamps',
        isBaseline: true,
      },
      {
        id: 'front-led',
        code: 'EX_0018',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Front fog lamps',
        specSet: 'Fog lamps',
      },
      {
        id: 'rear-none',
        code: 'EX_1023',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Rear fog lamps',
        specSet: 'Fog lamps',
        isBaseline: true,
      },
      {
        id: 'rear-led',
        code: 'EX_0024',
        type: 'scale',
        unit: null,
        groupName: 'Exterior',
        equipmentGroup: 'Rear fog lamps',
        specSet: 'Fog lamps',
      },
    ];
    const fogRows = [
      ...rows.slice(0, 5),
      { code: 'EX_0018', B: 'S', C: '' },
      { code: 'EX_0024', B: 'S', C: '' },
    ];
    const result = transposeVehicleSpecsMatrix(fogRows, fogSpecs, existing);
    expect(result[0]?.specs.filter((spec) => spec.kind === 'scale')).toHaveLength(2);
    expect(result[0]?.issues).not.toContainEqual(
      expect.objectContaining({ category: 'SCALE_CONFLICT' }),
    );
  });

  it('keeps TBC, qualified pending values and syntactic garbage in review', () => {
    const custom = rows.map((row) =>
      row.code === 'DM_0001'
        ? { ...row, B: 'TBC', C: '108(NEDC) INMETRO TBC' }
        : row.code === 'SA_0001'
          ? { ...row, B: ',' }
          : row,
    );
    const result = transposeVehicleSpecsMatrix(custom, specs, existing);
    expect(result[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'TBC', value: 'TBC' }),
        expect.objectContaining({ category: 'MALFORMED_SOURCE_VALUE', value: ',' }),
      ]),
    );
    expect(result[1]?.issues).toContainEqual(
      expect.objectContaining({ category: 'QUALIFIED_PENDING_VALUE' }),
    );
  });

  it('treats TBD and unexpected binary values as review, preserving numeric zero', () => {
    const custom = rows.map((row) =>
      row.code === 'DM_0001'
        ? { ...row, B: 0, C: 'TBD' }
        : row.code === 'SA_0001'
          ? { ...row, B: 'N' }
          : row,
    );
    const result = transposeVehicleSpecsMatrix(custom, specs, existing);
    expect(result[0]?.specs).toContainEqual({
      code: 'DM_0001',
      specId: 'n',
      kind: 'numeric',
      value: 0,
    });
    expect(result[0]?.issues).toContainEqual(
      expect.objectContaining({ kind: 'spec_value_review', code: 'SA_0001' }),
    );
    expect(result[1]?.issues).toContainEqual(
      expect.objectContaining({ kind: 'spec_value_review', code: 'DM_0001' }),
    );
  });

  it('classifies duplicate normalized identities as ambiguous and reports totals', () => {
    const report = buildVehicleSpecsDryRunReport({
      source: 'fixture',
      rows,
      specs,
      products: [...existing, { ...existing[0]!, id: '43', brand: ' toyota ' }],
    });
    expect(report.totals).toMatchObject({
      vehicles: 2,
      existing: 0,
      new: 1,
      ambiguous: 1,
      invalid: 0,
      unknownSpecCodes: 1,
      specCells: 6,
    });
    expect(report.vehicles[0]).toMatchObject({ matchStatus: 'AMBIGUOUS', existingProductId: null });
  });

  it('parses SC_0001-SC_0006 from the vertical semicolon CSV with authoritative years', () => {
    const csv = [
      'SC_0001;SC_0002;SC_0003;SC_0004;SC_0005;SC_0006;DM_0001;SA_0001;TR_0001;XX_9999',
      'Toyota Corolla Cross XRX 2526; toyota ;corolla  cross;xrx;2025;2026;5.200;S;;1',
      'GWM Haval H6 Premium 2627;GWM;Haval H6;Premium;2026;2027;TBD;s;S;',
    ].join('\n');
    const parsed = parseSemicolonVehicleSpecsCsv(csv);
    expect(parsed).toMatchObject({
      headers: expect.arrayContaining(['SC_0001', 'SC_0006']),
      rows: expect.any(Array),
    });
    const report = buildVehicleSpecsCsvDryRunReport({
      source: 'fixture.csv',
      sourceSha256: 'ABC',
      csv,
      specs,
      products: existing,
    });
    expect(report.totals).toMatchObject({
      rows: 2,
      vehicles: 2,
      columns: 10,
      specColumns: 4,
      existingExact: 1,
      newProduct: 1,
      specCellsObserved: 8,
      specCellsRecognized: 5,
      specCellsParsed: 4,
      specCellsIgnoredEmpty: 2,
      specCellsIgnoredTbd: 1,
      specCellsUnknownCode: 1,
      uniqueRecognizedSpecCodes: 3,
      uniqueUnknownSpecCodes: 1,
    });
    expect(report.vehicles[0]).toMatchObject({
      fullName: 'Toyota Corolla Cross XRX 2526',
      productionYear: 2025,
      modelYear: 2026,
      matchStatus: 'EXISTING_EXACT',
    });
    expect(report.unknownSpecCodes).toEqual([{ code: 'XX_9999', occurrences: 1 }]);
    expect(report.checks).toMatchObject({
      authoritativeYearsValidForAllVehicles: true,
      vehiclesRequiringYearInference: 0,
      unknownSpecsCreated: 0,
      allRowsProcessed: true,
      deterministicTranspose: true,
      noDuplicateBaselinePerSpecSet: true,
      noBaselineWithHigherMember: true,
    });
  });

  it('never falls back to SC_0001 when either authoritative year is invalid', () => {
    expect(parseAuthoritativeVehicleYears('2.526', '2026')).toMatchObject({
      ok: false,
      needsReview: true,
    });
    expect(parseAuthoritativeVehicleYears('', '2026')).toMatchObject({
      ok: false,
      needsReview: true,
    });
  });
});
