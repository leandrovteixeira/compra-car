import { resolveCommercialPeriod } from '../admin/commercial-period';
import type { CommercialDocumentDomainMappingPeriod } from './commercial-document-domain-mapping';
import type { SemanticallyReconciledCommercialDocument } from './commercial-document-semantic-reconciliation';

export type CommercialDocumentPeriodResolution =
  | {
      readonly status: 'resolved';
      readonly source: 'batch' | 'document_validity' | 'document_competence';
      readonly period: CommercialDocumentDomainMappingPeriod;
    }
  | {
      readonly status: 'unavailable' | 'ambiguous';
      readonly reason:
        'INVALID_BATCH_COMPETENCE' | 'DOCUMENT_PERIOD_CONFLICT' | 'DOCUMENT_PERIOD_UNAVAILABLE';
    };

const competencePattern = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

const monthly = (competence: string): CommercialDocumentDomainMappingPeriod | undefined => {
  const resolved = resolveCommercialPeriod({ competence, kind: 'monthly' });
  return resolved.ok
    ? {
        competence: resolved.period.competence,
        kind: resolved.period.kind,
        startsOn: resolved.period.start,
        endsOn: resolved.period.end,
      }
    : undefined;
};

const validityPeriod = (
  startsOn: string,
  endsOn: string,
): CommercialDocumentDomainMappingPeriod | undefined => {
  const competence = startsOn.slice(0, 7);
  if (!competencePattern.test(competence) || !endsOn.startsWith(`${competence}-`)) return undefined;
  const fullMonth = monthly(competence);
  if (!fullMonth) return undefined;
  if (startsOn === fullMonth.startsOn && endsOn === fullMonth.endsOn) return fullMonth;
  const resolved = resolveCommercialPeriod({
    competence,
    kind: 'special',
    specialStart: startsOn,
    specialEnd: endsOn,
  });
  return resolved.ok
    ? {
        competence: resolved.period.competence,
        kind: resolved.period.kind,
        startsOn: resolved.period.start,
        endsOn: resolved.period.end,
      }
    : undefined;
};

export function resolveCommercialDocumentPeriod(input: {
  readonly batchCompetence: string | null;
  readonly semanticDocument: SemanticallyReconciledCommercialDocument;
}): CommercialDocumentPeriodResolution {
  const batchPeriod = input.batchCompetence ? monthly(input.batchCompetence) : undefined;
  if (input.batchCompetence && !batchPeriod)
    return { status: 'unavailable', reason: 'INVALID_BATCH_COMPETENCE' };

  const candidates = input.semanticDocument.documents.flatMap((document) => [
    ...document.competenceCandidates.map((candidate) => ({
      kind: 'competence' as const,
      value: candidate.value,
      ambiguous: candidate.confidence.ambiguous || candidate.confidence.requiresReview,
    })),
    ...document.validityCandidates.map((candidate) => ({
      kind: 'validity' as const,
      value:
        candidate.startsOn && candidate.endsOn ? `${candidate.startsOn}/${candidate.endsOn}` : '',
      ambiguous:
        candidate.confidence.ambiguous ||
        candidate.confidence.requiresReview ||
        !candidate.startsOn ||
        !candidate.endsOn,
    })),
  ]);
  if (candidates.some((candidate) => candidate.ambiguous))
    return { status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' };

  const competences = new Set<string>();
  const validityPeriods = new Map<string, CommercialDocumentDomainMappingPeriod>();
  for (const candidate of candidates) {
    if (candidate.kind === 'competence') {
      if (!competencePattern.test(candidate.value))
        return { status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' };
      competences.add(candidate.value);
      continue;
    }
    const [startsOn, endsOn] = candidate.value.split('/') as [string, string];
    const period = validityPeriod(startsOn, endsOn);
    if (!period) return { status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' };
    competences.add(period.competence);
    validityPeriods.set(`${period.startsOn}/${period.endsOn}`, period);
  }

  if (batchPeriod) {
    if ([...competences].some((competence) => competence !== batchPeriod.competence))
      return { status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' };
    return { status: 'resolved', source: 'batch', period: batchPeriod };
  }
  if (competences.size > 1 || validityPeriods.size > 1)
    return { status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' };
  if (validityPeriods.size === 1)
    return {
      status: 'resolved',
      source: 'document_validity',
      period: [...validityPeriods.values()][0]!,
    };
  if (competences.size === 1) {
    const period = monthly([...competences][0]!);
    if (period) return { status: 'resolved', source: 'document_competence', period };
  }
  return { status: 'unavailable', reason: 'DOCUMENT_PERIOD_UNAVAILABLE' };
}
