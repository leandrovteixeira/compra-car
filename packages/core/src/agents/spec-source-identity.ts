import type { SpecObservation, SourceFact, SourceSnapshot, SourceScope } from './spec-source-types';
import { specText } from './spec-source';
export interface ObservedIdentityLink {
  sourceA: string;
  sourceB: string;
  from: { kind: 'VERSION' | 'MODEL' | 'ENGINE_GROUP'; label: string };
  to: {
    kind: 'ENGINE_DESIGNATION' | 'FUEL' | 'TRANSMISSION' | 'MODEL_YEAR_DOCUMENT' | 'ENGINE_GROUP';
    label: string;
  };
  model: string;
  modelYear: number | null;
  evidence: readonly SpecObservation['evidence'][];
}
export function validateObservedIdentityLink(link: ObservedIdentityLink): boolean {
  if (
    !link.evidence.length ||
    !link.model.trim() ||
    !link.from.label.trim() ||
    !link.to.label.trim()
  )
    return false;
  if (
    !link.evidence.some((e) => e.sourceUrl === link.sourceA) ||
    !link.evidence.some((e) => e.sourceUrl === link.sourceB)
  )
    return false;
  const text = specText(link.evidence.map((e) => e.evidenceText).join(' '));
  if (
    !text.includes(specText(link.model)) ||
    (link.modelYear !== null &&
      !new RegExp('(?:^|[^0-9])' + link.modelYear + '(?:[^0-9]|$)', 'u').test(text))
  )
    return false;
  return (
    [link.from.label, link.to.label].every((v) => text.includes(specText(v))) &&
    link.evidence.every((e) => !!e.locator && !!e.contentHash && /^https:\/\//u.test(e.sourceUrl))
  );
}
export function identityLinksFromFacts(
  facts: readonly SourceFact[],
  snapshot: SourceSnapshot,
): ObservedIdentityLink[] {
  const result: ObservedIdentityLink[] = [];
  for (const f of facts) {
    if (!f.scope.model || (!f.scope.version && !f.scope.engineDesignation)) continue;
    const label = specText(f.label);
    const kind = /fuel|combust|enginetypes/iu.test(label)
      ? 'FUEL'
      : /transmiss|cambio|geartypes/iu.test(label)
        ? 'TRANSMISSION'
        : /engine|motor/iu.test(label)
          ? 'ENGINE_DESIGNATION'
          : null;
    if (!kind) continue;
    const evidence = [
      ...(f.scope.applicabilityEvidence ?? []),
      {
        sourceUrl: snapshot.finalUrl,
        sourceKind: snapshot.sourceKind,
        contentHash: snapshot.contentHash,
        locator: f.locator,
        evidenceText: f.text,
      },
      ...(f.scope.evidenceText
        ? [
            {
              sourceUrl: snapshot.finalUrl,
              sourceKind: snapshot.sourceKind,
              contentHash: snapshot.contentHash,
              locator: f.locator + '/scope',
              evidenceText: f.scope.evidenceText,
            },
          ]
        : []),
    ];
    const link: ObservedIdentityLink = {
      sourceA: snapshot.finalUrl,
      sourceB: snapshot.finalUrl,
      model: f.scope.model,
      modelYear: f.scope.modelYear,
      from: {
        kind: f.scope.version ? 'VERSION' : 'ENGINE_GROUP',
        label: f.scope.version ?? f.scope.engineDesignation!,
      },
      to: { kind, label: f.value },
      evidence,
    };
    if (
      validateObservedIdentityLink(link) &&
      !result.some((l) => JSON.stringify(l) === JSON.stringify(link))
    )
      result.push(link);
  }
  return result;
}
/** No inference from trim name to displacement. Both explicit edges must share exact model + MY. */
export function provenEngineChain(
  scope: SourceScope,
  version: string,
  links: readonly ObservedIdentityLink[],
) {
  const valid = links.filter(
    (l) =>
      validateObservedIdentityLink(l) &&
      l.model === scope.model &&
      scope.modelYear !== null &&
      l.modelYear === scope.modelYear,
  );
  const first = valid.filter(
    (l) =>
      l.from.kind === 'VERSION' &&
      specText(l.from.label) === specText(version) &&
      l.to.kind === 'ENGINE_DESIGNATION',
  );
  for (const a of first)
    for (const b of valid) {
      if (
        b.from.kind === 'ENGINE_GROUP' &&
        b.to.kind === 'ENGINE_DESIGNATION' &&
        scope.engineDesignation &&
        specText(b.from.label) === specText(scope.engineDesignation) &&
        specText(b.to.label) === specText(a.to.label)
      )
        return [a, b];
    }
  return null;
}
