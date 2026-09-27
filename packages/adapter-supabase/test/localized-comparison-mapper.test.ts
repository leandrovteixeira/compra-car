import { describe, expect, it } from 'vitest';

import type { LegacySpecRow } from '../src/legacy-dtos';
import { mapLegacySpecToComparisonItem } from '../src/mappers';

const base: LegacySpecRow = {
  id: 22,
  code: 'CO_0022',
  type: 'scale',
  group_name: 'Convenience',
  equipment_group: 'Touch screen display',
  spec_set: 'Multimedia connection',
  detail: 'CarPlay/ Android Auto (USB)',
  group_name_pt: 'Conveniência',
  equipment_group_pt: 'Tela multimídia',
  spec_set_pt: 'Conexão multimídia',
  detail_pt: 'USB',
  display_pt: 'Conexão multimídia (Android Auto / Carplay)',
  display_order: 1870,
  display_unit_pt: null,
  display_multiplier: 1,
  display_decimals: null,
  relative_value: 260,
  unit: null,
  value_direction: null,
  is_active: true,
};

describe('localized comparison spec mapping', () => {
  it('keeps hierarchy, seller label, scale option and display order as distinct concepts', () => {
    expect(mapLegacySpecToComparisonItem(base)).toMatchObject({
      code: 'CO_0022',
      type: 'scale',
      category: 'Conveniência',
      equipmentGroup: 'Tela multimídia',
      specSet: 'Conexão multimídia',
      label: 'Conexão multimídia (Android Auto / Carplay)',
      optionLabel: 'USB',
      relativeValue: 260,
      displayMultiplier: 1,
      sortOrder: 1870,
    });
  });

  it('falls back to canonical English fields while the localized layer is incomplete', () => {
    expect(
      mapLegacySpecToComparisonItem({
        ...base,
        group_name_pt: null,
        equipment_group_pt: null,
        spec_set_pt: null,
        detail_pt: null,
        display_pt: null,
        display_order: null,
      }),
    ).toMatchObject({
      category: 'Convenience',
      equipmentGroup: 'Touch screen display',
      specSet: 'Multimedia connection',
      label: 'CarPlay/ Android Auto (USB)',
      optionLabel: 'CarPlay/ Android Auto (USB)',
      sortOrder: null,
    });
  });
});
