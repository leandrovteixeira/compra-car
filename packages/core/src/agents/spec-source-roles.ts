import { specText } from './spec-source';
import type { SpecSourceCandidate } from './spec-source-discovery';
export const SPEC_SOURCE_ROLES = [
  'MODEL_OVERVIEW',
  'VERSION_APPLICABILITY',
  'TECHNICAL_DATA',
  'MANUAL',
  'CATALOG',
  'CONFIGURATOR',
  'OTHER',
] as const;
export type SpecSourceRole = (typeof SPEC_SOURCE_ROLES)[number];
export function sourceRoles(
  c: Pick<SpecSourceCandidate, 'url' | 'label' | 'targetBindingSignals' | 'relevanceSignals'>,
): SpecSourceRole[] {
  const t = specText(c.url + ' ' + c.label),
    model = c.targetBindingSignals.includes('MODEL_NAME');
  if (
    /acessorios|accessories|lifestyle|conectado|connectivity|infotainment/iu.test(t) &&
    !/manuais|manual.*instru|owner/iu.test(t)
  )
    return ['OTHER'];
  if (/configurador|configurator|configure|configurar|monte o seu/iu.test(t))
    return ['VERSION_APPLICABILITY', 'CONFIGURATOR'];
  const pdf = /\.pdf(?:$|[?#])/iu.test(c.url);
  if (/manual|literatura|literature/iu.test(t))
    return pdf || model ? ['MANUAL', 'TECHNICAL_DATA'] : ['CATALOG'];
  if (/ficha.tecnica|technical|specification|dados.tecnicos/iu.test(t)) return ['TECHNICAL_DATA'];
  if (/catalog|brochure/iu.test(t))
    return ['CATALOG', ...(model ? ['TECHNICAL_DATA' as const] : [])];
  return model && !pdf ? ['MODEL_OVERVIEW'] : ['OTHER'];
}
export interface SourceSelection {
  candidate: SpecSourceCandidate;
  reason: string;
}
/** Pure greedy role coverage. A generic connector entry is bootstrap, never exact-model coverage. */
export function selectSourcesForTarget(
  candidates: readonly SpecSourceCandidate[],
  options: { maxSources: number; modelYear?: number; coveredRoles?: readonly SpecSourceRole[] },
): SourceSelection[] {
  const pending = candidates
    .filter((c) => c.status === 'ACCEPTED')
    .map((c) => ({ ...c, roles: c.roles ?? sourceRoles(c) }));
  const selected: SourceSelection[] = [],
    covered = new Set(options.coveredRoles ?? []);
  const add = (c: (typeof pending)[number] | undefined, reason: string) => {
    if (!c || selected.length >= options.maxSources) return;
    selected.push({ candidate: c, reason });
    c.roles.forEach((r) => covered.add(r));
  };
  const ranked = () =>
    pending
      .filter((c) => !selected.some((s) => s.candidate.url === c.url))
      .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  // Explicit version applicability is scarce; reserve it before optional technical duplicates.
  for (const role of ['TECHNICAL_DATA', 'VERSION_APPLICABILITY', 'MODEL_OVERVIEW'] as const) {
    if (covered.has(role)) continue;
    const best = ranked()
      .filter((c) => c.roles.includes(role) && c.score >= 0)
      .sort((a, b) => {
        const exact = (c: typeof a) =>
          options.modelYear && c.myBindingSignals.includes('MY_CANDIDATE:' + options.modelYear)
            ? 1
            : 0;
        return role === 'TECHNICAL_DATA' ? exact(b) - exact(a) || b.score - a.score : 0;
      })[0];
    add(best, 'MISSING_ROLE:' + role);
    if (!best && role === 'TECHNICAL_DATA' && !covered.has('CATALOG'))
      add(
        ranked().find((c) => c.roles.includes('CATALOG') && c.score >= 0),
        'DISCOVERY_BRIDGE:TECHNICAL_DATA',
      );
  }
  for (const c of ranked()) add(c, 'RELEVANCE_AFTER_ROLE_COVERAGE');
  return selected;
}
