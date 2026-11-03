import type { PriceTarget } from '@compra-car/core/agents';

/**
 * Official GWM Brazil product pages. This is a price-source profile, NOT a
 * canonical MMV/MY mapping: product-page evidence must still be reconciled.
 * Keep individual trim URLs distinct so HEV2 and PHEV19 never share a price.
 */
const BASE = 'https://www.gwmmotors.com.br/pt/modelos/';
const slugByModelAndTrim: Readonly<Record<string, string>> = {
  'haval h6|one': 'haval-h6-hev-one',
  'haval h6|hev2': 'haval-h6-hev',
  'haval h6|phev19': 'haval-h6-phev-19',
  'haval h6|phev35': 'haval-h6-phev-35',
  'haval h6|gt': 'haval-h6-gt',
  'haval h9|exclusive': 'haval-h9',
  'ora 03|ev58': 'ora-03-bev58',
  'ora 5|bev': 'ora5',
  'tank|300ht': 'tank-300',
  'wey 07|phev': 'wey-07',
};

function norm(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}
function trimKey(target: Pick<PriceTarget, 'model' | 'version'>): string | null {
  const model = norm(target.model);
  const version = norm(target.version);
  if (model === 'haval h6') {
    // Match long canonical powertrain descriptions, not only brand slugs.
    if (/^one\b/u.test(version)) return 'one';
    if (/^19\b/u.test(version) && /\bphev\b/u.test(version)) return 'phev19';
    if (/^35\b/u.test(version) && /\bphev\b/u.test(version)) return 'phev35';
    if (/^2\b/u.test(version) && /\bhev\b/u.test(version)) return 'hev2';
    if (/^gt\b/u.test(version)) return 'gt';
    return null;
  }
  if (model === 'haval h9') return 'exclusive';
  if (model === 'ora 03') return 'ev58';
  if (model === 'ora 5') return 'bev';
  if (model === 'tank' && /^300\s*ht\b|^300ht\b/u.test(version)) return '300ht';
  if (model === 'wey 07') return 'phev';
  return null;
}

export function officialGwmPricePageForTarget(
  target: Pick<PriceTarget, 'brand' | 'model' | 'version'>,
): string | null {
  if (norm(target.brand) !== 'gwm') return null;
  const key = trimKey(target);
  if (!key) return null;
  const slug = slugByModelAndTrim[norm(target.model) + '|' + key];
  return slug ? BASE + slug : null;
}

/** A canonical variant must never fetch another variant's dedicated page. */
export function isCompetingGwmProductPage(
  target: Pick<PriceTarget, 'brand' | 'model' | 'version'>,
  candidateUrl: string,
): boolean {
  const assigned = officialGwmPricePageForTarget(target);
  if (!assigned) return false;
  try {
    const url = new URL(candidateUrl);
    if (url.hostname !== 'www.gwmmotors.com.br') return false;
    return Object.values(slugByModelAndTrim).some(slug =>
      url.pathname.replace(/\/$/u, '') === '/pt/modelos/' + slug &&
      url.pathname !== new URL(assigned).pathname);
  } catch { return false; }
}

export interface OfficialGwmExtractedCandidate {
  readonly sourceUrl: string;
  readonly amount: string;
  readonly kind: 'MSRP' | 'SINGLE_PRICE' | 'PROMOTIONAL_PRICE';
  readonly candidateProductIds: readonly string[];
  readonly status: 'MATCHED' | 'AMBIGUOUS' | 'UNRESOLVED';
}

/**
 * Source-to-trim routing is deterministic when the manufacturer has a
 * dedicated page per trim. This narrows candidates but never proves MY.
 */
export function resolveGwmPageCandidates<T extends OfficialGwmExtractedCandidate>(
  targets: readonly PriceTarget[],
  candidates: readonly T[],
): readonly T[] {
  const byPage = new Map<string, string[]>();
  for (const target of targets) {
    const page = officialGwmPricePageForTarget(target);
    if (!page) continue;
    const ids = byPage.get(page) ?? [];
    ids.push(target.productId);
    byPage.set(page, ids);
  }
  return candidates.map(candidate => {
    const ids = byPage.get(candidate.sourceUrl);
    if (!ids?.length) return candidate;
    // Status stays ambiguous unless the page explicitly verifies MY.
    return {
      ...candidate,
      candidateProductIds: ids,
      status: candidate.status === 'MATCHED' ? 'MATCHED' : 'AMBIGUOUS',
    } as T;
  });
}

export function officialGwmProductPriceCoverage(
  targets: readonly PriceTarget[],
  candidates: readonly OfficialGwmExtractedCandidate[],
): {
  readonly expected: number;
  readonly priced: number;
  readonly missing: readonly { productId: string; url: string }[];
} {
  const missing: { productId: string; url: string }[] = [];
  let expected = 0;
  let priced = 0;
  for (const target of targets) {
    const url = officialGwmPricePageForTarget(target);
    if (!url) continue;
    expected++;
    const found = candidates.some(candidate =>
      candidate.sourceUrl === url &&
      (candidate.kind === 'MSRP' || candidate.kind === 'SINGLE_PRICE') &&
      /^\d+(?:\.\d{2})$/u.test(candidate.amount) &&
      Number(candidate.amount) >= 20000 && Number(candidate.amount) <= 5000000
    );
    if (found) priced++;
    else missing.push({ productId: target.productId, url });
  }
  return { expected, priced, missing };
}
