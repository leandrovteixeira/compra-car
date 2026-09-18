import {
  groundEvidence,
  blockSupports,
  normalizeGrounding,
} from './document-intelligence-grounding';
import { sourceStructureCensus, assessCompleteness } from './document-intelligence-census';
import { publishedSourceVersion } from './document-intelligence-scope';
import { validateTechnicalSheetSchema } from './document-intelligence-schema';
import { specValue } from './spec-source';
import type {
  DocumentBlock,
  DocumentEvidence,
  DocumentIntelligenceSource,
  ExtractionIssue,
  ExtractionValidation,
  TechnicalSheetItem,
} from './document-intelligence-types';
import type { SpecObservation } from './spec-source-types';
import type { DocumentIntelligenceTarget } from './document-intelligence-types';
const norm = (s: string | null | undefined) => normalizeGrounding(s ?? '');
const contains = (text: string, value: string | null | undefined) =>
  !!value && norm(text).includes(norm(value));
export function validateDocumentExtraction(
  source: DocumentIntelligenceSource,
  target: DocumentIntelligenceTarget,
  value: unknown,
): ExtractionValidation {
  const issues: ExtractionIssue[] = [],
    observations: SpecObservation[] = [];
  const issue = (
    code: string,
    path: string,
    severity: ExtractionIssue['severity'] = 'REPAIR',
    detail = code,
  ) => issues.push({ code, path, severity, detail });
  if (!validateTechnicalSheetSchema(value))
    return {
      status: 'REPAIR_REQUIRED',
      inventory: null,
      observations,
      issues: [
        {
          code: 'SCHEMA_INVALID',
          path: '/',
          severity: 'REPAIR',
          detail: 'Strict source-native schema required',
        },
      ],
    };
  const inventory = structuredClone(value);
  const blocks = new Map(source.blocks.map((b) => [b.locator, b]));
  const grounding: NonNullable<ExtractionValidation['grounding']> = [];
  const proof = (e: DocumentEvidence) => {
    const quality = groundEvidence(source, e);
    grounding.push({ locator: e.locator, quote: e.quote, quality });
    return quality !== 'NOT_GROUNDED';
  };
  const scopeChain = (b: DocumentBlock | undefined) => {
    const result: DocumentBlock[] = [];
    const seen = new Set<string>();
    while (b && !seen.has(b.locator)) {
      result.push(b);
      seen.add(b.locator);
      b = b.parentLocator ? blocks.get(b.parentLocator) : undefined;
    }
    return result;
  };
  if (source.truncated)
    issue(
      'STRUCTURE_INCOMPLETE',
      'source',
      'REVIEW',
      'Bounded source omitted content; completeness not established',
    );
  const id = inventory.documentIdentity;
  const idText = id.evidence
    .filter(proof)
    .map((e) => e.quote)
    .join(' ');
  const sourceIdentity = source.blocks.some(
    (b) => blockSupports(b, target.model) && blockSupports(b, target.officialVersionLabel),
  );
  const modelProven =
    !!id.model &&
    id.evidence
      .filter(proof)
      .some((e) =>
        blockSupports(
          { ...blocks.get(e.locator)!, text: e.quote, readingText: undefined },
          id.model!,
        ),
      );
  const brandProven = !id.brand || contains(idText, id.brand);
  if (
    !modelProven ||
    !brandProven ||
    (id.version !== null && !contains(idText, id.version)) ||
    (id.version === null && id.evidence.some((e) => e.evidenceType !== undefined))
  ) {
    issue(
      sourceIdentity ? 'IDENTITY_OUTPUT_INCOMPLETE' : 'IDENTITY_SOURCE_AMBIGUOUS',
      'documentIdentity',
      sourceIdentity ? 'REPAIR' : 'REVIEW',
      sourceIdentity
        ? 'Visible source contains model/version; provide grounded identity evidence'
        : 'Source does not establish requested model/version identity',
    );
  }
  if (id.model && norm(id.model) !== norm(target.model))
    issue('TARGET_MODEL_CONFLICT', 'documentIdentity', sourceIdentity ? 'REPAIR' : 'REVIEW');
  if (id.brand && norm(id.brand) !== norm(target.brand))
    issue(
      'TARGET_BRAND_CONFLICT',
      'documentIdentity',
      sourceIdentity && source.blocks.some((b) => blockSupports(b, target.brand))
        ? 'REPAIR'
        : 'REVIEW',
    );
  if (id.version && norm(id.version) !== norm(target.officialVersionLabel))
    issue('TARGET_VERSION_CONFLICT', 'documentIdentity', sourceIdentity ? 'REPAIR' : 'REVIEW');
  const identityYearProven =
    id.modelYear !== null &&
    id.evidence.filter(proof).some((e) => {
      const block = blocks.get(e.locator);
      return (
        (block?.scope.modelYear === id.modelYear && contains(e.quote, String(id.modelYear))) ||
        /\b(?:MY|ano.modelo|model.year)\s*:?\s*(20\d{2})\b/iu.exec(e.quote)?.[1] ===
          String(id.modelYear)
      );
    });
  if (id.modelYear !== null && !identityYearProven) {
    issue('MODEL_YEAR_UNSUPPORTED', 'documentIdentity');
    id.modelYear = null;
  }
  if (target.modelYear !== null && id.modelYear !== null && id.modelYear !== target.modelYear)
    issue('TARGET_MY_CONFLICT', 'documentIdentity', 'REVIEW');
  if (!inventory.sections.length) issue('STRUCTURE_INCOMPLETE', 'sections');
  let total = 0;
  const seen = new Set<string>();
  for (const [si, section] of inventory.sections.entries()) {
    const sp = 'sections/' + si;
    if (!section.items.length) issue('EMPTY_SECTION', sp);
    for (const [ii, item] of section.items.entries()) {
      total++;
      const p = sp + '/items/' + ii;
      if (!item.evidence.length) {
        issue('EVIDENCE_MISSING', p);
        issue(
          source.blocks.some(
            (b) =>
              blockSupports(b, item.sourceLabel) &&
              (!item.rawValue || blockSupports(b, item.rawValue)),
          )
            ? 'MODEL_OUTPUT_EVIDENCE_MISSING'
            : 'SOURCE_EVIDENCE_UNAVAILABLE',
          p,
        );
        continue;
      }
      if (!item.evidence.every(proof)) {
        issue('EVIDENCE_NOT_GROUNDED', p);
        const available = source.blocks.some(
          (b) =>
            blockSupports(b, item.sourceLabel) &&
            (!item.rawValue || blockSupports(b, item.rawValue)),
        );
        issue(
          available ? 'MODEL_OUTPUT_EVIDENCE_MALFORMED' : 'SOURCE_EVIDENCE_UNAVAILABLE',
          p,
          available ? 'REPAIR' : 'REVIEW',
        );
        continue;
      }
      const quote = item.evidence.map((e) => e.quote).join(' ');
      const context = item.evidence.flatMap((e) => scopeChain(blocks.get(e.locator)));
      const explicit = context
        .map((b) => b.scope)
        .filter((s) => s.model || s.version || s.modelYear);
      const a = item.applicability;
      const conflicts =
        explicit.some((s) => s.version && norm(s.version) !== norm(target.officialVersionLabel)) ||
        [a.version, section.applicability.version].some(
          (v) => v && norm(v) !== norm(target.officialVersionLabel),
        );
      // Explicit text inside a child is stronger than broad page scope, independent of brand.
      const namedVersion = publishedSourceVersion(quote, target.model);
      const textConflict =
        !!namedVersion && !norm(target.officialVersionLabel).startsWith(norm(namedVersion));
      if (conflicts || textConflict) {
        issue('TARGET_VERSION_CONFLICT', p, 'WARNING', 'Retained in source inventory only');
        continue;
      }
      if (
        explicit.some((s) => s.model && norm(s.model) !== norm(target.model)) ||
        (a.model && norm(a.model) !== norm(target.model))
      ) {
        issue('TARGET_MODEL_CONFLICT', p, 'WARNING');
        continue;
      }
      if (
        explicit.some(
          (s) =>
            target.modelYear !== null && s.modelYear !== null && s.modelYear !== target.modelYear,
        ) ||
        (target.modelYear !== null && a.modelYear !== null && a.modelYear !== target.modelYear)
      ) {
        issue('TARGET_MY_CONFLICT', p, 'WARNING');
        continue;
      }
      const substantive = [item.sourceLabel, item.rawValue, item.rawUnit].filter(
        (x): x is string => !!x,
      );
      if (
        !substantive.every((x) =>
          blockSupports({ ...context[0]!, text: quote, readingText: undefined }, x),
        )
      ) {
        issue('EVIDENCE_NOT_GROUNDED', p);
        continue;
      }
      if (
        substantive.some((v) => {
          const at = norm(quote).indexOf(norm(v)),
            end = norm(quote)[at + norm(v).length] ?? '';
          return /[\p{L}\p{N}]$/u.test(v) && /[\p{L}]/u.test(end);
        })
      ) {
        issue('LIKELY_TRUNCATED_TEXT', p);
        continue;
      }
      if (
        item.kind === 'PRESENT' &&
        (!item.present || !/[•●✓✔]|\b(sim|yes|incluído|incluido|equipado|standard)\b/iu.test(quote))
      ) {
        issue('PRESENCE_NOT_PROVEN', p);
        continue;
      }
      if (
        item.kind === 'EXPLICIT_ABSENT' &&
        (item.present !== false || !/\b(não|nao|sem|no|absent|indisponível)\b/iu.test(quote))
      ) {
        issue('PRESENCE_NOT_PROVEN', p);
        continue;
      }
      if (item.kind !== 'PRESENT' && item.present === true) {
        issue('PRESENCE_NOT_PROVEN', p);
        continue;
      }
      if (item.parentGroup && !item.subgroup) issue('STRUCTURE_INCOMPLETE', p);
      if (
        item.subgroup &&
        !context.some(
          (b) => contains(b.text, item.subgroup) || contains(b.heading ?? '', item.subgroup),
        )
      )
        issue('STRUCTURE_INCOMPLETE', p);
      const key = JSON.stringify([
        norm(section.sourceHeading),
        norm(item.subgroup),
        norm(item.sourceLabel),
        norm(item.rawValue),
        a.version,
        a.modelYear,
      ]);
      if (seen.has(key)) {
        issue('DUPLICATE_ITEM', p);
        continue;
      }
      seen.add(key);
      const exact =
        explicit.some((s) => norm(s.version) === norm(target.officialVersionLabel)) &&
        context.some((b) => contains(b.text, target.officialVersionLabel));
      const year =
        target.modelYear !== null &&
        explicit.some((s) => s.modelYear === target.modelYear) &&
        context.some((b) => contains(b.text, String(target.modelYear)));
      if (a.versionBinding === 'EXACT_VERSION' && !exact) {
        a.versionBinding = 'UNRESOLVED';
        issue('EXACT_VERSION_NOT_PROVEN', p, 'WARNING', 'Downgraded to UNRESOLVED');
      }
      if (a.versionBinding === 'VERSION_MATRIX' && !exact) {
        a.versionBinding = 'UNRESOLVED';
        issue('EXACT_VERSION_NOT_PROVEN', p, 'WARNING', 'Matrix column not proven');
      }
      if (
        a.versionBinding === 'MODEL_SHARED' &&
        !context.some((b) => /todas as versões|all versions|model.shared/iu.test(b.text))
      ) {
        a.versionBinding = 'UNRESOLVED';
        issue('VERSION_SHARED_NOT_PROVEN', p, 'WARNING');
      }
      if (a.yearBinding === 'EXACT_MY' && !year) {
        a.yearBinding = 'UNRESOLVED';
        a.modelYear = null;
        issue('EXACT_MY_NOT_PROVEN', p, 'WARNING', 'Downgraded to UNRESOLVED');
      }
      if (
        a.yearBinding === 'CURRENT_LINEUP' &&
        !context.some((b) => /linha atual|current lineup/iu.test(b.text))
      ) {
        a.yearBinding = 'UNRESOLVED';
        issue('EXACT_MY_NOT_PROVEN', p, 'WARNING');
      }
      if (
        !contains(idText, target.model) &&
        !explicit.some((s) => norm(s.model) === norm(target.model))
      ) {
        issue('DOCUMENT_IDENTITY_UNRESOLVED', p);
        continue;
      }
      if (item.kind === 'OPTION') continue;
      if (target.modelYear !== null)
        observations.push(toObservation(item, source, { ...target, modelYear: target.modelYear }));
    }
  }
  if (total === 0 || total > 1000) issue('SUSPICIOUS_ITEM_COUNT', 'sections');
  const census = sourceStructureCensus(source);
  const completeness = assessCompleteness(census, inventory);
  for (const detail of completeness.major)
    issue('STRUCTURE_INCOMPLETE', 'sections', 'REPAIR', detail);
  if (grounding.some((g) => g.quality === 'NOT_GROUNDED')) {
    completeness.confidence = 'LOW';
    completeness.reasons.push('Ungrounded evidence');
  }
  const status = issues.some((i) => i.severity === 'REVIEW')
    ? 'HUMAN_REVIEW_REQUIRED'
    : issues.some((i) => i.severity === 'REPAIR')
      ? 'REPAIR_REQUIRED'
      : 'PASS';
  return {
    status,
    issues,
    inventory,
    grounding,
    census,
    completeness,
    observations: status === 'PASS' ? observations : [],
  };
}
function toObservation(
  i: TechnicalSheetItem,
  s: DocumentIntelligenceSource,
  t: DocumentIntelligenceTarget & { modelYear: number },
): SpecObservation {
  const evidence = i.evidence.map((e) => ({
    sourceUrl: s.finalUrl,
    sourceKind: s.format === 'PDF_FILE' ? ('OFFICIAL_PDF' as const) : ('OFFICIAL_HTML' as const),
    contentHash: s.sourceHash,
    locator: e.locator,
    evidenceText: e.quote,
  }));
  return {
    target: {
      mmvIdentity: t.mmvIdentity,
      brand: t.brand,
      model: t.model,
      officialVersionLabel: t.officialVersionLabel,
      modelYear: t.modelYear,
    },
    observation:
      i.kind === 'PRESENT'
        ? { ...specValue(i.sourceLabel, i.rawValue ?? '•', i.rawUnit), parsedValue: true }
        : i.kind === 'EXPLICIT_ABSENT'
          ? {
              ...specValue(i.sourceLabel, i.rawValue ?? i.rawText, i.rawUnit),
              parsedValue: false,
              polarity: 'EXPLICIT_NEGATIVE',
            }
          : specValue(i.sourceLabel, i.rawValue ?? i.rawText, i.rawUnit),
    applicability: {
      modelBinding: 'EXACT_MODEL',
      versionBinding: i.applicability.versionBinding,
      yearBinding: i.applicability.yearBinding,
      confidence: i.applicability.versionBinding === 'EXACT_VERSION' ? 1 : 0.5,
    },
    evidence: evidence[0]!,
    factEvidence: evidence,
    applicabilityEvidence: evidence,
    extraction: { method: 'DOCUMENT_INTELLIGENCE', confidence: 0.8 },
  };
}
