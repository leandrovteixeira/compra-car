import { createHash, randomUUID } from 'node:crypto';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type { AgentObject, AgentRunBundle } from '../agent-platform/types';
import { canonicalAgentJson } from '../agent-platform/rules';
import { catalogMmvIdentityId } from './catalog-mmv-identity';
import { officialEvidenceUrl } from './official-product-sources';
import { validateModelYearSources } from './model-year-evidence';
import {
  MODEL_YEAR_SOURCE_TIERS,
  type ModelYearSourceTier,
  type ModelYearResearchResult,
  type ModelYearSearchAttempt,
} from './model-year-types';
import type {
  AgentMarketScope,
  OfficialBrandSource,
  ProductCatalogReader,
} from './new-product-check-types';
import type { BrandConnectorResolver } from './brand-connector-resolver';
import type {
  MmvDiscoveryContext,
  MmvDiscoveryReader,
  ModelYearObservation,
  ModelYearResearchProvider,
  ModelYearResearchTarget,
} from './model-year-types';
const hash = (v: unknown) => createHash('sha256').update(canonicalAgentJson(v)).digest('hex');
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const label = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export function knownModelYears(
  rows: readonly Pick<AdministrativeVehicle, 'modelYear'>[],
): number[] {
  return [
    ...new Set(
      rows.map((r) => r.modelYear).filter((y) => Number.isInteger(y) && y >= 1000 && y <= 9999),
    ),
  ].sort((a, b) => a - b);
}
export function buildModelYearTargets(
  context: MmvDiscoveryContext | null,
  rows: readonly AdministrativeVehicle[],
  scope: AgentMarketScope,
  source: OfficialBrandSource,
) {
  const targets: ModelYearResearchTarget[] = [];
  let skippedUnresolved = 0;
  if (
    !context ||
    context.run.agentType !== 'MMV_DISCOVERY' ||
    context.run.status !== 'COMPLETED' ||
    context.run.market !== scope.country ||
    context.run.brand?.toLowerCase() !== scope.brand.toLowerCase()
  )
    return { targets, skippedUnresolved };
  const groups = new Map<string, AdministrativeVehicle[]>();
  for (const row of rows) {
    if (row.brand.toLowerCase() !== scope.brand.toLowerCase()) continue;
    const id = catalogMmvIdentityId(row);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  for (const item of context.findings) {
    const f = item.finding;
    const identities = f.subject.canonicalMmv;
    const c = obj(f.payload.structuredCandidate);
    const identity = Array.isArray(identities) && identities.length === 1 ? obj(identities[0]) : {};
    const catalog = typeof identity.id === 'string' ? groups.get(identity.id) : undefined;
    const officialVersionLabel = label(c.officialVersionLabel),
      model = label(c.model),
      brand = label(c.brand);
    const evidence = item.evidence.flatMap((e) => {
      const url = officialEvidenceUrl(e.sourceUrl, source);
      return url
        ? [{ url, title: e.title, excerpt: e.excerpt, evidenceType: 'OTHER_OFFICIAL' as const }]
        : [];
    });
    if (
      f.runId !== context.run.id ||
      f.findingType !== 'MMV_MATCHED' ||
      ['REJECT', 'DEFER'].includes(item.latestReview?.decision ?? '') ||
      !catalog?.length ||
      !officialVersionLabel ||
      !model ||
      !brand ||
      brand.toLowerCase() !== scope.brand.toLowerCase() ||
      !evidence.length
    ) {
      skippedUnresolved++;
      continue;
    }
    const row = catalog[0]!;
    if (
      identity.brand !== row.brand ||
      identity.model !== row.model ||
      identity.canonicalVersionLabel !== row.version
    ) {
      skippedUnresolved++;
      continue;
    }
    const mmvIdentity = catalogMmvIdentityId(row);
    const officialIdentity = { brand, model, officialVersionLabel };
    const targetKey = hash(['my-target:v1', mmvIdentity, officialIdentity]);
    if (targets.some((t) => t.targetKey === targetKey)) continue;
    targets.push({
      targetKey,
      mmvIdentity,
      canonicalCatalogIdentity: { brand: row.brand, model: row.model, version: row.version },
      officialIdentity,
      structuredIdentity: {
        trim: label(c.trim),
        powertrainLabel: label(c.powertrainLabel),
        engineDisplacement:
          typeof c.engineDisplacement === 'number' && Number.isFinite(c.engineDisplacement)
            ? c.engineDisplacement
            : null,
        engineLabel: label(c.engineLabel),
        propulsion: label(c.propulsion),
        transmission: label(c.transmission),
        drivetrain: label(c.drivetrain),
      },
      knownAliases: [row.version, officialVersionLabel],
      knownModelYears: knownModelYears(catalog),
      discoveryEvidence: evidence,
    });
  }
  return { targets, skippedUnresolved };
}
export { explicitModelYears } from './model-year-evidence';
export function reconcileModelYears(
  targets: readonly ModelYearResearchTarget[],
  observations: readonly ModelYearObservation[],
  source: OfficialBrandSource,
) {
  const validated = validateModelYearSources(targets, observations, source);
  const accepted = new Map<
    string,
    {
      target: ModelYearResearchTarget;
      observation: ModelYearObservation;
      sourceTiers: ModelYearSourceTier[];
      sourceDomains: string[];
    }
  >();
  for (const c of validated.accepted) {
    const key = hash([c.target.mmvIdentity, c.observation.modelYear]),
      prior = accepted.get(key);
    const evidence = [
      ...new Map(
        [...(prior?.observation.evidence ?? []), ...c.observation.evidence].map((e) => [
          hash(e),
          e,
        ]),
      ).values(),
    ];
    const sourceTiers = [...new Set([...(prior?.sourceTiers ?? []), c.sourceTier])].sort(
      (a, b) => MODEL_YEAR_SOURCE_TIERS.indexOf(a) - MODEL_YEAR_SOURCE_TIERS.indexOf(b),
    );
    accepted.set(key, {
      target: prior?.target ?? c.target,
      observation: {
        ...c.observation,
        confidence: Math.max(prior?.observation.confidence ?? 0, c.observation.confidence),
        applicability:
          prior?.observation.applicability === 'EXACT_VERSION' ||
          c.observation.applicability === 'EXACT_VERSION'
            ? 'EXACT_VERSION'
            : 'MODEL_LINE',
        fipeCodeCandidates: [
          ...new Map(
            [
              ...(prior?.observation.fipeCodeCandidates ?? []),
              ...(c.observation.fipeCodeCandidates ?? []),
            ].map((f) => [hash(f), f]),
          ).values(),
        ],
        evidence,
      },
      sourceTiers,
      sourceDomains: [...new Set([...(prior?.sourceDomains ?? []), c.sourceDomain])].sort(),
    });
  }
  return {
    accepted: [...accepted.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
    acceptedSources: validated.accepted,
    rejectedDetails: validated.rejected,
    rejectedObservations: validated.rejected.length,
    rejectedExternalEvidence: validated.rejectedExternalEvidence,
  };
}
export function mapModelYearRunToPlatform(input: {
  runId: string;
  startedAt: string;
  completedAt: string;
  scope: AgentMarketScope;
  provider: string;
  targets: readonly ModelYearResearchTarget[];
  source: OfficialBrandSource;
  discoveryRunId: string | null;
  skippedUnresolved: number;
  observations: readonly ModelYearObservation[];
  reconciliation?: ReturnType<typeof reconcileModelYears>;
  searchAttempts?: readonly ModelYearSearchAttempt[];
  metrics?: Readonly<Record<string, number>>;
  strategy?: ModelYearResearchResult['strategy'];
}): AgentRunBundle {
  const result =
    input.reconciliation ?? reconcileModelYears(input.targets, input.observations, input.source);
  const findings = result.accepted.map(({ target, observation, sourceTiers, sourceDomains }) => {
    const id = randomUUID(),
      requiresReview = !target.knownModelYears.includes(observation.modelYear);
    return {
      finding: {
        id,
        runId: input.runId,
        findingType: requiresReview ? ('NEW_MODEL_YEAR' as const) : ('MODEL_YEAR_MATCHED' as const),
        fingerprint: hash(['model-year:v1', target.mmvIdentity, observation.modelYear]),
        subjectKey: target.mmvIdentity,
        title: [
          target.officialIdentity.brand,
          target.officialIdentity.model,
          target.officialIdentity.officialVersionLabel,
          'MY',
          observation.modelYear,
        ].join(' '),
        summary: requiresReview
          ? 'Supported MY absent from current catalog. Accept is review-only.'
          : 'Supported MY already represented in catalog.',
        confidence: observation.confidence,
        requiresReview,
        subject: { mmvIdentity: target.mmvIdentity, officialIdentity: target.officialIdentity },
        proposal: requiresReview
          ? { mmvIdentity: target.mmvIdentity, modelYear: observation.modelYear }
          : null,
        payload: {
          modelYear: observation.modelYear,
          sourceTiers,
          sourceKinds: [
            ...new Set(
              result.acceptedSources
                .filter(
                  (c) =>
                    c.target.targetKey === target.targetKey &&
                    c.observation.modelYear === observation.modelYear,
                )
                .map((c) => c.observation.sourceKind ?? c.sourceTier),
            ),
          ],
          fipeCodeCandidates: (observation.fipeCodeCandidates ?? []).map((f) => ({ ...f })),
          sourceDomains,
          knownModelYears: target.knownModelYears,
          officialIdentity: target.officialIdentity,
          canonicalCatalogIdentity: target.canonicalCatalogIdentity,
          applicability: observation.applicability,
          discoveryRunId: input.discoveryRunId,
          connectorFingerprint: hash(input.source),
          evidenceSummary: observation.evidence.map((e) => e.excerpt),
        },
        createdAt: input.completedAt,
        updatedAt: input.completedAt,
      },
      evidence: observation.evidence.map((e) => ({
        id: randomUUID(),
        findingId: id,
        sourceType:
          result.acceptedSources.find(
            (c) =>
              c.target.targetKey === target.targetKey &&
              c.observation.modelYear === observation.modelYear &&
              c.observation.evidence.some((item) => hash(item) === hash(e)),
          )?.observation.sourceKind ??
          e.evidenceType ??
          'OTHER_OFFICIAL',
        sourceUrl: e.url,
        sourceDomain: new URL(e.url).hostname,
        title: e.title,
        excerpt: e.excerpt,
        evidenceFingerprint: hash(e),
        metadata: {
          applicability: observation.applicability,
          sourceTiers,
          sourceTier: officialEvidenceUrl(e.url, input.source)
            ? 'MANUFACTURER_OFFICIAL'
            : (result.acceptedSources.find(
                (c) =>
                  c.target.mmvIdentity === target.mmvIdentity &&
                  c.observation.modelYear === observation.modelYear &&
                  c.observation.evidence.some((item) => hash(item) === hash(e)),
              )?.sourceTier ?? null),
          role: e.role ?? 'MY_ASSERTION',
          contextId: e.contextId ?? null,
          contextText: e.contextText ?? null,
          yearSemantics: e.yearSemantics ?? null,
        },
        capturedAt: input.completedAt,
        createdAt: input.completedAt,
      })),
    };
  });
  const researched = new Set(input.targets.map((t) => t.mmvIdentity)).size;
  const explicit = new Set(result.accepted.map((a) => a.target.mmvIdentity)).size;
  return {
    run: {
      id: input.runId,
      agentType: 'MODEL_YEAR',
      status: 'COMPLETED',
      market: input.scope.country,
      brand: input.scope.brand,
      provider: input.provider,
      runMode: 'dry-run',
      schemaVersion: '20.2-structured-v1',
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      input: { discoveryRunId: input.discoveryRunId, targetCount: input.targets.length },
      summary: {
        modelGroups: new Set(
          input.targets.map((t) =>
            JSON.stringify([
              t.officialIdentity.brand.toLowerCase(),
              t.officialIdentity.model.toLowerCase(),
            ]),
          ),
        ).size,
        structuredModelFetches: 0,
        structuredYearFetches: 0,
        structuredRowsParsed: 0,
        structuredRowsMatched: 0,
        structuredRowsRejected: 0,
        openAiModelGroupsResearched: 0,
        dealerModelGroupsResearched: 0,
        skippedDueToBudget: 0,
        ...input.metrics,
        fipeCodeCandidates: result.accepted.reduce(
          (n, a) => n + (a.observation.fipeCodeCandidates?.length ?? 0),
          0,
        ),
        eligibleMmvs: researched,
        targetsResearched: researched,
        targetsWithExplicitMy: explicit,
        targetsWithAnyExplicitMy: explicit,
        ...Object.fromEntries(
          MODEL_YEAR_SOURCE_TIERS.flatMap((tier, i) => {
            const items = result.acceptedSources.filter((s) => s.sourceTier === tier);
            return [
              [
                'targetsWith' + ['Structured', 'Official', 'Dealer'][i] + 'My',
                new Set(items.map((s) => s.target.mmvIdentity)).size,
              ],
              [['structured', 'official', 'dealer'][i] + 'ObservationsAccepted', items.length],
            ];
          }),
        ),
        rejectionsByReason: Object.fromEntries(
          [...new Set(result.rejectedDetails.map((r) => r.reasonCode))]
            .sort()
            .map((code) => [
              code,
              result.rejectedDetails.filter((r) => r.reasonCode === code).length,
            ]),
        ),
        searchStagesCompleted:
          input.searchAttempts?.filter((s) => s.status === 'COMPLETED').length ?? 0,
        searchStagesFailed: input.searchAttempts?.filter((s) => s.status === 'FAILED').length ?? 0,
        targetsWithoutExplicitMy: researched - explicit,
        explicitMyObservations: findings.length,
        skippedUnresolved: input.skippedUnresolved,
        rejectedExternalEvidence: result.rejectedExternalEvidence,
        rejectedObservations: result.rejectedObservations,
        MODEL_YEAR_MATCHED: findings.filter((f) => !f.finding.requiresReview).length,
        NEW_MODEL_YEAR: findings.filter((f) => f.finding.requiresReview).length,
      },
      configSnapshot: {
        connector: input.source as unknown as AgentObject,
        connectorFingerprint: hash(input.source),
        persistence: 'operational-only',
        researchStrategy: input.strategy ? { ...input.strategy } : null,
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
export class ModelYearAgent {
  constructor(
    private readonly ports: {
      catalog: ProductCatalogReader;
      discovery: MmvDiscoveryReader;
      connectorResolver: BrandConnectorResolver;
      research: ModelYearResearchProvider;
    },
  ) {}
  async run(scope: AgentMarketScope, provider: string, runId = randomUUID()) {
    const startedAt = new Date().toISOString();
    const source = await this.ports.connectorResolver.resolve(scope);
    if (
      source.country !== scope.country ||
      source.brand.toLowerCase() !== scope.brand.toLowerCase()
    )
      throw new Error('MODEL_YEAR_CONNECTOR_SCOPE');
    const context = await this.ports.discovery.latestCompleted(scope);
    const rows = await this.ports.catalog.readProducts(scope);
    const { targets, skippedUnresolved } = buildModelYearTargets(context, rows, scope, source);
    const researchResult = targets.length
      ? await this.ports.research.researchModelYears(targets, source)
      : [];
    const {
      observations,
      searchAttempts,
      rejections = [],
      metrics = {},
      strategy,
    } = Array.isArray(researchResult)
      ? { observations: researchResult as readonly ModelYearObservation[], searchAttempts: [] }
      : (researchResult as ModelYearResearchResult);
    const reconciliation = reconcileModelYears(targets, observations, source);
    reconciliation.rejectedDetails.push(...rejections);
    reconciliation.rejectedObservations += rejections.length;
    const bundle = mapModelYearRunToPlatform({
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      scope,
      provider,
      targets,
      source,
      discoveryRunId: context?.run.id ?? null,
      skippedUnresolved,
      observations,
      reconciliation,
      searchAttempts,
      metrics,
      strategy,
    });
    return {
      targets,
      bundle,
      rejectedObservations: reconciliation.rejectedDetails,
      searchAudit: targets.map((t) => ({
        targetKey: t.targetKey,
        officialIdentity: t.officialIdentity,
        knownModelYears: t.knownModelYears,
        searchAttempts: searchAttempts.filter((s) => s.targetKey === t.targetKey),
        acceptedModelYears: reconciliation.accepted
          .filter((a) => a.target.mmvIdentity === t.mmvIdentity)
          .map((a) => a.observation.modelYear),
        rejectedObservations: reconciliation.rejectedDetails.filter(
          (r) => r.targetKey === t.targetKey || r.requestedTargetKey === t.targetKey,
        ),
      })),
    };
  }
}
