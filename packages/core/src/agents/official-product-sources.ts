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
const jeep: OfficialBrandSource = Object.freeze({
  country: 'BR',
  brand: 'Jeep',
  allowedDomains: Object.freeze(['jeep.com.br']),
  allowedHosts: Object.freeze(['jeep.com.br', 'www.jeep.com.br', 'configurador.jeep.com.br']),
  allowedSubdomainRoots: Object.freeze(['jeep.com.br']),
  searchHints: Object.freeze([
    'site:jeep.com.br Jeep Brasil modelos atuais versões ano modelo',
    'site:jeep.com.br ficha técnica motor powertrain T270 T270 MHEV',
    'site:jeep.com.br monte o seu configurador Hurricane Hurricane Flex',
    'Preservar nomes comerciais de powertrain separados de trim e atributos técnicos; somente fatos explícitos.',
  ]),
});
const sources: readonly OfficialBrandSource[] = Object.freeze([toyota, jeep]);
export function officialBrandSource(scope: AgentMarketScope): OfficialBrandSource {
  const source = sources.find(
    (s) =>
      s.country === scope.country &&
      vehicleTextComparisonKey(s.brand) === vehicleTextComparisonKey(scope.brand),
  );
  if (!source) throw new Error('UNSUPPORTED_AGENT_SCOPE');
  return source;
}
function isAllowedHostname(hostname: string, source: OfficialBrandSource): boolean {
  if (source.allowedHosts.includes(hostname)) return true;
  return (source.allowedSubdomainRoots ?? []).some((root) => {
    if (!source.allowedDomains.includes(root)) return false;
    if (hostname === root) return true;
    if (!hostname.endsWith('.' + root)) return false;
    return hostname
      .slice(0, -(root.length + 1))
      .split('.')
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label));
  });
}
export function officialEvidenceUrl(raw: string, source: OfficialBrandSource): string | null {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !isAllowedHostname(url.hostname, source)
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
