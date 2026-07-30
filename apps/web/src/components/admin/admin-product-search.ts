export function normalizeProductSearch(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

export function matchesProductSearch(displayName: string, query: string): boolean {
  const searchable = normalizeProductSearch(displayName);
  return normalizeProductSearch(query)
    .split(' ')
    .filter(Boolean)
    .every((token) => searchable.includes(token));
}
