import type {
  DocumentSourceClass,
  DocumentIntelligenceSource,
} from './document-intelligence-types';
export const ALLOWED_SPEC_SOURCE_CLASSES: readonly DocumentSourceClass[] = [
  'TECHNICAL_SHEET',
  'OFFICIAL_MODEL_PAGE',
  'OFFICIAL_CONFIGURATOR',
  'OFFICIAL_STRUCTURED_DATA',
  'OFFICIAL_TECHNICAL_PAGE',
];
/** Shared candidate, transport and router policy. Specific exclusions always win. */
export function classifyDocumentSource(
  url: string,
  label = '',
  hint?: DocumentSourceClass,
): DocumentSourceClass {
  const t = (url + ' ' + label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
  if (/webmotors/u.test(t)) return 'WEBMOTORS';
  if (/owner.?manual|manual|manuais|literatura.de.bordo|owners?.literature|literature/u.test(t))
    return 'OWNER_MANUAL';
  if (/dealer|concessionar/u.test(t)) return 'DEALER';
  if (/press|imprensa|newsroom|media.center/u.test(t)) return 'PRESS';
  if (/forum/u.test(t)) return 'FORUM';
  if (/acessorios|accessories|lifestyle|boutique/u.test(t)) return 'UNKNOWN';
  if (hint && !ALLOWED_SPEC_SOURCE_CLASSES.includes(hint)) return hint;
  if (/ficha.?tecnica|technical.?sheet|specification.?sheet/u.test(t)) return 'TECHNICAL_SHEET';
  if (/configurador|configurator|configure|version.matrix/u.test(t)) return 'OFFICIAL_CONFIGURATOR';
  if (/\.json(?:$|[? ])|structured.data/u.test(t)) return 'OFFICIAL_STRUCTURED_DATA';
  if (/dados.?tecnicos|technical.?data|specifications/u.test(t)) return 'OFFICIAL_TECHNICAL_PAGE';
  if (/\.pdf(?:$|[? ])|brochure|catalog/u.test(t))
    return hint === 'TECHNICAL_SHEET' ? hint : 'UNKNOWN';
  return hint ?? 'OFFICIAL_MODEL_PAGE';
}
export function specSourcePolicy(sourceClass: DocumentSourceClass, official: boolean) {
  return {
    allowed: official && ALLOWED_SPEC_SOURCE_CLASSES.includes(sourceClass),
    reason:
      official && ALLOWED_SPEC_SOURCE_CLASSES.includes(sourceClass) ? null : 'SOURCE_KIND_EXCLUDED',
  };
}
export function routeSpecSource(
  source: Pick<
    DocumentIntelligenceSource,
    'sourceClass' | 'official' | 'format' | 'losslessStructured' | 'truncated'
  >,
) {
  if (source.format === 'PDF_FILE' && source.sourceClass !== 'TECHNICAL_SHEET')
    return 'REJECT_SOURCE' as const;
  if (!specSourcePolicy(source.sourceClass, source.official).allowed)
    return 'REJECT_SOURCE' as const;
  if (
    !source.truncated &&
    source.losslessStructured &&
    ['STRUCTURED_JSON', 'STRUCTURED_HTML'].includes(source.format)
  )
    return 'DETERMINISTIC_STRUCTURED' as const;
  return 'DOCUMENT_INTELLIGENCE' as const;
}

export class SpecSourceProcessingRouter {
  select(source: Parameters<typeof routeSpecSource>[0]) {
    return routeSpecSource(source);
  }
}
