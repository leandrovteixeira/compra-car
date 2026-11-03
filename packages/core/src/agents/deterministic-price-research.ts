import { createHash } from 'node:crypto';
import type { BrandConnector } from './brand-connector-types';
import {
  priceContexts,
  priceSourceAppliesToModel,
  priceTargetBinding,
  priceVersionAliases,
} from './price-target-binding';
import {
  isConditionalCommercialText,
  priceSourceAllowed,
} from './price-source-policy';
import type {
  PriceEvidence,
  PriceAiUsage,
  PriceIdentityMapping,
  PriceReconciliationProvider,
  PriceObservation,
  PriceResearchProvider,
  PriceResearchResult,
  PriceSourceKind,
  PriceSourceSnapshot,
  PriceTarget,
} from './price-agent-types';

export function priceSourceFingerprint(body: string): string {
  const decoded = decodeHtmlEntities(body);
  const embeddedRows = [...decoded.matchAll(
    /"versionName"\s*:\s*"([^"]+)"[\s\S]{0,1800}?"price"\s*:\s*"([0-9]+(?:\.[0-9]+)?)"[\s\S]{0,700}?"year"\s*:\s*"(\d{4})"/giu,
  )]
    .map((match) => [match[1]!.trim(), match[2]!, match[3]!].join('|'))
    .sort();

  const stableText = decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/\b(?:NREUM|newrelic|bam\.nr-data\.net)\b[\s\S]{0,4000}/giu, ' ')
    .replace(/\b(?:timestamp|nonce|requestId|sessionId|traceId)\b\s*[:=]\s*["']?[^"'\s,}<]+/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 120000);

  return createHash('sha256')
    .update(JSON.stringify({ embeddedRows, stableText }))
    .digest('hex');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&#x([0-9a-f]+);/giu, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/gu, (_m, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
}

export function normalizePriceSourceText(body: string): string {
  return decodeHtmlEntities(body)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\\u00a0/giu, ' ')
    .replace(/\\u0024/giu, '$')
    .replace(/\\u002e/giu, '.')
    .replace(/\\u002c/giu, ',')
    .replace(/\\(["/])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function brl(raw: string): string | null {
  const normalized = raw.replace(/\s/gu, '').replace(/\./gu, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > 20_000_000) return null;
  return n.toFixed(2);
}

function money(text: string): string | null {
  const m = text.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/iu);
  return m ? brl(m[1]!) : null;
}

type EmbeddedVersionRow = {
  readonly versionName: string;
  readonly price: string;
  readonly year: number;
};

function embeddedVersionRows(body: string): readonly EmbeddedVersionRow[] {
  const decoded = decodeHtmlEntities(body);
  const rows: EmbeddedVersionRow[] = [];
  const pattern =
    /"versionName"\s*:\s*"([^"]+)"[\s\S]{0,1800}?"price"\s*:\s*"([0-9]+(?:\.[0-9]+)?)"[\s\S]{0,700}?"year"\s*:\s*"(\d{4})"/giu;
  for (const match of decoded.matchAll(pattern)) {
    const year = Number(match[3]);
    if (!Number.isInteger(year)) continue;
    rows.push({
      versionName: match[1]!.trim(),
      price: match[2]!,
      year,
    });
  }
  return rows;
}

function compactIdentity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\b(?:jeep)\b/gu, ' ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function structuredRowMatchesTarget(row: EmbeddedVersionRow, target: PriceTarget): boolean {
  if (row.year !== target.modelYear) return false;
  const rowText = compactIdentity(row.versionName);
  const model = compactIdentity(target.model);
  if (!rowText.includes(model)) return false;
  return priceVersionAliases(target).some((alias) => {
    const compactAlias = compactIdentity(alias);
    return compactAlias.length >= 4 && rowText.includes(compactAlias);
  });
}

function currentOfficialYearsForTarget(
  snapshots: readonly PriceSourceSnapshot[],
  target: PriceTarget,
): ReadonlySet<number> {
  const years = new Set<number>();
  for (const snapshot of snapshots) {
    if (!priceSourceAppliesToModel(snapshot, target)) continue;
    for (const row of embeddedVersionRows(snapshot.body)) {
      if (compactIdentity(row.versionName).includes(compactIdentity(target.model))) years.add(row.year);
    }
  }
  return years;
}

