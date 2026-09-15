import { validateModelYearSources } from './model-year-evidence';
import {
  myTokens,
  structuredVersionMatches,
  structuredRowValid,
  validFipeCode,
} from './model-year-structured-match';
import type { OfficialBrandSource } from './new-product-check-types';
import type {
  ModelYearGroup,
  ModelYearMode,
  ModelYearObservation,
  ModelYearResearchProvider,
  ModelYearResearchResult,
  ModelYearResearchTarget,
  ModelYearSearchAttempt,
  RejectedModelYearObservation,
  StructuredModelYearProvider,
  StructuredModelYearRow,
  ModelYearRejectionCode,
} from './model-year-types';
export {
  structuredVersionMatches,
  structuredRowValid,
  validFipeCode,
} from './model-year-structured-match';
export function groupModelYearTargets(
  targets: readonly ModelYearResearchTarget[],
): ModelYearGroup[] {
  const groups = new Map<string, ModelYearGroup>();
  for (const target of targets) {
    const { brand, model } = target.officialIdentity;
    const key = JSON.stringify([myTokens(brand), myTokens(model)]);
    const existing = groups.get(key);
    groups.set(key, { key, brand, model, targets: [...(existing?.targets ?? []), target] });
  }
  return [...groups.values()];
}
export function structuredRejection(
  target: ModelYearResearchTarget,
  row: StructuredModelYearRow | null,
  reasonCode: ModelYearRejectionCode,
): RejectedModelYearObservation {
  return {
    sourceKind: row?.sourceKind,
    observedVersionLabel: row?.versionLabel.slice(0, 500),
    targetKey: target.targetKey,
    requestedTargetKey: target.targetKey,
    catalogIdentity: target.canonicalCatalogIdentity,
    officialIdentity: target.officialIdentity,
    proposedModelYear: row?.modelYear ?? null,
    sourceTier: 'STRUCTURED_AUTOMOTIVE_DATA',
    sourceUrl: row && structuredRowValid(row) ? row.sourceUrl : null,
    sourceDomain: row && structuredRowValid(row) ? 'www.webmotors.com.br' : null,
    applicability: 'EXACT_VERSION',
    reasonCode,
  };
}
export function matchStructuredRows(
  group: ModelYearGroup,
  rows: readonly StructuredModelYearRow[],
) {
  const observations: ModelYearObservation[] = [],
    rejections: RejectedModelYearObservation[] = [];
  let matched = 0,
    rejected = 0;
  for (const row of rows) {
    const candidates = group.targets.filter((t) => structuredVersionMatches(row, t));
    const reason = !structuredRowValid(row)
      ? 'STRUCTURED_YEAR_PAGE_INVALID'
      : candidates.length === 0
        ? 'STRUCTURED_VERSION_NOT_MATCHED'
        : candidates.length > 1 ||
            (candidates.length === 1 &&
              new Set(
                rows
                  .filter(
                    (r) =>
                      r.modelYear === row.modelYear && structuredVersionMatches(r, candidates[0]!),
                  )
                  .map((r) => myTokens(r.versionLabel).sort().join(' ')),
              ).size > 1)
          ? 'STRUCTURED_VERSION_AMBIGUOUS'
          : null;
    if (reason) {
      rejected++;
      for (const t of candidates.length ? candidates : group.targets)
        rejections.push(structuredRejection(t, row, reason));
      continue;
    }
    const target = candidates[0]!;
    const code = row.fipeCode?.trim();
    if (code && !validFipeCode(code))
      rejections.push(structuredRejection(target, row, 'FIPE_CODE_INVALID'));
    matched++;
    const excerpt = [row.brand, row.model, 'MY', row.modelYear, row.versionLabel].join(' ');
    observations.push({
      targetKey: target.targetKey,
      modelYear: row.modelYear,
      confidence: 1,
      applicability: 'EXACT_VERSION',
      sourceTier: 'STRUCTURED_AUTOMOTIVE_DATA',
      sourceKind: row.sourceKind,
      structuredRow: row,
      fipeCodeCandidates:
        code && validFipeCode(code)
          ? [
              {
                code,
                sourceKind: row.sourceKind,
                sourceUrl: row.sourceUrl,
                modelYear: row.modelYear,
                observedVersionLabel: row.versionLabel,
              },
            ]
          : [],
      evidence: [
        {
          url: row.sourceUrl,
          title: row.versionLabel,
          excerpt,
          evidenceType: 'OTHER_OFFICIAL',
          role: 'MY_ASSERTION',
          contextId: 'structured-version-row',
          contextText: excerpt,
          yearSemantics: 'EXPLICIT_MY',
        },
      ],
    });
  }
  return { observations, rejections, matched, rejected };
}
/** Owns fallback decisions after deterministic validation, never after an LLM self-report. */
export class StructuredFirstModelYearResearch implements ModelYearResearchProvider {
  constructor(
    private readonly options: {
      structured: StructuredModelYearProvider;
      mode?: ModelYearMode;
      fallback?: (
        stage: 'MANUFACTURER_OFFICIAL' | 'AUTHORIZED_DEALER',
      ) => Promise<ModelYearResearchProvider>;
      allowDealer?: boolean;
      maxOpenAiModelGroups?: number;
    },
  ) {}
  async researchModelYears(
    targets: readonly ModelYearResearchTarget[],
    source: OfficialBrandSource,
  ): Promise<ModelYearResearchResult> {
    const groups = groupModelYearTargets(targets),
      observations: ModelYearObservation[] = [],
      rejections: RejectedModelYearObservation[] = [],
      searchAttempts: ModelYearSearchAttempt[] = [];
    const metrics: Record<string, number> = {
      modelGroups: groups.length,
      structuredModelFetches: 0,
      structuredYearFetches: 0,
      structuredRowsParsed: 0,
      structuredRowsMatched: 0,
      structuredRowsRejected: 0,
      openAiModelGroupsResearched: 0,
      dealerModelGroupsResearched: 0,
      skippedDueToBudget: 0,
    };
    this.options.structured.beginRun?.();
    for (const group of groups) {
      try {
        const result = await this.options.structured.discover(
          group,
          this.options.mode ?? 'MONITOR',
        );
        for (const [k, v] of Object.entries(result.metrics)) metrics[k] = (metrics[k] ?? 0) + v;
        const matched = matchStructuredRows(group, result.rows);
        observations.push(...matched.observations);
        rejections.push(...matched.rejections);
        metrics.structuredRowsMatched += matched.matched;
        metrics.structuredRowsRejected += matched.rejected;
        for (const issue of result.issues)
          for (const t of group.targets)
            rejections.push({
              ...structuredRejection(t, null, issue.reasonCode),
              sourceUrl: issue.sourceUrl,
              proposedModelYear: issue.modelYear,
            });
        for (const t of group.targets)
          searchAttempts.push({
            targetKey: t.targetKey,
            stage: 'STRUCTURED_AUTOMOTIVE_DATA',
            status: result.issues.length ? 'FAILED' : 'COMPLETED',
            webSearchCount: 0,
            errorCode: result.issues[0]?.reasonCode ?? null,
          });
      } catch {
        for (const t of group.targets) {
          rejections.push(structuredRejection(t, null, 'STRUCTURED_SOURCE_UNAVAILABLE'));
          searchAttempts.push({
            targetKey: t.targetKey,
            stage: 'STRUCTURED_AUTOMOTIVE_DATA',
            status: 'FAILED',
            webSearchCount: 0,
            errorCode: 'STRUCTURED_SOURCE_UNAVAILABLE',
          });
        }
      }
    }
    const unresolved = (group: ModelYearGroup) => {
      const accepted = new Set(
        validateModelYearSources(targets, observations, source).accepted.map(
          (a) => a.target.targetKey,
        ),
      );
      return group.targets.filter((t) => !accepted.has(t.targetKey));
    };
    if (this.options.fallback) {
      let jobs = 0;
      const limit = Math.max(0, Math.min(10, this.options.maxOpenAiModelGroups ?? 2));
      for (const stage of [
        'MANUFACTURER_OFFICIAL',
        ...(this.options.allowDealer ? ['AUTHORIZED_DEALER'] : []),
      ] as ('MANUFACTURER_OFFICIAL' | 'AUTHORIZED_DEALER')[]) {
        for (const group of groups) {
          const remaining = unresolved(group);
          if (!remaining.length) continue;
          if (jobs >= limit) {
            metrics.skippedDueToBudget++;
            continue;
          }
          jobs++;
          metrics[
            stage === 'MANUFACTURER_OFFICIAL'
              ? 'openAiModelGroupsResearched'
              : 'dealerModelGroupsResearched'
          ]++;
          try {
            const provider = await this.options.fallback(stage);
            const raw = await provider.researchModelYears(remaining, source);
            const data: ModelYearResearchResult = Array.isArray(raw)
              ? { observations: raw, searchAttempts: [] }
              : (raw as ModelYearResearchResult);
            observations.push(...data.observations);
            searchAttempts.push(...data.searchAttempts);
            rejections.push(...(data.rejections ?? []));
          } catch {
            for (const t of remaining)
              searchAttempts.push({
                targetKey: t.targetKey,
                stage,
                status: 'FAILED',
                webSearchCount: 0,
                errorCode: 'MODEL_YEAR_FALLBACK_UNAVAILABLE',
              });
          }
        }
      }
    }
    return {
      observations,
      rejections,
      searchAttempts,
      metrics,
      strategy: {
        mode: this.options.mode ?? 'MONITOR',
        allowDealer: this.options.allowDealer ?? false,
        maxOpenAiModelGroups: this.options.maxOpenAiModelGroups ?? 2,
      },
    };
  }
}
