import { vehicleTextComparisonKey } from '../admin/vehicle-text-normalization';
import type { AgentMarketScope, OfficialBrandSource } from './new-product-check-types';

const toyota: OfficialBrandSource = Object.freeze({
  country: 'BR',
  brand: 'Toyota',
  allowedDomains: Object.freeze(['toyota.com.br', 'media.toyota.com.br']),
  allowedHosts: Object.freeze(['toyota.com.br', 'www.toyota.com.br', 'media.toyota.com.br']),
  searchHints: Object.freeze([
    'site:toyota.com.br modelos atuais Brasil',
    'site:media.toyota.com.br ficha técnica versões',
    'site:toyota.com.br configurador lista oficial versões',
    'Prioridade: ficha técnica, documento de versões, lista oficial (somente identidade), configurador, página de modelo, release',
  ]),
});
export function officialBrandSource(scope: AgentMarketScope): OfficialBrandSource {
  if (scope.country !== 'BR' || vehicleTextComparisonKey(scope.brand) !== 'toyota')
    throw new Error('UNSUPPORTED_AGENT_SCOPE');
  return toyota;
}
export function officialEvidenceUrl(raw: string, source: OfficialBrandSource): string | null {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !source.allowedHosts.includes(url.hostname)
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
