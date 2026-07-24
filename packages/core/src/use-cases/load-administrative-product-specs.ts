import {
  formatAdministrativeNumeric,
  isFilledAdministrativeSpec,
  TORQUE_SPEC_CODES,
  type AdministrativeProductSpecsModel,
  type AdministrativeProductSpecsRepository,
  type AdministrativeScaleSpec,
  type AdministrativeSpecCatalogItem,
  type AdministrativeSpecField,
} from '../admin/administrative-product-specs';

function scaleKey(spec: AdministrativeSpecCatalogItem): string {
  return [spec.groupName, spec.equipmentGroup, spec.specSet].join('\u001f');
}

function searchText(spec: AdministrativeSpecCatalogItem): string {
  return [
    spec.groupName,
    spec.equipmentGroup,
    spec.specSet,
    spec.detail,
    spec.code,
    spec.unit ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR');
}

export class LoadAdministrativeProductSpecs {
  constructor(private readonly repository: AdministrativeProductSpecsRepository) {}

  async execute(productId: string): Promise<AdministrativeProductSpecsModel> {
    const [catalog, values] = await Promise.all([
      this.repository.listActiveAdministrativeSpecs(),
      this.repository.listAdministrativeProductSpecValues(productId),
    ]);
    const valuesBySpec = new Map(values.map((value) => [value.specId, value]));
    const fields: AdministrativeSpecField[] = [];
    const scaleGroups = new Map<string, AdministrativeSpecCatalogItem[]>();

    for (const spec of catalog) {
      if (spec.type === 'scale') {
        const key = scaleKey(spec);
        scaleGroups.set(key, [...(scaleGroups.get(key) ?? []), spec]);
        continue;
      }
      const current = valuesBySpec.get(spec.id);
      const base = {
        groupName: spec.groupName,
        equipmentGroup: spec.equipmentGroup,
        specSet: spec.specSet,
        searchText: searchText(spec),
      };
      if (spec.type === 'binary') {
        fields.push({
          ...base,
          kind: 'binary',
          specId: spec.id,
          code: spec.code,
          label: spec.detail,
          present: current?.isPresent === true,
        });
      } else {
        fields.push({
          ...base,
          kind: 'numeric',
          specId: spec.id,
          code: spec.code,
          label: spec.detail,
          unit: spec.unit,
          inputUnit: spec.unit,
          value: formatAdministrativeNumeric(current?.value ?? null),
          supportsTorqueUnit:
            TORQUE_SPEC_CODES.includes(spec.code as (typeof TORQUE_SPEC_CODES)[number]) &&
            spec.unit === 'Nm',
        });
      }
    }

    for (const [key, options] of scaleGroups) {
      const first = options[0]!;
      const selected = options.filter((option) => valuesBySpec.get(option.id)?.isPresent === true);
      if (selected.length > 1) {
        throw new Error(`Mais de uma opção está selecionada para ${first.specSet}.`);
      }
      const field: AdministrativeScaleSpec = {
        kind: 'scale',
        key,
        groupName: first.groupName,
        equipmentGroup: first.equipmentGroup,
        specSet: first.specSet,
        label: first.specSet,
        searchText: options.map(searchText).join(' '),
        options: options.map((option) => ({
          specId: option.id,
          code: option.code,
          label: option.detail,
        })),
        selectedSpecId: selected[0]?.id ?? null,
      };
      fields.push(field);
    }

    const orderedFields = [...fields].sort(
      (left, right) =>
        left.groupName.localeCompare(right.groupName, 'pt-BR') ||
        left.equipmentGroup.localeCompare(right.equipmentGroup, 'pt-BR') ||
        left.specSet.localeCompare(right.specSet, 'pt-BR') ||
        left.searchText.localeCompare(right.searchText, 'pt-BR'),
    );
    const byGroup = new Map<string, AdministrativeSpecField[]>();
    for (const field of orderedFields) {
      byGroup.set(field.groupName, [...(byGroup.get(field.groupName) ?? []), field]);
    }
    const groups = [...byGroup].map(([name, groupFields]) => ({
      name,
      fields: groupFields,
      filled: groupFields.filter(isFilledAdministrativeSpec).length,
      total: groupFields.length,
    }));
    return {
      groups,
      filled: groups.reduce((total, group) => total + group.filled, 0),
      total: groups.reduce((total, group) => total + group.total, 0),
    };
  }
}
