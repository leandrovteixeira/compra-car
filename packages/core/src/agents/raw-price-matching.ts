import type { PriceTarget } from './price-agent-types';
import type { RawCommercialPrice } from './raw-commercial-price';

const norm = (value: string) => value.normalize('NFKD')
  .replace(/[\u0300-\u036f]/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/gu, ' ').trim();
const compact = (value: string) => norm(value).replace(/ /gu, '');

export type RawPriceMatch =
  | { status: 'MATCHED'; productId: string; price: RawCommercialPrice }
  | { status: 'AMBIGUOUS' | 'UNRESOLVED'; candidateIds: readonly string[]; price: RawCommercialPrice };

function versionLabels(target: PriceTarget): readonly string[] {
  const labels = [target.version, ...(target.knownPriceAliases ?? [])];
  // Reconcile Haval H6 "PHEV19" / "HEV2" with technical catalog
  // names such as "19 1.5 TGDI PHEV DHT" / "2 1.5 TGDI HEV DHT".
  const tokens = norm(target.version).split(' ');
  const trimNumber = tokens[0];
  const propulsion = tokens.find(token => token === 'phev' || token === 'hev');
  if (trimNumber && /^\d{1,2}$/u.test(trimNumber) && propulsion)
    labels.push(propulsion + trimNumber);
  return [...new Set(labels.map(norm).filter(label => label.length >= 2))];
}
function hasExplicitLabel(context: string, label: string): boolean {
  return (' ' + context + ' ').includes(' ' + label + ' ');
}

export function matchRawPrice(
  price: RawCommercialPrice,
  sourceUrl: string,
  targets: readonly PriceTarget[],
): RawPriceMatch {
  const context = norm(price.context);
  let path = '';
  try {
    path = compact(decodeURIComponent(new URL(sourceUrl).pathname));
  } catch {
    return { status: 'UNRESOLVED', candidateIds: [], price };
  }

  const models = targets.filter(target => {
    const model = compact(target.model);
    return model.length > 2 && (compact(context).includes(model) || path.includes(model));
  });
  if (!models.length) return { status: 'UNRESOLVED', candidateIds: [], price };

  // An explicitly published MY is mandatory for automatic mapping.
  // Missing MY is not inferred from the current canonical catalog.
  if (price.modelYearHint === null) {
    return { status: 'AMBIGUOUS', candidateIds: models.map(t => t.productId), price };
  }
  const byYear = models.filter(t => t.modelYear === price.modelYearHint);
  if (!byYear.length) return { status: 'UNRESOLVED', candidateIds: [], price };

  const byVersion = byYear.filter(t =>
    versionLabels(t).some(label => hasExplicitLabel(context, label)),
  );
  if (byVersion.length === 1) {
    return { status: 'MATCHED', productId: byVersion[0]!.productId, price };
  }
  return {
    status: 'AMBIGUOUS',
    candidateIds: (byVersion.length ? byVersion : byYear).map(t => t.productId),
    price,
  };
}
