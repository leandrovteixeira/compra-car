export const COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION =
  'CommercialDocumentExtraction/1' as const;

export const COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS = Object.freeze({
  maxPayloadBytes: 8 * 1024 * 1024,
  maxDocuments: 20,
  maxBlocks: 2_000,
  maxTables: 200,
  maxRowsPerTable: 2_000,
  maxVehicleIdentities: 2_000,
  maxFacts: 10_000,
  maxScopes: 5_000,
  maxGroups: 2_000,
  maxRelationships: 10_000,
  maxExtractionUnits: 2_000,
  maxExcerptLength: 1_000,
  maxTextLength: 2_000,
} as const);

export const COMMERCIAL_DOCUMENT_KINDS = [
  'commercial_letter',
  'price_table',
  'campaign_rules',
  'annex',
  'errata',
  'other',
  'unknown',
] as const;
export type CommercialDocumentKind = (typeof COMMERCIAL_DOCUMENT_KINDS)[number];

export const COMMERCIAL_DOCUMENT_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'note',
  'footnote',
  'table_header',
  'table_row',
  'image',
  'unknown',
] as const;
export type CommercialDocumentBlockType = (typeof COMMERCIAL_DOCUMENT_BLOCK_TYPES)[number];

export const COMMERCIAL_DOCUMENT_FACT_TYPES = [
  'public_price',
  'promotional_price',
  'bonus',
  'discount',
  'trade_in',
  'financing_rate',
  'financing_down_payment',
  'financing_installments',
  'grace_period',
  'registration_bonus',
  'accessory',
  'wallbox',
  'charging',
  'insurance',
  'maintenance',
  'eligibility',
  'restriction',
  'channel_rule',
  'other',
] as const;
export type CommercialDocumentFactType = (typeof COMMERCIAL_DOCUMENT_FACT_TYPES)[number];

export const COMMERCIAL_DOCUMENT_SCOPE_TYPES = [
  'DOCUMENT',
  'BRAND_LINE',
  'MODEL',
  'VERSION_SET',
  'VEHICLE',
  'CHANNEL',
  'GROUP',
] as const;
export type CommercialDocumentScopeType = (typeof COMMERCIAL_DOCUMENT_SCOPE_TYPES)[number];

export const COMMERCIAL_DOCUMENT_RELATION_TYPES = [
  'APPLIES_TOGETHER',
  'MUTUALLY_EXCLUSIVE',
  'GENERAL_RULE',
  'EXCEPTION',
  'EXCLUDES',
  'OVERRIDES',
] as const;
export type CommercialDocumentRelationType = (typeof COMMERCIAL_DOCUMENT_RELATION_TYPES)[number];

export interface CommercialDocumentConfidence {
  readonly score: number;
  readonly ambiguous: boolean;
  readonly requiresReview: boolean;
  readonly reasons: readonly string[];
}

export interface CommercialDocumentEvidence {
  readonly blockIds: readonly string[];
  readonly tableId?: string;
  readonly rowId?: string;
  readonly excerpt?: string;
}

export interface CommercialDocumentTextCandidate {
  readonly value: string;
  readonly evidence: CommercialDocumentEvidence;
  readonly confidence: CommercialDocumentConfidence;
}

export interface CommercialDocumentValidityCandidate {
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly rawText: string;
  readonly evidence: CommercialDocumentEvidence;
  readonly confidence: CommercialDocumentConfidence;
}

export interface CommercialSourceDocument {
  readonly documentId: string;
  readonly ordinal: number;
  readonly pageCount: number;
  readonly documentKind: CommercialDocumentKind;
  readonly competenceCandidates: readonly CommercialDocumentTextCandidate[];
  readonly validityCandidates: readonly CommercialDocumentValidityCandidate[];
  readonly notes: readonly CommercialDocumentTextCandidate[];
}

export interface CommercialDocumentRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CommercialDocumentSourceBlock {
  readonly blockId: string;
  readonly documentId: string;
  readonly page: number;
  readonly blockType: CommercialDocumentBlockType;
  readonly section?: string;
  readonly title?: string;
  readonly excerpt: string;
  readonly region?: CommercialDocumentRegion;
  readonly tableId?: string;
  readonly rowId?: string;
}

export interface CommercialDocumentTableColumn {
  readonly columnId: string;
  readonly header: string;
  readonly inherited: boolean;
}

export interface CommercialDocumentTableCell {
  readonly columnId: string;
  readonly text: string;
}

