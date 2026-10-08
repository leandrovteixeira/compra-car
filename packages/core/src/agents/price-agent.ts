import { createHash, randomUUID } from 'node:crypto';
import type { AgentRunBundle } from '../agent-platform/types';
import { canonicalAgentJson } from '../agent-platform/rules';
import type { BrandConnector } from './brand-connector-types';
import type {
  PriceCatalogReader,
  PriceObservation,
  PriceResearchProvider,
  PriceTarget,
} from './price-agent-types';

const hash = (value: unknown) =>
  createHash('sha256').update(canonicalAgentJson(value)).digest('hex');

function cents(amount: string | null): number | null {
  if (!amount || !/^\d+(?:\.\d{2})$/u.test(amount)) return null;
  const n = Number(amount);
  return Number.isSafeInteger(Math.round(n * 100)) ? Math.round(n * 100) : null;
}

function currentPriceCents(target: PriceTarget): number | null {
  return cents(target.currentPrice?.money.amount ?? null);
}

export function reconcilePriceObservations(observations: readonly PriceObservation[]) {
  const accepted: PriceObservation[] = [];
  const rejected: { observation: PriceObservation; reason: string }[] = [];
  const byTarget = new Map<string, PriceObservation[]>();

  for (const observation of observations) {
    const list = byTarget.get(observation.target.productId) ?? [];
    list.push(observation);
    byTarget.set(observation.target.productId, list);
  }

  for (const list of byTarget.values()) {
    const valid = list.filter(
      (o) =>
        o.currencyCode === 'BRL' &&
        cents(o.msrpAmount) !== null &&
        o.confidence >= 0 &&
        o.confidence <= 1 &&
        o.evidence.length > 0,
    );
    if (!valid.length) {
      for (const observation of list)
        rejected.push({ observation, reason: 'NO_VALID_OFFICIAL_MSRP' });
      continue;
    }
    const amounts = [...new Set(valid.map((o) => o.msrpAmount))];
    if (amounts.length > 1) {
      for (const observation of valid)
        rejected.push({ observation, reason: 'CONFLICTING_OFFICIAL_MSRP' });
      continue;
    }
    accepted.push(
      [...valid].sort(
        (a, b) =>
          b.confidence - a.confidence ||
          b.evidence.length - a.evidence.length ||
          a.evidence[0]!.sourceUrl.localeCompare(b.evidence[0]!.sourceUrl),
      )[0]!,
    );
  }
  return { accepted, rejected };
}

