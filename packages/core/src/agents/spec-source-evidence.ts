import { specText } from './spec-source';
import type { SourceScope, SpecObservation, SpecSourceTarget } from './spec-source-types';
export interface SpecApplicabilityAssertion {
  scope: SourceScope;
  evidence: SpecObservation['evidence'];
}
/** Both sources need the same explicit MY and manufacturer identity. Same model alone is insufficient. */
export function joinSpecApplicability(
  factScope: SourceScope,
  assertions: readonly SpecApplicabilityAssertion[],
  target: SpecSourceTarget,
) {
  if (
    factScope.modelYear !== target.modelYear ||
    specText(factScope.model ?? '') !== specText(target.model)
  )
    return null;
  for (const assertion of assertions) {
    const a = assertion.scope;
    if (
      a.modelYear !== target.modelYear ||
      specText(a.model ?? '') !== specText(target.model) ||
      specText(a.version ?? '') !== specText(target.officialVersionLabel)
    )
      continue;
    if (factScope.version && specText(factScope.version) !== specText(a.version!)) continue;
    if (
      factScope.configurationId &&
      a.configurationId &&
      factScope.configurationId !== a.configurationId
    )
      continue;
    if (
      ['engineDesignation', 'fuel', 'transmission'].some((key) => {
        const f = factScope[key as keyof SourceScope],
          v = a[key as keyof SourceScope];
        return typeof f === 'string' && typeof v === 'string' && specText(f) !== specText(v);
      })
    )
      continue;
    const exactVersion =
      !!factScope.version && specText(factScope.version) === specText(a.version!);
    const explicitConfiguration =
      !!factScope.configurationId && factScope.configurationId === a.configurationId;
    const powertrain =
      factScope.component === 'POWERTRAIN' &&
      !!factScope.engineDesignation &&
      !!factScope.fuel &&
      !!factScope.transmission &&
      ['engineDesignation', 'fuel', 'transmission'].every(
        (k) =>
          specText(factScope[k as keyof SourceScope] as string) ===
          specText((a[k as keyof SourceScope] as string) ?? ''),
      );
    if (!exactVersion && !explicitConfiguration && !powertrain) continue;
    // A scope label without its own evidence is not a join key.
    const proof = specText(assertion.evidence.evidenceText);
    if (
      !proof.includes(specText(a.model!)) ||
      !proof.includes(specText(a.version!)) ||
      !proof.includes(String(target.modelYear))
    )
      continue;
    return {
      scope: { ...factScope, version: a.version, matrix: a.matrix },
      evidence: assertion.evidence,
    };
  }
  return null;
}
