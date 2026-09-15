import { isIP } from 'node:net';
import { canonicalAgentJson } from '../agent-platform/rules';
import { officialEvidenceUrl } from './official-product-sources';
import {
  structuredVersionMatches,
  structuredRowValid,
  validFipeCode,
} from './model-year-structured-match';
import type { OfficialBrandSource } from './new-product-check-types';
import type {
  ModelYearEvidence,
  ModelYearObservation,
  ModelYearResearchTarget,
  ModelYearSourceTier,
  ModelYearRejectionCode,
  RejectedModelYearObservation,
} from './model-year-types';
export function explicitModelYears(text: string): number[] {
  const years = new Set<number>();
  const expression =
    /\b(?:ano\s*[/\u2212\u2013-]\s*modelo|ano\s+modelo|modelo|linha|model\s+year|MY)\s*[:\u2212\u2013-]?\s*(\d{4})(?:\s*\/\s*(\d{4}))?\b/giu;
  for (const match of text.matchAll(expression)) years.add(Number(match[2] ?? match[1]));
  return [...years];
}
const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
const mentions = (text: string, label: string) =>
  !!normalize(label) && (' ' + normalize(text) + ' ').includes(' ' + normalize(label) + ' ');
export function modelYearSafeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      isIP(u.hostname) ||
      !u.hostname.includes('.') ||
      u.hostname.endsWith('.localhost') ||
      !/^[a-z0-9.-]+$/u.test(u.hostname)
    )
      return null;
    u.hash = '';
    return u.href.length <= 2000 ? u.href : null;
  } catch {
    return null;
  }
}
export const modelYearSourceDomain = (raw: string): string | null => {
  const url = modelYearSafeUrl(raw);
  return url ? new URL(url).hostname.replace(/^www\./u, '') : null;
};
const context = (e: ModelYearEvidence) => e.contextText ?? e.excerpt ?? '';
function validContext(e: ModelYearEvidence): boolean {
  const text = context(e),
    excerpt = e.excerpt ?? '';
  return (
    !!excerpt.trim() &&
    excerpt.length <= 1000 &&
    text.length <= 2000 &&
    !/<(?:html|script)|data:[^;]+;base64,/iu.test(text) &&
    text.replace(/\s+/gu, ' ').includes(excerpt.replace(/\s+/gu, ' ')) &&
    (!e.contextText || !!e.contextId?.trim())
  );
}
function contextKey(e: ModelYearEvidence): string {
  return canonicalAgentJson([modelYearSafeUrl(e.url), e.contextId ?? '', context(e)]);
}
function supportsYear(e: ModelYearEvidence, o: ModelYearObservation, official: boolean): boolean {
  const text = e.excerpt ?? '';
  if (explicitModelYears(text).includes(o.modelYear)) return true;
  // A manual heading needs an explicit vehicle-model-year label in the enclosing block.
  return (
    official &&
    e.yearSemantics === 'VEHICLE_MODEL_YEAR' &&
    /\bmanual\b/iu.test(text) &&
    new RegExp('\\b' + o.modelYear + '\\b', 'u').test(text) &&
    /ano[\s/-]*modelo|model year/iu.test(context(e))
  );
}
function bindingReason(
  e: ModelYearEvidence,
  o: ModelYearObservation,
  t: ModelYearResearchTarget,
  official: boolean,
): ModelYearRejectionCode | null {
  if (!validContext(e) || explicitModelYears(context(e)).length > 1)
    return 'INVALID_EVIDENCE_CONTEXT';
  if (!supportsYear(e, o, official)) return 'NO_EXPLICIT_MY';
  const text = context(e);
  if (!mentions(text, t.officialIdentity.model)) return 'MODEL_NOT_BOUND';
  const labels = [t.officialIdentity.officialVersionLabel, ...t.knownAliases];
  if (o.applicability === 'MODEL_LINE' && t.structuredIdentity.trim)
    labels.push(t.structuredIdentity.trim);
  const bound = labels.filter((l) => mentions(text, l));
  if (!bound.length) return 'VERSION_NOT_BOUND';
  const plain = normalize(text);
  if (
    bound.some((l) =>
      ['nao inclui ', 'exceto ', 'exclui ', 'excluding ', 'except ', 'not available for '].some(
        (prefix) => plain.includes(prefix + normalize(l)),
      ),
    )
  )
    return 'APPLICABILITY_NOT_PROVEN';
  if (
    o.applicability === 'MODEL_LINE' &&
    !/\b(?:linha|versoes|inclui|disponivel|a partir|manual|model line)\b/u.test(plain)
  )
    return 'MODEL_LINE_NOT_BOUND';
  return null;
}
export interface ValidatedModelYearSource {
  readonly target: ModelYearResearchTarget;
  readonly observation: ModelYearObservation;
  readonly sourceTier: ModelYearSourceTier;
  readonly sourceDomain: string;
}
export function validateModelYearSources(
  targets: readonly ModelYearResearchTarget[],
  observations: readonly ModelYearObservation[],
  source: OfficialBrandSource,
) {
  const rejected: RejectedModelYearObservation[] = [];
  const candidates: ValidatedModelYearSource[] = [];
  let rejectedExternalEvidence = 0;
  const reject = (
    o: ModelYearObservation,
    t: ModelYearResearchTarget | undefined,
    reasonCode: ModelYearRejectionCode,
    e?: ModelYearEvidence,
  ) => {
    const raw = e?.url ?? o.evidence.find((e) => e.role !== 'DEALER_AUTHORIZATION')?.url ?? '';
    rejected.push({
      targetKey: o.targetKey.slice(0, 200),
      requestedTargetKey: o.requestedTargetKey?.slice(0, 200) ?? null,
      catalogIdentity: t?.canonicalCatalogIdentity ?? null,
      officialIdentity: t?.officialIdentity ?? null,
      proposedModelYear: Number.isFinite(o.modelYear) ? o.modelYear : null,
      sourceTier: (officialEvidenceUrl(raw, source)
        ? 'MANUFACTURER_OFFICIAL'
        : (o.sourceTier ?? 'MANUFACTURER_OFFICIAL')
      ).slice(0, 60),
      sourceUrl: modelYearSafeUrl(raw),
      sourceDomain: modelYearSourceDomain(raw),
      applicability: String(o.applicability).slice(0, 40),
      reasonCode,
    });
  };
  for (const o of [...observations].sort((a, b) =>
    canonicalAgentJson(a).localeCompare(canonicalAgentJson(b)),
  )) {
    const target = targets.find((t) => t.targetKey === o.targetKey);
    if (!target || (o.requestedTargetKey !== undefined && o.requestedTargetKey !== o.targetKey)) {
      reject(
        o,
        target ?? targets.find((t) => t.targetKey === o.requestedTargetKey),
        'INVALID_TARGET',
      );
      continue;
    }
    if (!Number.isInteger(o.modelYear) || o.modelYear < 1000 || o.modelYear > 9999) {
      reject(o, target, 'INVALID_YEAR');
      continue;
    }
    if (!Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1) {
      reject(o, target, 'INVALID_CONFIDENCE');
      continue;
    }
    if (!['EXACT_VERSION', 'MODEL_LINE'].includes(o.applicability)) {
      reject(o, target, 'APPLICABILITY_NOT_PROVEN');
      continue;
    }
    if (o.sourceTier === 'STRUCTURED_AUTOMOTIVE_DATA') {
      const row = o.structuredRow;
      if (
        !row ||
        !structuredRowValid(row) ||
        row.modelYear !== o.modelYear ||
        row.sourceKind !== o.sourceKind
      ) {
        reject(o, target, 'STRUCTURED_YEAR_PAGE_INVALID');
        continue;
      }
      const matches = targets.filter((t) => structuredVersionMatches(row, t));
      if (matches.length !== 1 || matches[0]!.targetKey !== target.targetKey) {
        reject(
          o,
          target,
          matches.length > 1 ? 'STRUCTURED_VERSION_AMBIGUOUS' : 'STRUCTURED_VERSION_NOT_MATCHED',
        );
        continue;
      }
      const excerpt = [row.brand, row.model, 'MY', row.modelYear, row.versionLabel].join(' ');
      candidates.push({
        target,
        sourceTier: 'STRUCTURED_AUTOMOTIVE_DATA',
        sourceDomain: new URL(row.sourceUrl).hostname,
        observation: {
          ...o,
          fipeCodeCandidates:
            row.fipeCode && validFipeCode(row.fipeCode)
              ? [
                  {
                    code: row.fipeCode.trim(),
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
        },
      });
      continue;
    }
    const requestedTier = o.sourceTier ?? 'MANUFACTURER_OFFICIAL';
    const assertionEvidence = o.evidence.filter((e) => !e.role || e.role === 'MY_ASSERTION');
    if (!assertionEvidence.length) {
      reject(o, target, 'INVALID_EVIDENCE_CONTEXT');
      continue;
    }
    const valid: { e: ModelYearEvidence; domain: string; tier: ModelYearSourceTier }[] = [];
    for (const e of assertionEvidence) {
      const domain = modelYearSourceDomain(e.url),
        official = !!officialEvidenceUrl(e.url, source);
      const tier = official ? 'MANUFACTURER_OFFICIAL' : requestedTier;
      if (
        !domain ||
        (tier === 'MANUFACTURER_OFFICIAL' && !official) ||
        !['MANUFACTURER_OFFICIAL', 'AUTHORIZED_DEALER'].includes(tier)
      ) {
        rejectedExternalEvidence++;
        reject(o, target, 'EXTERNAL_SOURCE_NOT_APPROVED', e);
        continue;
      }
      if (tier === 'AUTHORIZED_DEALER') {
        const dealer = o.dealer;
        const authorization =
          dealer &&
          domain === dealer.domain.toLowerCase().replace(/^www\./u, '') &&
          o.evidence.some(
            (a) =>
              a.role === 'DEALER_AUTHORIZATION' &&
              !!officialEvidenceUrl(a.url, source) &&
              validContext(a) &&
              mentions(context(a), dealer.name) &&
              mentions(context(a), domain) &&
              /concession|authorized dealer|rede autorizada/iu.test(context(a)),
          );
        if (!authorization || !dealer || !mentions(context(e), dealer.name)) {
          reject(o, target, 'DEALER_AUTHORIZATION_NOT_PROVEN', e);
          continue;
        }
      }
      if (
        tier !== 'MANUFACTURER_OFFICIAL' &&
        !mentions(context(e), target.officialIdentity.brand) &&
        !mentions(context(e), target.canonicalCatalogIdentity.brand)
      ) {
        reject(o, target, 'MODEL_NOT_BOUND', e);
        continue;
      }
      let failure = bindingReason(e, o, target, official);
      // Manuals may bind through another official, year-specific applicability context.
      if (
        failure === 'VERSION_NOT_BOUND' &&
        official &&
        e.yearSemantics === 'VEHICLE_MODEL_YEAR' &&
        o.applicability === 'MODEL_LINE'
      ) {
        const paired = o.evidence.find(
          (a) =>
            a.role === 'TARGET_APPLICABILITY' &&
            !!officialEvidenceUrl(a.url, source) &&
            bindingReason(a, o, target, true) === null,
        );
        if (paired) failure = null;
      }
      if (failure) {
        reject(o, target, failure, e);
        continue;
      }
      valid.push({
        e: {
          url: modelYearSafeUrl(e.url)!,
          title: e.title?.slice(0, 500) ?? null,
          excerpt: e.excerpt,
          evidenceType: e.evidenceType,
          role: e.role ?? 'MY_ASSERTION',
          contextId: e.contextId ?? null,
          contextText: context(e),
          yearSemantics: e.yearSemantics ?? null,
        },
        domain,
        tier,
      });
    }
    if (!valid.length) continue;
    // Invalid sources do not get smuggled into the union through a valid source.
    for (const group of [...new Set(valid.map((v) => v.tier + '|' + v.domain))]) {
      const grouped = valid.filter((v) => v.tier + '|' + v.domain === group);
      const { domain, tier } = grouped[0]!;
      const support = grouped.map((v) => v.e);
      const linked = o.evidence.filter(
        (e) =>
          validContext(e) &&
          ((e.role === 'DEALER_AUTHORIZATION' &&
            tier === 'AUTHORIZED_DEALER' &&
            !!officialEvidenceUrl(e.url, source) &&
            !!o.dealer &&
            mentions(context(e), o.dealer.name) &&
            mentions(context(e), domain)) ||
            (e.role === 'TARGET_APPLICABILITY' &&
              (support.some((s) => contextKey(s) === contextKey(e)) ||
                (tier === 'MANUFACTURER_OFFICIAL' &&
                  !!officialEvidenceUrl(e.url, source) &&
                  bindingReason(e, o, target, true) === null)))),
      );
      candidates.push({
        target,
        sourceTier: tier,
        sourceDomain: domain,
        observation: {
          targetKey: o.targetKey,
          modelYear: o.modelYear,
          confidence: o.confidence,
          applicability: o.applicability,
          sourceTier: tier,
          evidence: [
            ...support,
            ...linked.map((e) => ({
              url: modelYearSafeUrl(e.url)!,
              title: e.title?.slice(0, 500) ?? null,
              excerpt: e.excerpt,
              evidenceType: e.evidenceType,
              role: e.role,
              contextId: e.contextId ?? null,
              contextText: context(e),
              yearSemantics: e.yearSemantics ?? null,
            })),
          ],
        },
      });
    }
  }
  const unique = new Map<string, ValidatedModelYearSource>();
  for (const c of candidates) {
    const key = canonicalAgentJson([
        c.target.targetKey,
        c.observation.modelYear,
        c.sourceTier,
        c.sourceDomain,
      ]),
      prior = unique.get(key);
    if (prior) {
      const evidence = [
        ...new Map(
          [...prior.observation.evidence, ...c.observation.evidence].map((e) => [
            canonicalAgentJson(e),
            e,
          ]),
        ).values(),
      ];
      unique.set(key, {
        ...prior,
        observation: {
          ...prior.observation,
          confidence: Math.max(prior.observation.confidence, c.observation.confidence),
          fipeCodeCandidates: [
            ...new Map(
              [
                ...(prior.observation.fipeCodeCandidates ?? []),
                ...(c.observation.fipeCodeCandidates ?? []),
              ].map((f) => [canonicalAgentJson(f), f]),
            ).values(),
          ],
          evidence,
        },
      });
      reject(c.observation, c.target, 'DUPLICATE_OBSERVATION');
    } else unique.set(key, c);
  }
  const accepted = [...unique.values()];
  return { accepted, rejected, rejectedExternalEvidence };
}
