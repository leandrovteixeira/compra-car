import { describe, expect, it, vi } from 'vitest';

import {
  convertUnit,
  LoadAdministrativeProductSpecs,
  parseAdministrativeNumeric,
  SaveAdministrativeProductSpecs,
  type AdministrativeProductSpecsBatch,
  type AdministrativeProductSpecsRepository,
  type AdministrativeSpecCatalogItem,
} from '../src';

const catalog: readonly AdministrativeSpecCatalogItem[] = [
  {
    id: '1',
    code: 'DM_0001',
    type: 'numeric',
    groupName: 'Dimensions',
    equipmentGroup: 'Body',
    specSet: 'Length',
    detail: 'Length',
    unit: 'mm',
  },
  {
    id: '2',
    code: 'PW_0012',
    type: 'numeric',
    groupName: 'Powertrain',
    equipmentGroup: 'Combustion engine',
    specSet: 'Max torque',
    detail: 'Max torque',
    unit: 'Nm',
  },
  {
    id: '3',
    code: 'PW_0036',
    type: 'numeric',
    groupName: 'Powertrain',
    equipmentGroup: 'Combined performance',
    specSet: 'Torque x weight',
    detail: 'Torque x weight',
    unit: 'kg/Nm',
  },
  {
    id: '4',
    code: 'SA_0001',
    type: 'binary',
    groupName: 'Safety',
    equipmentGroup: 'Airbags',
    specSet: 'Front airbag',
    detail: 'Front airbag',
    unit: null,
  },
  {
    id: '5',
    code: 'TR_0001',
    type: 'scale',
    groupName: 'Powertrain',
    equipmentGroup: 'Transmission',
    specSet: 'Transmission type',
    detail: 'Automatic',
    unit: null,
  },
  {
    id: '6',
    code: 'TR_0002',
    type: 'scale',
    groupName: 'Powertrain',
    equipmentGroup: 'Transmission',
    specSet: 'Transmission type',
    detail: 'Manual',
    unit: null,
  },
];

function repository(
  values: Parameters<
    AdministrativeProductSpecsRepository['listAdministrativeProductSpecValues']
  >[0] extends never
    ? never
    : readonly {
        readonly specId: string;
        readonly value: number | null;
        readonly isPresent: boolean | null;
        readonly inputUnit: string | null;
      }[] = [],
) {
  let saved: AdministrativeProductSpecsBatch | undefined;
  const target: AdministrativeProductSpecsRepository = {
    listActiveAdministrativeSpecs: vi.fn(async () => catalog),
    listAdministrativeProductSpecValues: vi.fn(async () => values),
    listUnitConversions: vi.fn(async () => [
      { unitFrom: 'kgfm', unitTo: 'Nm', multiplier: 9.80665, offset: 0 },
      { unitFrom: 'Nm', unitTo: 'kgfm', multiplier: 0.10197162, offset: 0 },
    ]),
    saveAdministrativeProductSpecs: vi.fn(async (_productId, batch) => {
      saved = batch;
    }),
  };
  return { target, saved: () => saved };
}