function extractEmbeddedStructuredPrice(
  snapshot: PriceSourceSnapshot,
  target: PriceTarget,
): PriceObservation | null {
  const matches = embeddedVersionRows(snapshot.body).filter((row) =>
    structuredRowMatchesTarget(row, target),
  );
  if (matches.length !== 1) return null;
  const row = matches[0]!;
  const n = Number(row.price);
  if (!Number.isFinite(n) || n <= 0 || n > 20_000_000) return null;
  const amount = n.toFixed(2);
  const excerpt = `${row.versionName} | price=${row.price} | year=${row.year}`;
  return {
    target,
    currencyCode: 'BRL',
    msrpAmount: amount,
    publicOfferAmount: null,
    retailBonusAmount: null,
    validFrom: null,
    validTo: null,
    confidence: 0.995,
    ambiguityReasons: [],
    evidence: [
      {
        sourceUrl: snapshot.finalUrl,
        sourceKind: snapshot.sourceKind,
        contentHash: snapshot.contentHash,
        locator: 'embedded:versions-data',
        excerpt,
        capturedAt: snapshot.fetchedAt,
      },
    ],
  };
}

function comparableSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin.toLowerCase() + url.pathname.replace(/\/$/u, '').toLowerCase();
  } catch {
    return null;
  }
}

function cachedUnchangedObservation(
  target: PriceTarget,
  snapshots: readonly PriceSourceSnapshot[],
): PriceObservation | null {
  if (!target.currentPrice || !target.knownPriceReconciliations?.length) return null;

  for (const cached of target.knownPriceReconciliations) {
    if (!cached.sourceFingerprint || cached.confidence < 0.8) continue;
    const sourceKey = comparableSourceUrl(cached.sourceUrl);
    if (!sourceKey) continue;
    const snapshot = snapshots.find(
      (candidate) =>
        comparableSourceUrl(candidate.finalUrl) === sourceKey &&
        candidate.contentHash === cached.sourceFingerprint,
    );
    if (!snapshot) continue;

    return {
      target,
      currencyCode: 'BRL',
      msrpAmount: target.currentPrice.money.amount,
      publicOfferAmount: null,
      retailBonusAmount: null,
      validFrom: null,
      validTo: null,
      confidence: Math.min(0.995, cached.confidence),
      ambiguityReasons: [],
      evidence: [
        {
          sourceUrl: snapshot.finalUrl,
          sourceKind: snapshot.sourceKind,
          contentHash: snapshot.contentHash,
          locator: 'cache:reconciliation-fingerprint',
          excerpt:
            cached.observedLabel +
            ' | unchanged source fingerprint | current published MSRP reused',
          capturedAt: snapshot.fetchedAt,
        },
      ],
    };
  }
  return null;
}

