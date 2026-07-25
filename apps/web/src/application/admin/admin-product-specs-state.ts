import type {
  AdministrativeProductSpecsModel,
  AdministrativeSpecSubmission,
} from '@compra-car/contracts';
import { isFilledAdministrativeSpec } from '@compra-car/core';

export function filterAdministrativeSpecGroups(
  model: AdministrativeProductSpecsModel,
  query: string,
): AdministrativeProductSpecsModel['groups'] {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  if (!normalized) return model.groups;
  return model.groups.flatMap((group) => {
    const fields = group.fields.filter((field) => field.searchText.includes(normalized));
    return fields.length ? [{ ...group, fields }] : [];
  });
}

export function countAdministrativeSpecs(model: AdministrativeProductSpecsModel): {
  readonly filled: number;
  readonly total: number;
  readonly byGroup: Readonly<Record<string, { readonly filled: number; readonly total: number }>>;
} {
  const byGroup = Object.fromEntries(
    model.groups.map((group) => [
      group.name,
      {
        filled: group.fields.filter(isFilledAdministrativeSpec).length,
        total: group.fields.length,
      },
    ]),
  );
  return {
    filled: Object.values(byGroup).reduce((total, group) => total + group.filled, 0),
    total: Object.values(byGroup).reduce((total, group) => total + group.total, 0),
    byGroup,
  };
}

export function hasAdministrativeSpecChanges(
  initial: AdministrativeProductSpecsModel,
  current: AdministrativeProductSpecsModel,
): boolean {
  return JSON.stringify(initial.groups) !== JSON.stringify(current.groups);
}

export function countAdministrativeSpecChanges(
  initial: AdministrativeProductSpecsModel,
  current: AdministrativeProductSpecsModel,
): number {
  const flatten = (model: AdministrativeProductSpecsModel) =>
    model.groups.flatMap((group) => group.fields);
  const before = flatten(initial);
  return flatten(current).filter(
    (field, index) => JSON.stringify(field) !== JSON.stringify(before[index]),
  ).length;
}

export function toAdministrativeSpecSubmissions(
  model: AdministrativeProductSpecsModel,
): readonly AdministrativeSpecSubmission[] {
  return model.groups.flatMap((group) =>
    group.fields.map((field): AdministrativeSpecSubmission => {
      if (field.kind === 'numeric') {
        return {
          kind: 'numeric',
          specId: field.specId,
          value: field.value,
          inputUnit: field.inputUnit,
        };
      }
      if (field.kind === 'binary') {
        return { kind: 'binary', specId: field.specId, present: field.present };
      }
      return {
        kind: 'scale',
        specIds: field.options.map((option) => option.specId),
        selectedSpecId: field.selectedSpecId,
      };
    }),
  );
}