export function mapPriceRunToPlatform(input: {
  runId: string;
  startedAt: string;
  completedAt: string;
  brand: string;
  market: string;
  provider: string;
  connector: BrandConnector;
  observations: readonly PriceObservation[];
  metrics: Readonly<Record<string, number>>;
}): AgentRunBundle {
  const reconciled = reconcilePriceObservations(input.observations);
  const findings = reconciled.accepted.flatMap((observation) => {
    const observed = cents(observation.msrpAmount),
      current = currentPriceCents(observation.target);
    if (observed === current) return [];

    const findingId = randomUUID();
    const findingType = current === null ? ('NEW_PRICE' as const) : ('PRICE_CHANGE' as const);
    const requiresReview = true; // pricing ADR: agents never publish financial data directly
    const deltaCents = current === null || observed === null ? null : observed - current;

    return [
      {
        finding: {
          id: findingId,
          runId: input.runId,
          findingType,
          fingerprint: hash([
            'price:v1',
            observation.target.productId,
            observation.msrpAmount,
            observation.validFrom,
          ]),
          subjectKey: observation.target.productId,
          title: [
            observation.target.brand,
            observation.target.model,
            observation.target.version,
            'MY',
            observation.target.modelYear,
          ].join(' '),
          summary:
            findingType === 'NEW_PRICE'
              ? 'Official MSRP observed for a product without current published MSRP.'
              : 'Official MSRP differs from the current published MSRP.',
          confidence: observation.confidence,
          requiresReview,
          subject: {
            productId: observation.target.productId,
            mmvIdentity: observation.target.mmvIdentity,
            modelYear: observation.target.modelYear,
          },
          proposal: {
            amount: observation.msrpAmount,
            currencyCode: 'BRL',
            startsOn: observation.validFrom,
            workflowStatus: 'needs_review',
          },
          payload: {
            priorPriceId: observation.target.currentPrice?.id ?? null,
            priorAmount: observation.target.currentPrice?.money.amount ?? null,
            observedAmount: observation.msrpAmount,
            deltaAmount:
              deltaCents === null ? null : (deltaCents / 100).toFixed(2),
            publicOfferAmount: observation.publicOfferAmount,
            retailBonusAmount: observation.retailBonusAmount,
            validFrom: observation.validFrom,
            validTo: observation.validTo,
            ambiguityReasons: [...observation.ambiguityReasons],
            connectorFingerprint: hash(input.connector),
          },
          createdAt: input.completedAt,
          updatedAt: input.completedAt,
        },
        evidence: observation.evidence.map((e) => ({
          id: randomUUID(),
          findingId,
          sourceType: e.sourceKind,
          sourceUrl: e.sourceUrl,
          sourceDomain: new URL(e.sourceUrl).hostname,
          title: null,
          excerpt: e.excerpt,
          evidenceFingerprint: hash(e),
          metadata: {
            locator: e.locator,
            contentHash: e.contentHash,
            cacheLineage: 'agent-shared-source-cache',
          },
          capturedAt: e.capturedAt,
          createdAt: input.completedAt,
        })),
      },
    ];
  });

  return {
    run: {
      id: input.runId,
      agentType: 'PRICE_INTELLIGENCE',
      status: 'COMPLETED',
      market: input.market,
      brand: input.brand,
      provider: input.provider,
      runMode: 'dry-run',
      schemaVersion: '22-price-v1',
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      input: { observationCount: input.observations.length },
      summary: {
        ...input.metrics,
        observationsAccepted: reconciled.accepted.length,
        observationsRejected: reconciled.rejected.length,
        NEW_PRICE: findings.filter((f) => f.finding.findingType === 'NEW_PRICE').length,
        PRICE_CHANGE: findings.filter((f) => f.finding.findingType === 'PRICE_CHANGE').length,
        unchangedPrices: reconciled.accepted.length - findings.length,
      },
      configSnapshot: {
        connectorFingerprint: hash(input.connector),
        persistence: 'review-only',
        llmPolicy: 'deterministic-first; Terra only on ambiguous official document; Sol repair only',
        sharedCache: 'reuse upstream official source snapshots before network or LLM',
      },
      error: null,
      sourceCommitSha: null,
      createdBy: null,
      createdAt: input.startedAt,
      updatedAt: input.completedAt,
    },
    findings,
  };
}

export class PriceAgent {
  constructor(
    private readonly ports: {
      catalog: PriceCatalogReader;
      research: PriceResearchProvider;
      connector: { getActiveConnector(brand: string, market: string): Promise<BrandConnector | null> };
    },
  ) {}

  async run(brand: string, market = 'BR', provider = 'deterministic', runId = randomUUID()) {
    const startedAt = new Date().toISOString();
    const connector = await this.ports.connector.getActiveConnector(brand, market);
    if (!connector) throw new Error('PRICE_CONNECTOR_REQUIRED');
    const targets = await this.ports.catalog.readPriceTargets(brand, market);
    this.ports.research.beginRun?.();
    const research = await this.ports.research.researchPrices(targets, connector);
    const completedAt = new Date().toISOString();
    return {
      targets,
      research,
      bundle: mapPriceRunToPlatform({
        runId,
        startedAt,
        completedAt,
        brand,
        market,
        provider,
        connector,
        observations: research.observations,
        metrics: { ...research.metrics, targetsSelected: targets.length },
      }),
    };
  }
}