describe('administrative product specs', () => {
  it('loads every active spec, merges existing values and groups scale as one dropdown', async () => {
    const { target } = repository([
      { specId: '1', value: 4424, isPresent: null, inputUnit: 'mm' },
      { specId: '4', value: null, isPresent: true, inputUnit: null },
      { specId: '5', value: null, isPresent: true, inputUnit: null },
    ]);
    const result = await new LoadAdministrativeProductSpecs(target).execute('10');
    expect(target.listActiveAdministrativeSpecs).toHaveBeenCalled();
    expect(result.total).toBe(5);
    expect(result.filled).toBe(3);
    expect(result.groups.find((group) => group.name === 'Dimensions')?.filled).toBe(1);
    expect(result.groups.flatMap((group) => group.fields)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'numeric', specId: '1', value: '4424' }),
        expect.objectContaining({ kind: 'binary', specId: '4', present: true }),
        expect.objectContaining({
          kind: 'scale',
          selectedSpecId: '5',
          options: expect.arrayContaining([
            expect.objectContaining({ specId: '5' }),
            expect.objectContaining({ specId: '6' }),
          ]),
        }),
      ]),
    );
  });

  it('does not count a binary without an association as filled', async () => {
    const result = await new LoadAdministrativeProductSpecs(repository().target).execute('10');
    expect(result.filled).toBe(0);
    expect(result.groups.flatMap((group) => group.fields)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'numeric', value: '' }),
        expect.objectContaining({ kind: 'binary', present: null }),
      ]),
    );
  });

  it.each([
    [true, 1],
    [false, 1],
  ])('counts an associated binary with is_present = %s as filled', async (isPresent, filled) => {
    const result = await new LoadAdministrativeProductSpecs(
      repository([{ specId: '4', value: null, isPresent, inputUnit: null }]).target,
    ).execute('10');
    const safety = result.groups.find((group) => group.name === 'Safety');
    expect(safety).toMatchObject({ filled, total: 1 });
    expect(safety?.fields[0]).toMatchObject({ kind: 'binary', present: isPresent });
  });

  it('shows 0 / 2 for a group containing only two absent binaries', async () => {
    const source = repository();
    vi.mocked(source.target.listActiveAdministrativeSpecs).mockResolvedValue([
      catalog[3]!,
      { ...catalog[3]!, id: '7', code: 'SA_0002', detail: 'Side airbag' },
    ]);
    const result = await new LoadAdministrativeProductSpecs(source.target).execute('10');
    expect(result.groups).toEqual([
      expect.objectContaining({ name: 'Safety', filled: 0, total: 2 }),
    ]);
    expect(result).toMatchObject({ filled: 0, total: 2 });
  });

  it('shows zero filled fields for a completely new vehicle', async () => {
    const result = await new LoadAdministrativeProductSpecs(repository().target).execute('new');
    expect(result).toMatchObject({ filled: 0, total: 5 });
    expect(result.groups.every((group) => group.filled === 0)).toBe(true);
  });

  it('preserves absent and explicit false binary states independently on reload', async () => {
    const source = repository([{ specId: '4', value: null, isPresent: false, inputUnit: null }]);
    vi.mocked(source.target.listActiveAdministrativeSpecs).mockResolvedValue([
      catalog[3]!,
      { ...catalog[3]!, id: '7', code: 'SA_0002', detail: 'Side airbag' },
    ]);
    const result = await new LoadAdministrativeProductSpecs(source.target).execute('10');
    expect(result.groups[0]?.fields).toEqual([
      expect.objectContaining({ specId: '4', present: false }),
      expect.objectContaining({ specId: '7', present: null }),
    ]);
    expect(result.groups[0]).toMatchObject({ filled: 1, total: 2 });
  });

  it.each([
    ['18', 18],
    ['18,4', 18.4],
    ['18,42', 18.42],
    ['18.4', 18.4],
    ['18.42', 18.42],
    ['', null],
  ])('parses numeric input %s', (input, expected) => {
    expect(parseAdministrativeNumeric(input)).toBe(expected);
  });

  it('rejects more than two decimal places', () => {
    expect(() => parseAdministrativeNumeric('18,421')).toThrow('duas casas');
  });

  it('converts from kgfm to canonical Nm using repository conversions', async () => {
    const source = repository();
    await new SaveAdministrativeProductSpecs(source.target).execute('10', [
      { kind: 'numeric', specId: '2', value: '18,4', inputUnit: 'kgfm' },
    ]);
    expect(source.target.listUnitConversions).toHaveBeenCalled();
    expect(source.saved()?.upserts[0]).toEqual({
      specId: '2',
      value: 18.4 * 9.80665,
      isPresent: null,
      inputUnit: 'Nm',
    });
  });

  it('keeps Nm without conversion and does not treat PW_0036 as kgfm torque', async () => {
    const source = repository();
    await new SaveAdministrativeProductSpecs(source.target).execute('10', [
      { kind: 'numeric', specId: '2', value: '180', inputUnit: 'Nm' },
      { kind: 'numeric', specId: '3', value: '33,5', inputUnit: 'kg/Nm' },
    ]);
    expect(source.saved()?.upserts).toEqual([
      { specId: '2', value: 180, isPresent: null, inputUnit: 'Nm' },
      { specId: '3', value: 33.5, isPresent: null, inputUnit: 'kg/Nm' },
    ]);
  });

  it('fails when a required conversion does not exist', async () => {
    const source = repository();
    vi.mocked(source.target.listUnitConversions).mockResolvedValue([]);
    await expect(
      new SaveAdministrativeProductSpecs(source.target).execute('10', [
        { kind: 'numeric', specId: '2', value: '18', inputUnit: 'kgfm' },
      ]),
    ).rejects.toThrow('não encontrada');
  });

  it('upserts explicit binary false and an exclusive scale selection in one logical batch', async () => {
    const source = repository();
    await new SaveAdministrativeProductSpecs(source.target).execute('10', [
      { kind: 'binary', specId: '4', present: false },
      { kind: 'scale', specIds: ['5', '6'], selectedSpecId: '6' },
    ]);
    expect(source.target.saveAdministrativeProductSpecs).toHaveBeenCalledTimes(1);
    expect(source.saved()).toEqual({
      upserts: [
        { specId: '4', value: null, isPresent: false, inputUnit: null },
        { specId: '6', value: null, isPresent: true, inputUnit: null },
      ],
      deleteSpecIds: ['5'],
    });
  });

  it('removes an explicit binary association when its state becomes undefined', async () => {
    const source = repository();
    await new SaveAdministrativeProductSpecs(source.target).execute('10', [
      { kind: 'binary', specId: '4', present: null },
    ]);
    expect(source.saved()).toEqual({ upserts: [], deleteSpecIds: ['4'] });
  });

  it('removes numeric empty values and all options when scale is set to dash', async () => {
    const source = repository();
    await new SaveAdministrativeProductSpecs(source.target).execute('10', [
      { kind: 'numeric', specId: '1', value: '', inputUnit: 'mm' },
      { kind: 'scale', specIds: ['5', '6'], selectedSpecId: null },
    ]);
    expect(source.saved()).toEqual({ upserts: [], deleteSpecIds: ['1', '5', '6'] });
  });

  it('rejects a scale option outside its logical set', async () => {
    await expect(
      new SaveAdministrativeProductSpecs(repository().target).execute('10', [
        { kind: 'scale', specIds: ['5', '6'], selectedSpecId: '4' },
      ]),
    ).rejects.toThrow('não pertence');
  });

  it('applies offset as part of the generic conversion formula', () => {
    expect(
      convertUnit(10, 'A', 'B', [{ unitFrom: 'A', unitTo: 'B', multiplier: 2, offset: 3 }]),
    ).toBe(23);
  });
});
