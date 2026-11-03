import type { CanonicalAlias } from '../agent-platform/canonical-alias-contract';
import { normalizeAliasLabel } from '../agent-platform/canonical-alias-contract';
import type { ReviewQueueItem } from '../agent-platform/review-contract';
import type {
  SpecAlias27, SpecFinding27, SpecReconciliation27, SpecTarget27,
} from './spec-agent-reconciliation';

export interface SpecCanonicalCatalogEntry27 {
  specCode: string;
  canonicalId: string;
  kind: 'binary' | 'numeric' | 'scale';
}

/** Reuse the approved alias ledger; no parallel mutable Spec-Agent dictionary. */
export function projectApprovedSpecAliases27(input: {
  entries: readonly CanonicalAlias[];
  catalog: readonly SpecCanonicalCatalogEntry27[];
  market: string;
  locale: string;
  categoryKey: string;
  sourceContextKey: string;
}): readonly SpecAlias27[] {
  const byId = new Map(input.catalog.map(s => [s.canonicalId,s]));
  const projected: SpecAlias27[] = [];
  for (const alias of input.entries) {
    if (alias.status !== 'CONFIRMED' || alias.scope.kind !== 'SPEC_FIELD') continue;
    const scope = alias.scope;
    if (scope.locale !== input.locale || scope.categoryKey !== input.categoryKey ||
        scope.sourceContextKey !== input.sourceContextKey) continue;
    const field = byId.get(alias.canonicalId);
    if (!field || field.kind !== scope.valueType) continue;
    // Existing alias contracts already normalize and audit each approved decision.
    if (alias.normalizedLabel !== normalizeAliasLabel(alias.rawLabel)) continue;
    projected.push({alias:alias.rawLabel,specCode:field.specCode,approved:true});
  }
  return projected;
}

/**
 * Draft review projection only. The server remains responsible for durable IDs,
 * idempotency, snapshots, authorization and transactional decision application.
 */
export function projectSpecReviewCandidates27(input: {
  reconciliation: SpecReconciliation27;
  observedAt: string;
}): readonly Pick<ReviewQueueItem,
  'caseKind'|'sourceAgent'|'sourceFindingType'|'businessKey'|'title'|
  'shortDescription'|'recommendation'|'confidence'|'evidenceCount'|
  'primaryEvidenceUrl'|'evidencePreview'|'observedAt'|'status'
>[] {
  const {reconciliation,observedAt} = input;
  const target: SpecTarget27 = reconciliation.target;
  const key = [target.productId,target.modelYear].join(':');
  return reconciliation.findings.map((finding: SpecFinding27) => {
    const ambiguous = finding.code !== 'UNKNOWN_ALIAS';
    return {
      caseKind: ambiguous ? 'SPEC_AMBIGUOUS' as const : 'SPEC_NEW' as const,
      sourceAgent:'SPEC_INTELLIGENCE',
      sourceFindingType:finding.code,
      businessKey:key,
      title:`${target.brand} ${target.model} ${target.version}: ${finding.label}`,
      shortDescription:finding.message,
      recommendation:ambiguous ? 'Revisar evidências e reconciliar' : 'Mapear para especificação canônica ou propor nova',
      confidence:null,
      evidenceCount:finding.evidence ? 1 : 0,
      primaryEvidenceUrl:finding.evidence?.sourceUrl ?? null,
      evidencePreview:finding.evidence ? `Documento ${finding.evidence.sourceId}, página ${finding.evidence.documentPage ?? 'n/d'}` : null,
      observedAt,
      status:'WAITING' as const,
    };
  });
}
