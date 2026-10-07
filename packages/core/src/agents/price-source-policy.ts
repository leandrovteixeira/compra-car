import type { ConnectorSourceEntry } from './brand-connector-types';
import type { PriceSourceKind } from './price-agent-types';

export const PRICE_SOURCE_PRIORITY: readonly PriceSourceKind[] = [
  'OFFICIAL_PRICE_LIST',
  'OFFICIAL_CONFIGURATOR',
  'OFFICIAL_MODEL_PAGE',
  'OFFICIAL_STRUCTURED_DATA',
  'OFFICIAL_OFFER_PAGE',
];

export function connectorEntryPriceKind(entry: ConnectorSourceEntry): PriceSourceKind | null {
  switch (entry.type) {
    case 'PRICE_LIST':
      return 'OFFICIAL_PRICE_LIST';
    case 'CONFIGURATOR':
      return 'OFFICIAL_CONFIGURATOR';
    case 'MODEL_PAGE':
      return 'OFFICIAL_MODEL_PAGE';
    default:
      return null;
  }
}

export function isConditionalCommercialText(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
  return /\b(pcd|taxista|produtor rural|cnpj|pessoa juridica|usado|seminovo|trade[- ]?in|financiamento|entrada|parcelas?|fidelidade|loyalty)\b/u.test(
    normalized,
  );
}

export function priceSourceAllowed(url: string, allowedDomains: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const d = domain.toLowerCase().replace(/^www\./u, '');
    const h = hostname.replace(/^www\./u, '');
    return h === d || h.endsWith('.' + d);
  });
}