export interface CommercialDocumentTableRow {
  readonly rowId: string;
  readonly ordinal: number;
  readonly page: number;
  readonly cells: readonly CommercialDocumentTableCell[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentTableSegment {
  readonly page: number;
  readonly sourceBlockIds: readonly string[];
  readonly inheritsHeadersFromPage?: number;
}

export interface CommercialDocumentTableContinuation {
  readonly continuedAcrossPages: boolean;
  readonly inheritedHeaderBlockIds: readonly string[];
  readonly segments: readonly CommercialDocumentTableSegment[];
}

export interface CommercialDocumentTable {
  readonly tableId: string;
  readonly documentId: string;
  readonly pages: readonly number[];
  readonly title?: string;
  readonly headerContext: string;
  readonly columns: readonly CommercialDocumentTableColumn[];
  readonly rows: readonly CommercialDocumentTableRow[];
  readonly sourceBlockIds: readonly string[];
  readonly footnoteBlockIds: readonly string[];
  readonly continuation: CommercialDocumentTableContinuation;
}

export interface CommercialDocumentVehicleIdentity {
  readonly vehicleIdentityId: string;
  readonly brand: string;
  readonly model: string;
  readonly version?: string;
  readonly productionYear?: number;
  readonly modelYear?: number;
  readonly rawYearText?: string;
  readonly evidence: CommercialDocumentEvidence;
  readonly confidence: CommercialDocumentConfidence;
}

export type CommercialDocumentFactValue =
  | {
      readonly kind: 'money';
      readonly amount: string;
      readonly currency: string;
      readonly rawText?: string;
    }
  | {
      readonly kind: 'percentage';
      readonly percentage: string;
      readonly rawText?: string;
    }
  | {
      readonly kind: 'quantity';
      readonly amount: string;
      readonly unit: string;
      readonly rawText?: string;
    }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'boolean'; readonly value: boolean; readonly rawText?: string };

export interface CommercialDocumentFactValidity {
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly rawText?: string;
}

export interface CommercialDocumentFact {
  readonly factId: string;
  readonly factType: CommercialDocumentFactType;
  readonly rawLabel?: string;
  readonly value: CommercialDocumentFactValue;
  readonly channel?: string;
  readonly eligibility: readonly string[];
  readonly restrictions: readonly string[];
  readonly validity?: CommercialDocumentFactValidity;
  readonly scopeIds: readonly string[];
  readonly evidence: CommercialDocumentEvidence;
  readonly confidence: CommercialDocumentConfidence;
}

export interface CommercialDocumentScopeSelector {
  readonly documentIds?: readonly string[];
  readonly brandLines?: readonly string[];
  readonly models?: readonly string[];
  readonly versions?: readonly string[];
  readonly vehicleIdentityIds?: readonly string[];
  readonly channels?: readonly string[];
  readonly groupIds?: readonly string[];
}

export interface CommercialDocumentScope {
  readonly scopeId: string;
  readonly scopeType: CommercialDocumentScopeType;
  readonly selector: CommercialDocumentScopeSelector;
  readonly exclusions: CommercialDocumentScopeSelector;
  readonly evidenceBlockIds: readonly string[];
  readonly ambiguous: boolean;
  readonly requiresReview: boolean;
}

export interface CommercialDocumentCompositionGroup {
  readonly groupId: string;
  readonly groupType: 'ALTERNATIVE' | 'CUMULATIVE';
  readonly memberFactIds: readonly string[];
  readonly sharedFactIds: readonly string[];
  readonly scopeIds: readonly string[];
  readonly parentGroupId?: string;
}

export interface CommercialDocumentCompositionRelation {
  readonly relationId: string;
  readonly relationType: CommercialDocumentRelationType;
  readonly factIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly scopeIds: readonly string[];
  readonly evidenceBlockIds: readonly string[];
}

export interface CommercialDocumentComposition {
  readonly groups: readonly CommercialDocumentCompositionGroup[];
  readonly relationships: readonly CommercialDocumentCompositionRelation[];
}

export interface CommercialDocumentExtractionUnit {
  readonly unitId: string;
  readonly status: 'expected' | 'complete' | 'incomplete' | 'ambiguous';
  readonly sourceBlockIds: readonly string[];
  readonly expectedItemCount?: number;
  readonly extractedItemCount: number;
}

export interface CommercialDocumentCoverageGap {
  readonly gapId: string;
  readonly gapType:
    | 'INCOMPLETE_BLOCK'
    | 'UNRESOLVED_TABLE_ROW'
    | 'UNRESOLVED_SCOPE'
    | 'MISSING_VEHICLE'
    | 'AMBIGUITY'
    | 'OTHER';
  readonly message: string;
  readonly unitId?: string;
  readonly blockId?: string;
  readonly tableId?: string;
  readonly rowId?: string;
  readonly scopeId?: string;
}

export interface CommercialDocumentUnresolvedTableRow {
  readonly tableId: string;
  readonly rowId: string;
}

export interface CommercialDocumentCoverage {
  readonly status: 'complete' | 'partial' | 'ambiguous';
  readonly expectedUnitCount: number;
  readonly completedUnitCount: number;
  readonly expectedVehicleCount?: number;
  readonly extractedVehicleCount: number;
  readonly expectedFamilies: readonly string[];
  readonly extractedFamilies: readonly string[];
  readonly units: readonly CommercialDocumentExtractionUnit[];
  readonly gaps: readonly CommercialDocumentCoverageGap[];
  readonly incompleteBlockIds: readonly string[];
  readonly unresolvedTableRows: readonly CommercialDocumentUnresolvedTableRow[];
  readonly unresolvedScopeIds: readonly string[];
}

export interface CommercialDocumentExtractionV1 {
  readonly schemaVersion: typeof COMMERCIAL_DOCUMENT_EXTRACTION_SCHEMA_VERSION;
  readonly documents: readonly CommercialSourceDocument[];
  readonly blocks: readonly CommercialDocumentSourceBlock[];
  readonly tables: readonly CommercialDocumentTable[];
  readonly vehicleIdentities: readonly CommercialDocumentVehicleIdentity[];
  readonly facts: readonly CommercialDocumentFact[];
  readonly scopes: readonly CommercialDocumentScope[];
  readonly composition: CommercialDocumentComposition;
  readonly coverage: CommercialDocumentCoverage;
}
