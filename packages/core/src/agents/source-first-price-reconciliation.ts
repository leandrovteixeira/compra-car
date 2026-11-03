import { extractUniversalPriceCandidates } from './universal-price-extractor';
import { matchRawPrice } from './raw-price-matching';
import type { PriceObservation, PriceSourceSnapshot, PriceTarget } from './price-agent-types';

export interface SourceFirstPriceCandidate {
  readonly sourceUrl: string;
  readonly amount: string;
  readonly method: 'HTML_LABEL' | 'JSON_LD';
  readonly kind: 'MSRP' | 'SINGLE_PRICE' | 'PROMOTIONAL_PRICE';
  readonly status: 'MATCHED' | 'AMBIGUOUS' | 'UNRESOLVED';
  readonly candidateProductIds: readonly string[];
  readonly reason: 'CONFIRMED_IDENTITY' | 'IDENTITY_OR_MY_UNVERIFIED' |
    'PROMOTIONAL_NOT_MSRP' | 'STRUCTURED_OFFER_NOT_MSRP';
}

/**
 * Evaluate the official pages once, independently of the current MMVY.
 * Never infer MY from the only row in the catalog, or turn an ordinary Offer
 * or promotional price into a manufacturer's MSRP.
 */
export function reconcileSourceFirstPrices(
  snapshots: readonly PriceSourceSnapshot[],
  targets: readonly PriceTarget[],
): { observations: readonly PriceObservation[]; candidates: readonly SourceFirstPriceCandidate[] } {
  const observations: PriceObservation[] = [];
  const candidates: SourceFirstPriceCandidate[] = [];
  const visited = new Set<string>();
  const byId = new Map(targets.map(target => [target.productId, target]));

  for (const source of snapshots) {
    const sourceKey = source.finalUrl + '|' + source.contentHash;
    if (visited.has(sourceKey)) continue;
    visited.add(sourceKey);

    for (const raw of extractUniversalPriceCandidates(source.body)) {
      const match = matchRawPrice({
        amount: raw.amount,
        context: raw.context,
        label: raw.kind,
        versionHint: raw.versionHint,
        modelYearHint: raw.modelYearHint,
      }, source.finalUrl, targets);
      const isPublicMsrp = raw.method === 'HTML_LABEL' && raw.kind !== 'PROMOTIONAL_PRICE';
      const safelyMatched = isPublicMsrp && match.status === 'MATCHED' &&
        byId.has(match.productId);
      const candidateIds = match.status === 'MATCHED'
        ? [match.productId] : match.candidateIds;
      candidates.push({
        sourceUrl: source.finalUrl,
        amount: raw.amount,
        method: raw.method,
        kind: raw.kind,
        status: safelyMatched ? 'MATCHED' :
          match.status === 'MATCHED' ? 'AMBIGUOUS' : match.status,
        candidateProductIds: candidateIds,
        reason: !isPublicMsrp
          ? raw.kind === 'PROMOTIONAL_PRICE' ? 'PROMOTIONAL_NOT_MSRP' : 'STRUCTURED_OFFER_NOT_MSRP'
          : safelyMatched ? 'CONFIRMED_IDENTITY' : 'IDENTITY_OR_MY_UNVERIFIED',
      });

      if (!safelyMatched) continue;
      const target = byId.get(match.productId)!;
      observations.push({
        target,
        currencyCode: 'BRL',
        msrpAmount: raw.amount,
        publicOfferAmount: null,
        retailBonusAmount: null,
        validFrom: null,
        validTo: null,
        confidence: 0.93,
        ambiguityReasons: [],
        evidence: [{
          sourceUrl: source.finalUrl,
          sourceKind: source.sourceKind,
          contentHash: source.contentHash,
          locator: 'source-first:' + raw.method.toLowerCase(),
          excerpt: raw.context.slice(0, 700),
          capturedAt: source.fetchedAt,
        }],
      });
    }
  }
  return { observations, candidates };
}
