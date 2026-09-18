import { publishedSourceVersion } from './document-intelligence-scope';
import { classifyDocumentSource, specSourcePolicy } from './spec-source-policy';
import { sourceRoles, type SpecSourceRole } from './spec-source-roles';
import { specText } from './spec-source';
import type { SpecSourceKind, SpecSourceTarget } from './spec-source-types';
import type { OfficialBrandSource } from './new-product-check-types';
export interface SpecDiscoveredLink {
  url: string;
  label: string;
  method: 'HTML_LINK' | 'HTML_DATA_LINK' | 'EMBEDDED_JSON' | 'CONNECTOR_SEED' | 'OFFICIAL_SEARCH';
}
export interface SpecSourceCandidate extends SpecDiscoveredLink {
  finalUrl: string | null;
  sourceKindCandidate: SpecSourceKind;
  parentUrl: string | null;
  depth: number;
  relevanceSignals: string[];
  targetBindingSignals: string[];
  myBindingSignals: string[];
  roles?: SpecSourceRole[];
  selectionReason?: string;
  score: number;
  scoreReasons: { reason: string; delta: number }[];
  status: 'ACCEPTED' | 'REJECTED' | 'FETCHED';
  rejectionReason: string | null;
}
export interface SpecDiscoveryProvider {
  discover(
    target: SpecSourceTarget,
    source: OfficialBrandSource,
  ): Promise<readonly SpecDiscoveredLink[]>;
}
const words = (s: string) => ' ' + specText(s).replace(/[^a-z0-9]+/gu, ' ') + ' ';
export function classifySpecLink(
  link: SpecDiscoveredLink,
  target: SpecSourceTarget,
  parent: SpecSourceCandidate | null,
  maxDepth: number,
): SpecSourceCandidate {
  const text = words(link.url + ' ' + link.label),
    model = words(target.model).trim();
  const modelMatch = text.includes(' ' + model + ' '),
    exactVersion = text.includes(words(target.officialVersionLabel).trim());
  const technical =
    /\b(ficha tecnica|especificacoes|specifications?|technical|tecnicos|literatura|literature|catalogo|catalog|brochure|manual|manuais|pdf)\b/u.test(
      text,
    );
  const configurator = /\b(configurador|configurator|configure|configurar|monte o seu)\b/u.test(
    text,
  );
  const modelYears = [...text.matchAll(/\b(?:my|ano modelo)\s*(20\d{2}|\d{2})\b/gu)].map((m) =>
    Number(m[1]!.length === 2 ? '20' + m[1] : m[1]),
  );
  const allYears = [
    ...new Set([...modelYears, ...[...text.matchAll(/\b(20\d{2})\b/gu)].map((m) => Number(m[1]))]),
  ];
  const depth = parent ? parent.depth + 1 : 0;
  const signals = [
    ...(modelMatch ? ['MODEL_NAME'] : []),
    ...(technical ? ['TECHNICAL_DOCUMENT'] : []),
    ...(configurator ? ['CONFIGURATOR'] : []),
  ];
  let reason: string | null = null;
  if (
    /\b(careers?|carreiras|privacy|privacidade|legal|institucional|imprensa|press|newsroom|dealer|concessionaria|facebook|instagram|linkedin|financiamento)\b/u.test(
      text,
    )
  )
    reason = 'EXCLUDED_SOURCE_PURPOSE';
  else if (depth > maxDepth) reason = 'MAX_DISCOVERY_DEPTH';
  else if (allYears.length && !allYears.includes(target.modelYear)) reason = 'OUT_OF_MY_SOURCE';
  else if (
    !modelMatch &&
    !configurator &&
    !(
      technical &&
      !/\bpdf\b/u.test(text) &&
      /\b(manual|manuais|literature|literatura|catalog)\b/u.test(text)
    ) &&
    !(parent?.targetBindingSignals.includes('MODEL_NAME') && (technical || configurator)) &&
    link.method !== 'CONNECTOR_SEED'
  )
    reason = 'NO_TARGET_RELEVANCE';
  const documentClass = classifyDocumentSource(link.url, link.label);
  if (!specSourcePolicy(documentClass, true).allowed) reason = 'SOURCE_KIND_EXCLUDED';
  const namedVersion = publishedSourceVersion(link.label, target.model);
  if (
    !reason &&
    namedVersion &&
    !specText(target.officialVersionLabel).startsWith(specText(namedVersion))
  )
    reason = 'TARGET_VERSION_CONFLICT';
  const scoreReasons: { reason: string; delta: number }[] = [];
  const reward = (test: boolean, reason: string, delta: number) => {
    if (test) scoreReasons.push({ reason, delta });
  };
  const manual = /\b(manual|manuais|literatura|literature)\b/u.test(text);
  const accessories =
    /\b(acessorios|accessories|lifestyle|boutique)\b/u.test(text) &&
    !manual &&
    !technical &&
    !configurator;
  reward(modelMatch, 'EXACT_MODEL', 80);
  reward(exactVersion, 'EXACT_VERSION_LABEL', 40);
  reward(allYears.includes(target.modelYear), 'EXACT_MY', 100);
  reward(technical, 'TECHNICAL_TERMS', 70);
  reward(documentClass === 'TECHNICAL_SHEET', 'TECHNICAL_SHEET_PRIORITY', 300);
  reward(/\.pdf(?:$|[?#])/iu.test(link.url), 'OFFICIAL_PDF_CANDIDATE', 50);
  reward(configurator, 'CONFIGURATOR', 90);
  reward(accessories, 'ACCESSORIES_LIFESTYLE', -500);
  reward(!modelMatch && !technical && !configurator, 'NO_TARGET_TECHNICAL_IDENTITY', -30);
  reward(
    /\b(servicos|services|finance|financiamento)\b/u.test(text) && !manual,
    'GENERIC_SERVICE_FINANCE',
    -80,
  );
  reward(
    /\b(esg|sustentabilidade|sustainability|loan|institucional)\b/u.test(text),
    'INSTITUTIONAL_DOCUMENT',
    -500,
  );
  reward(
    reason === 'NO_TARGET_RELEVANCE' || reason === 'OUT_OF_MY_SOURCE',
    'WRONG_TARGET_OR_MY',
    -500,
  );
  return {
    ...link,
    roles: sourceRoles({
      ...link,
      targetBindingSignals: modelMatch ? ['MODEL_NAME'] : [],
      relevanceSignals: signals,
    }),
    finalUrl: null,
    sourceKindCandidate: configurator
      ? 'OFFICIAL_CONFIGURATOR'
      : /\bmanual\b/u.test(text)
        ? 'OFFICIAL_MANUAL'
        : /\b(pdf)\b/u.test(text)
          ? 'OFFICIAL_PDF'
          : technical
            ? 'OFFICIAL_CATALOG'
            : 'OFFICIAL_HTML',
    parentUrl: parent?.finalUrl ?? parent?.url ?? null,
    depth,
    relevanceSignals: signals,
    targetBindingSignals: [
      ...(modelMatch ? ['MODEL_NAME'] : []),
      ...(exactVersion ? ['VERSION_LABEL'] : []),
    ],
    myBindingSignals: allYears.map((y) => 'MY_CANDIDATE:' + y),
    score: scoreReasons.reduce((sum, entry) => sum + entry.delta, 0),
    scoreReasons,
    status: reason ? 'REJECTED' : 'ACCEPTED',
    rejectionReason: reason,
  };
}