function targetKey(target: PriceTarget) {
  return [target.brand, target.model, target.version, target.modelYear]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

export function extractDeterministicPrice(
  snapshot: PriceSourceSnapshot,
  target: PriceTarget,
): PriceObservation | null {
  const body = normalizePriceSourceText(snapshot.body);
  if (!body || !priceSourceAppliesToModel(snapshot, target) || !priceTargetBinding(body, target)) return null;

  const contexts = priceContexts(snapshot.body, target);

  let msrpAmount: string | null = null,
    publicOfferAmount: string | null = null,
    retailBonusAmount: string | null = null,
    excerpt = '',
    confidence = 0;

  for (const part of contexts) {
    const msrp = part.match(
      /(?:pre[cç]o\s+(?:p[uú]blico\s+)?(?:sugerido|de\s+tabela)?|a\s+partir\s+de)\s*[:\-]?\s*(R\$\s*[0-9.]+(?:,[0-9]{2})?)/iu,
    );
    if (msrp) {
      const amount = money(msrp[1]!);
      if (amount) {
        msrpAmount = amount;
        excerpt ||= part.slice(0, 900);
        confidence = Math.max(confidence, /pre[cç]o\s+p[uú]blico/iu.test(part) ? 0.98 : 0.9);
      }
    }

    if (!msrpAmount && !isConditionalCommercialText(part)) {
      const rawPrice = part.match(/R\$\s*[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?/iu);
      if (rawPrice) {
        const amount = money(rawPrice[0]);
        if (amount) {
          msrpAmount = amount;
          excerpt ||= part.slice(0, 900);
          confidence = Math.max(confidence, 0.82);
        }
      }
    }

    const dePor = part.match(
      /de\s*(R\$\s*[0-9.]+(?:,[0-9]{2})?)\s+por\s*(R\$\s*[0-9.]+(?:,[0-9]{2})?)/iu,
    );
    if (dePor) {
      const from = money(dePor[1]!),
        to = money(dePor[2]!);
      if (from && to) {
        msrpAmount ??= from;
        publicOfferAmount = to;
        excerpt ||= part.slice(0, 900);
        confidence = Math.max(confidence, 0.84);
      }
    }

    const bonus = part.match(
      /(?:b[oô]nus(?:\s+varejo)?|retail\s+bonus)\s*(?:de)?\s*[:\-]?\s*(R\$\s*[0-9.]+(?:,[0-9]{2})?)/iu,
    );
    if (bonus && !isConditionalCommercialText(part)) {
      retailBonusAmount = money(bonus[1]!);
      excerpt ||= part.slice(0, 900);
    }
  }

  if (!msrpAmount) return null;
  const ambiguityReasons: string[] = [];
  if (publicOfferAmount && isConditionalCommercialText(excerpt))
    ambiguityReasons.push('CONDITIONAL_PUBLIC_OFFER');
  if (retailBonusAmount && isConditionalCommercialText(excerpt))
    ambiguityReasons.push('CONDITIONAL_RETAIL_BONUS');

  const evidence: PriceEvidence = {
    sourceUrl: snapshot.finalUrl,
    sourceKind: snapshot.sourceKind,
    contentHash: snapshot.contentHash,
    locator: 'deterministic:price-context',
    excerpt: excerpt || contexts.find((c) => c.includes('R$'))?.slice(0, 900) || 'Official price evidence',
    capturedAt: snapshot.fetchedAt,
  };

  return {
    target,
    currencyCode: 'BRL',
    msrpAmount,
    publicOfferAmount,
    retailBonusAmount,
    validFrom: null,
    validTo: null,
    confidence: ambiguityReasons.length ? Math.min(confidence, 0.7) : confidence,
    ambiguityReasons,
    evidence: [evidence],
  };
}

export class DeterministicFirstPriceResearch implements PriceResearchProvider {
  private snapshots = new Map<string, PriceSourceSnapshot>();

  constructor(
    private readonly ports: {
      upstreamCache?: {
        snapshots(
          targets: readonly PriceTarget[],
          connector: BrandConnector,
        ): Promise<readonly PriceSourceSnapshot[]>;
      };
      fetch: (
        target: PriceTarget,
        connector: BrandConnector,
      ) => Promise<readonly PriceSourceSnapshot[]>;
      documentIntelligence?: {
        extract(
          snapshot: PriceSourceSnapshot,
          target: PriceTarget,
        ): Promise<PriceObservation | null>;
      };
      reconciliation?: PriceReconciliationProvider;
      hardCostCapUsd?: number;
    },
  ) {}

  beginRun() {
    this.snapshots.clear();
  }

  async researchPrices(
    targets: readonly PriceTarget[],
    connector: BrandConnector,
  ): Promise<PriceResearchResult> {
    const observations: PriceObservation[] = [];
    const diagnostics: NonNullable<PriceResearchResult['diagnostics']>[number][] = [];
    const mappings: PriceIdentityMapping[] = [];
    const usage: PriceAiUsage[] = [];
    let cacheHits = 0,
      networkFetches = 0,
      deterministicExtractions = 0,
      documentIntelligenceCalls = 0,
      targetMisses = 0,
      pricePatternMisses = 0,
      modelSourceSkips = 0;
    const countedNetworkUrls = new Set<string>();

    const cached = (await this.ports.upstreamCache?.snapshots(targets, connector)) ?? [];
    for (const snapshot of cached) {
      if (!priceSourceAllowed(snapshot.finalUrl, connector.allowedDomains)) continue;
      this.snapshots.set(snapshot.targetKey + '|' + snapshot.finalUrl, snapshot);
      if (snapshot.reusable) cacheHits++;
    }

    for (const target of targets) {
      const key = targetKey(target);
      let sources = [...this.snapshots.values()].filter((s) => s.targetKey === key && s.reusable);
      if (!sources.length) {
        sources = [...(await this.ports.fetch(target, connector))].filter((s) =>
          priceSourceAllowed(s.finalUrl, connector.allowedDomains),
        );
        for (const source of sources) {
          if (!countedNetworkUrls.has(source.finalUrl)) {
            countedNetworkUrls.add(source.finalUrl);
            networkFetches++;
          }
          this.snapshots.set(source.targetKey + '|' + source.finalUrl, source);
        }
      }

      for (const source of sources) {
        if (!priceSourceAppliesToModel(source, target)) {
          modelSourceSkips++;
          continue;
        }

        const structured = extractEmbeddedStructuredPrice(source, target);
        if (structured) {
          observations.push(structured);
          deterministicExtractions++;
          continue;
        }

        const normalized = normalizePriceSourceText(source.body);
        if (!priceTargetBinding(normalized, target)) {
          targetMisses++;
          if (diagnostics.length < 40)
            diagnostics.push({
              target: [target.model, target.version, 'MY' + target.modelYear].join(' '),
              sourceUrl: source.finalUrl,
              reason: 'TARGET_MISS',
              sample: normalized.slice(0, 700),
            });
          continue;
        }
        const deterministic = extractDeterministicPrice(source, target);
        if (deterministic) {
          observations.push(deterministic);
          deterministicExtractions++;
          continue;
        }
        pricePatternMisses++;
        if (diagnostics.length < 40)
          diagnostics.push({
            target: [target.model, target.version, 'MY' + target.modelYear].join(' '),
            sourceUrl: source.finalUrl,
            reason: 'PRICE_PATTERN_MISS',
            sample: priceContexts(source.body, target)[0]?.slice(0, 900) ?? normalized.slice(0, 900),
          });
        if (!this.ports.documentIntelligence) continue;
        documentIntelligenceCalls++;
        const semantic = await this.ports.documentIntelligence.extract(source, target);
        if (semantic) observations.push(semantic);
      }
    }

    const initiallyResolved = new Set(observations.map((o) => o.target.productId));
    for (const target of targets) {
      if (initiallyResolved.has(target.productId)) continue;
      const relevantSnapshots = [...this.snapshots.values()].filter(
        (snapshot) => snapshot.targetKey === targetKey(target),
      );
      const cached = cachedUnchangedObservation(target, relevantSnapshots);
      if (cached) {
        observations.push(cached);
        cacheHits++;
      }
    }

    const resolved = new Set(observations.map((o) => o.target.productId));
    const unresolved = targets.filter((target) => !resolved.has(target.productId));
    const unresolvedEligibleForAi = unresolved.filter((target) => {
      const relevantSnapshots = [...this.snapshots.values()].filter(
        (snapshot) => snapshot.targetKey === targetKey(target),
      );
      const currentYears = currentOfficialYearsForTarget(relevantSnapshots, target);
      return currentYears.size === 0 || currentYears.has(target.modelYear);
    });
    if (unresolvedEligibleForAi.length && this.ports.reconciliation) {
      const spent = usage.reduce((sum, item) => sum + item.estimatedCostUsd, 0);
      const budget = Math.max(0, (this.ports.hardCostCapUsd ?? 1) - spent);
      if (budget > 0) {
        const semantic = await this.ports.reconciliation.reconcile(
          unresolvedEligibleForAi,
          connector,
          budget,
        );
        observations.push(...semantic.observations);
        mappings.push(...semantic.mappings);
        usage.push(...semantic.usage);
      }
    }

    const llmCost = usage.reduce((sum, item) => sum + item.estimatedCostUsd, 0);
    const llmCalls = usage.length;

    return {
      observations,
      snapshots: [...this.snapshots.values()],
      mappings,
      usage,
      diagnostics,
      metrics: {
        sourcesConsidered: new Set([...this.snapshots.values()].map((source) => source.finalUrl)).size,
        cacheHits,
        networkFetches,
        deterministicExtractions,
        documentIntelligenceCalls,
        llmCalls,
        llmInputTokens: usage.reduce((sum, item) => sum + item.inputTokens, 0),
        llmCachedInputTokens: usage.reduce((sum, item) => sum + item.cachedInputTokens, 0),
        llmOutputTokens: usage.reduce((sum, item) => sum + item.outputTokens, 0),
        llmReasoningTokens: usage.reduce((sum, item) => sum + item.reasoningTokens, 0),
        webSearchCount: usage.reduce((sum, item) => sum + item.webSearchCount, 0),
        targetMisses,
        pricePatternMisses,
        modelSourceSkips,
        uniqueNetworkUrls: countedNetworkUrls.size,
        solEscalations: usage.filter((item) => item.model === 'gpt-5.6-sol').length,
        estimatedCostUsd: llmCost,
      },
    };
  }
}

export function makePriceSnapshot(input: {
  target: PriceTarget;
  sourceUrl: string;
  sourceKind: PriceSourceKind;
  body: string;
  fetchedAt?: string;
  reusedFromAgentRunId?: string | null;
}): PriceSourceSnapshot {
  return {
    sourceUrl: input.sourceUrl,
    finalUrl: input.sourceUrl,
    sourceKind: input.sourceKind,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    contentType: 'text/html',
    contentHash: priceSourceFingerprint(input.body),
    targetKey: targetKey(input.target),
    body: input.body,
    reusedFromAgentRunId: input.reusedFromAgentRunId ?? null,
    reusable: true,
  };
}
