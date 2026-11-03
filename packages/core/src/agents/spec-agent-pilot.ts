import type { AdministrativeSpecCatalogItem, UnitConversion } from '../admin/administrative-product-specs';
import type { CanonicalAlias } from '../agent-platform/canonical-alias-contract';
import { parseBaicSpecMatrix27 } from './spec-agent-baic-matrix';
import { buildBaicSpecDocument27 } from './spec-agent-baic-import';
import {
  reconcileSpecDocuments27, type CanonicalSpec27, type SpecEvidence27, type SpecTarget27,
} from './spec-agent-reconciliation';
import { projectApprovedSpecAliases27, projectSpecReviewCandidates27 } from './spec-agent-review-projection';
import { planSpecWrites27 } from './spec-agent-write-plan';

/**
 * End-to-end READ-ONLY workflow from PDF text to canonical-draft findings.
 * Operators must separately confirm target MY and equipment inventory completeness.
 * A reviewed dry-run is not permission to write product_specs.
 */
export function previewBaicSpecImport27(input:{
  pdfLayoutText: string;
  target: SpecTarget27;
  evidence: SpecEvidence27;
  approvedAliases: readonly CanonicalAlias[];
  catalog: readonly AdministrativeSpecCatalogItem[];
  locale: string;
  categoryKey: string;
  sourceContextKey: string;
  observedAt: string;
  validatedInventoryComplete?: boolean;
  previousModelYearSpecs?: readonly CanonicalSpec27[];
  predecessorModelYear?: number;
  existingCurrentSpecs?: readonly CanonicalSpec27[];
  unitConversions?: readonly UnitConversion[];
}) {
  if (!['PRO','MAX'].includes(input.target.version.trim().toUpperCase()))
    throw new Error('BAIC_TARGET_VERSION_REQUIRED');
  const version=input.target.version.trim().toUpperCase() as 'PRO'|'MAX';
  const matrix=parseBaicSpecMatrix27(input.pdfLayoutText);
  const extracted=buildBaicSpecDocument27({
    matrix,target:input.target,version,evidence:input.evidence,
    validatedInventoryComplete:input.validatedInventoryComplete,
  });
  const aliases=projectApprovedSpecAliases27({
    entries:input.approvedAliases,
    catalog:input.catalog.map(s=>({canonicalId:s.id,specCode:s.code,kind:s.type})),
    market:'BR',locale:input.locale,categoryKey:input.categoryKey,
    sourceContextKey:input.sourceContextKey,
  });
  const result=reconcileSpecDocuments27({
    target:input.target,documents:[extracted.document],aliases,
    binaryCatalog:input.catalog.filter(s=>s.type==='binary').map(s=>s.code),
    previousModelYearSpecs:input.previousModelYearSpecs,
    predecessorModelYear:input.predecessorModelYear,
    existingCurrentSpecs:input.existingCurrentSpecs,
    budgetUsd:2,
  });
  const reviewCandidates=projectSpecReviewCandidates27({
    reconciliation:result,observedAt:input.observedAt,
  });
  const writePlan=planSpecWrites27({
    productId:input.target.productId,changes:result.changes,catalog:input.catalog,
    unitConversions:input.unitConversions,
  });
  return {
    target:input.target,
    structure:{rows:matrix.rows.length,issues:matrix.issues,reviewRows:extracted.reviewRows},
    reconciliation:result,
    reviewCandidates,
    writePlan,
    /** Intentionally never true: persistence is a separate authorized transaction. */
    writesApplied:false as const,
  };
}
