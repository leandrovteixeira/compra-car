export function normalizeVehicleSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function matchesVehicleSearch(displayName: string, query: string): boolean {
  const tokenize = (value: string) =>
    normalizeVehicleSearch(value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  const searchableTokens = tokenize(displayName);

  return tokenize(query).every((queryToken) =>
    searchableTokens.some((searchableToken) => searchableToken.startsWith(queryToken)),
  );
}
