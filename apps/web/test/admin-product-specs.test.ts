import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdministrativeProductSpecsModel } from '@compra-car/contracts';
import { describe, expect, it } from 'vitest';

import {
  countAdministrativeSpecChanges,
  countAdministrativeSpecs,
  filterAdministrativeSpecGroups,
  hasAdministrativeSpecChanges,
  toAdministrativeSpecSubmissions,
} from '../src/application/admin/admin-product-specs-state';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

const model: AdministrativeProductSpecsModel = {
  filled: 1,
  total: 3,
  groups: [
    {
      name: 'Powertrain',
      filled: 1,
      total: 2,
      fields: [
        {
          kind: 'numeric',
          specId: '1',
          code: 'PW_0012',
          groupName: 'Powertrain',
          equipmentGroup: 'Engine',
          specSet: 'Max torque',
          label: 'Max torque',
          searchText: 'powertrain engine max torque pw_0012 nm',
          unit: 'Nm',
          inputUnit: 'Nm',
          value: '',
          supportsTorqueUnit: true,
        },
        {
          kind: 'binary',
          specId: '2',
          code: 'PW_0021',
          groupName: 'Powertrain',
          equipmentGroup: 'Engine',
          specSet: 'PMSM',
          label: 'PMSM',
          searchText: 'powertrain engine pmsm pw_0021',
          present: null,
        },
      ],
    },
    {
      name: 'Safety',
      filled: 1,
      total: 1,
      fields: [
        {
          kind: 'scale',
          key: 'Safety\u001fRating\u001fLevel',
          groupName: 'Safety',
          equipmentGroup: 'Rating',
          specSet: 'Level',
          label: 'Level',
          searchText: 'safety rating level sa_1',
          options: [{ specId: '3', code: 'SA_1', label: 'High' }],
          selectedSpecId: '3',
        },
      ],
    },
  ],
};

describe('admin product specs UI state', () => {
  it('searches all indexed hierarchy fields and hides groups without matches', () => {
    expect(filterAdministrativeSpecGroups(model, 'PW_0012')).toHaveLength(1);
    expect(filterAdministrativeSpecGroups(model, 'rating')[0]?.name).toBe('Safety');
    expect(filterAdministrativeSpecGroups(model, 'missing')).toEqual([]);
  });

  it('does not count an unset binary in the general or per-group counters', () => {
    expect(countAdministrativeSpecs(model)).toEqual({
      filled: 1,
      total: 3,
      byGroup: {
        Powertrain: { filled: 0, total: 2 },
        Safety: { filled: 1, total: 1 },
      },
    });
  });

  it.each([true, false])('counts the explicit binary state %s as filled', (present) => {
    const current = structuredClone(model);
    const binary = current.groups[0]?.fields[1];
    if (!binary || binary.kind !== 'binary') throw new Error('fixture invÃ¡lida');
    (binary as { present: boolean | null }).present = present;
    expect(countAdministrativeSpecs(current).byGroup.Powertrain).toEqual({
      filled: 1,
      total: 2,
    });
  });

  it('detects changes, counts them and supports discard through the immutable baseline', () => {
    const numeric = model.groups[0]!.fields[0]!;
    if (numeric.kind !== 'numeric') throw new Error('fixture inválida');
    const current: AdministrativeProductSpecsModel = {
      ...model,
      groups: model.groups.map((group, groupIndex) => ({
        ...group,
        fields: group.fields.map((field, fieldIndex) =>
          groupIndex === 0 && fieldIndex === 0
            ? { ...numeric, value: '18,4', inputUnit: 'kgfm' }
            : field,
        ),
      })),
    };
    expect(hasAdministrativeSpecChanges(model, current)).toBe(true);
    expect(countAdministrativeSpecChanges(model, current)).toBe(1);
    expect(hasAdministrativeSpecChanges(model, structuredClone(model))).toBe(false);
  });

  it('serializes numeric, binary and one logical scale field for batch saving', () => {
    expect(toAdministrativeSpecSubmissions(model)).toEqual([
      { kind: 'numeric', specId: '1', value: '', inputUnit: 'Nm' },
      { kind: 'binary', specId: '2', present: null },
      { kind: 'scale', specIds: ['3'], selectedSpecId: '3' },
    ]);
  });

  it.each([true, false])('serializes a binary transition from unset to %s', (present) => {
    const current = structuredClone(model);
    const binary = current.groups[0]?.fields[1];
    if (!binary || binary.kind !== 'binary') throw new Error('fixture invÃ¡lida');
    (binary as { present: boolean | null }).present = present;
    expect(toAdministrativeSpecSubmissions(current)).toContainEqual({
      kind: 'binary',
      specId: '2',
      present,
    });
  });

  it('discard restores an unset binary from the immutable baseline', () => {
    const baseline = structuredClone(model);
    const current = structuredClone(model);
    const binary = current.groups[0]?.fields[1];
    if (!binary || binary.kind !== 'binary') throw new Error('fixture invÃ¡lida');
    (binary as { present: boolean | null }).present = false;

    expect(hasAdministrativeSpecChanges(baseline, current)).toBe(true);
    const discarded = structuredClone(baseline);
    expect(discarded.groups[0]?.fields[1]).toMatchObject({ kind: 'binary', present: null });
    expect(hasAdministrativeSpecChanges(baseline, discarded)).toBe(false);
  });

  it('implements the protected route, hierarchy, search, sticky actions and navigation', () => {
    const page = source('../src/app/admin/products/[id]/specs/page.tsx');
    const editor = source('../src/components/admin/admin-product-specs-editor.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');
    const edit = source('../src/app/admin/products/[id]/edit/page.tsx');
    const form = source('../src/components/admin/admin-product-form.tsx');

    expect(page).toContain("await requireRole('admin')");
    expect(page).toContain('if (!vehicle) notFound()');
    expect(page).toContain('title="Especificações e equipamentos"');
    expect(editor).toContain('placeholder="Buscar especificações..."');
    expect(editor).toContain('sticky top-[4.25rem]');
    expect(editor).toContain('<details');
    expect(editor).toContain('<option value="">-</option>');
    expect(editor).toContain('role="radiogroup"');
    expect(editor).toContain("label: 'Não informado'");
    expect(editor).toContain("label: 'Não possui'");
    expect(editor).not.toContain('window.alert');
    expect(list).toContain('href={`/admin/products/${product.id}/specs`}');
    expect(edit).toContain('href={`/admin/products/${id}/specs`}');
    expect(form).toContain('href={`/admin/products/${productId}/specs`}');
  });

  it('preserves local state on save failure and replaces it only on success', () => {
    const editor = source('../src/components/admin/admin-product-specs-editor.tsx');
    const failureIndex = editor.indexOf('if (!result.ok)');
    expect(editor.indexOf('setFeedback(', failureIndex)).toBeGreaterThan(failureIndex);
    expect(editor.indexOf('setModel(result.model)')).toBeGreaterThan(failureIndex);
    expect(editor.slice(failureIndex, editor.indexOf('return;', failureIndex))).not.toContain(
      'setModel(',
    );
  });
});
