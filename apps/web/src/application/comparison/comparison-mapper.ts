import type {
  ComparisonCellDto,
  ComparisonPageDataDto,
  ComparisonResult,
  VehicleComparisonValue,
} from '@compra-car/contracts';

const NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

export function toComparisonCell(value: VehicleComparisonValue): ComparisonCellDto {
  if (value.type !== 'numeric') {
    return Object.freeze({
      type: value.type,
      displayValue: value.present ? 'Sim' : 'Não',
    });
  }

  if (value.value === null) {
    return Object.freeze({ type: 'numeric', displayValue: '—' });
  }

  const formattedValue = NUMBER_FORMAT.format(value.value);
  return Object.freeze({
    type: 'numeric',
    displayValue: value.unit ? `${formattedValue} ${value.unit}` : formattedValue,
  });
}

export function toComparisonPageData(result: ComparisonResult): ComparisonPageDataDto {
  const vehicles = result.vehicles.map((vehicle) =>
    Object.freeze({
      id: String(vehicle.id),
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      modelYear: vehicle.modelYear,
      productionYear: vehicle.productionYear,
    }),
  );

  const categories = result.categories.map((category) =>
    Object.freeze({
      name: category.category,
      rows: category.rows.map((row) =>
        Object.freeze({
          code: String(row.item.code),
          label: row.item.label,
          equipmentGroup: row.item.equipmentGroup,
          specSet: row.item.specSet,
          isDifferent: row.isDifferent,
          values: result.vehicles.map((vehicle) => {
            const value = row.valuesByVehicle[String(vehicle.id)];
            if (!value) throw new Error('Resultado de comparação incompleto.');
            return toComparisonCell(value);
          }),
        }),
      ),
    }),
  );

  return Object.freeze({ vehicles, categories });
}
