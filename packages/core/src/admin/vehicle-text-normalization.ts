export function normalizeVehicleText(value: string): string {
  const collapsed = value.trim().replace(/\s+/gu, ' ');
  const firstLetterIndex = collapsed.search(/\p{L}/u);

  if (firstLetterIndex < 0) return collapsed;

  return (
    collapsed.slice(0, firstLetterIndex) +
    collapsed[firstLetterIndex]!.toLocaleUpperCase('pt-BR') +
    collapsed.slice(firstLetterIndex + 1)
  );
}

export function vehicleTextComparisonKey(value: string): string {
  return normalizeVehicleText(value).toLocaleLowerCase('pt-BR');
}
