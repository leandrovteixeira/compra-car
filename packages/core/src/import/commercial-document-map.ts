export const COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION = 'CommercialDocumentMap/1' as const;
export const COMMERCIAL_EXTRACTION_UNIT_PLAN_SCHEMA_VERSION =
  'CommercialExtractionUnitPlan/1' as const;

export const COMMERCIAL_DOCUMENT_MAP_LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  maxDocuments: 20,
  maxPages: 2_000,
  maxContentBlocks: 10_000,
  maxSections: 1_000,
  maxTables: 1_000,
  maxNotes: 4_000,
  maxEntityHints: 5_000,
  maxContextEdges: 10_000,
  maxTextLength: 500,
} as const);

export const COMMERCIAL_EXTRACTION_UNIT_LIMITS = Object.freeze({
  maxPagesPerUnit: 8,
  maxTablesPerUnit: 4,
  maxApproximateRowsPerUnit: 60,
  maxContextPagesPerUnit: 4,
  maxUnits: 1_000,
  fallbackPagesPerUnit: 6,
} as const);

export const COMMERCIAL_DOCUMENT_MAP_DOCUMENT_KINDS = [
  'commercial_letter',
  'price_table',
  'campaign_rules',
  'annex',
  'errata',
  'complement',
  'other',
  'unknown',
] as const;
export type CommercialDocumentMapDocumentKind =
  (typeof COMMERCIAL_DOCUMENT_MAP_DOCUMENT_KINDS)[number];

export const COMMERCIAL_DOCUMENT_PAGE_ROLES = [
  'cover',
  'index',
  'commercial_content',
  'table_content',
  'general_rules',
  'financing',
  'eligibility',
  'errata',
  'annex',
  'other',
  'unknown',
] as const;
export type CommercialDocumentPageRole = (typeof COMMERCIAL_DOCUMENT_PAGE_ROLES)[number];

export const COMMERCIAL_DOCUMENT_SECTION_ROLES = [
  'DOCUMENT',
  'FAMILY',
  'MODEL',
  'CHANNEL',
  'FINANCING',
  'GENERAL_RULES',
  'ELIGIBILITY',
  'ERRATA',
  'ANNEX',
  'OTHER',
] as const;
export type CommercialDocumentSectionRole = (typeof COMMERCIAL_DOCUMENT_SECTION_ROLES)[number];

export const COMMERCIAL_DOCUMENT_NOTE_KINDS = [
  'DOCUMENT_WIDE',
  'SECTION_WIDE',
  'TABLE_NOTE',
  'FOOTNOTE',
  'ELIGIBILITY',
  'GENERAL_RULE',
  'EXCEPTION',
  'ERRATA_REFERENCE',
  'OTHER',
] as const;
export type CommercialDocumentNoteKind = (typeof COMMERCIAL_DOCUMENT_NOTE_KINDS)[number];

export const COMMERCIAL_DOCUMENT_ENTITY_HINT_KINDS = [
  'BRAND',
  'FAMILY',
  'MODEL',
  'VERSION',
  'CHANNEL',
] as const;
export type CommercialDocumentEntityHintKind =
  (typeof COMMERCIAL_DOCUMENT_ENTITY_HINT_KINDS)[number];

export const COMMERCIAL_DOCUMENT_CONTEXT_RELATIONS = [
  'TABLE_CONTINUES',
  'INHERITS_HEADER',
  'FOOTNOTE_APPLIES_TO_TABLE',
  'NOTE_GOVERNS_SECTION',
  'NOTE_GOVERNS_TABLE',
  'NOTE_GOVERNS_DOCUMENT',
  'SECTION_CONTINUES',
  'ERRATA_REFERENCES',
  'SHARED_CONTEXT',
] as const;
export type CommercialDocumentContextRelation =
  (typeof COMMERCIAL_DOCUMENT_CONTEXT_RELATIONS)[number];

export type CommercialDocumentMapRefType = 'PAGE' | 'CONTENT_BLOCK' | 'SECTION' | 'TABLE' | 'NOTE';

export interface CommercialDocumentMapRef {
  readonly refType: CommercialDocumentMapRefType;
  readonly refId: string;
}

export interface CommercialDocumentMapMetadataHint {
  readonly value: string;
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapDocument {
  readonly documentId: string;
  readonly ordinal: number;
  readonly pageCount: number;
  readonly documentKindCandidate: CommercialDocumentMapDocumentKind;
  readonly titleHints: readonly CommercialDocumentMapMetadataHint[];
  readonly issuerHints: readonly CommercialDocumentMapMetadataHint[];
  readonly competenceHints: readonly CommercialDocumentMapMetadataHint[];
  readonly validityHints: readonly CommercialDocumentMapMetadataHint[];
}

export interface CommercialDocumentMapContentBlock {
  readonly contentBlockId: string;
  readonly documentId: string;
  readonly pageId: string;
  readonly blockKind: 'HEADING' | 'BODY' | 'TABLE_REGION' | 'NOTE_REGION' | 'OTHER';
  readonly label?: string;
}

export interface CommercialDocumentMapPage {
  readonly pageId: string;
  readonly documentId: string;
  readonly pageNumber: number;
  readonly role: CommercialDocumentPageRole;
  readonly sectionIds: readonly string[];
  readonly tableIds: readonly string[];
  readonly noteIds: readonly string[];
  readonly entityHintIds: readonly string[];
  readonly contextEdgeIds: readonly string[];
  readonly contentBlockIds: readonly string[];
}

export interface CommercialDocumentMapSection {
  readonly sectionId: string;
  readonly documentId: string;
  readonly titleHint?: string;
  readonly semanticRole: CommercialDocumentSectionRole;
  readonly pageIds: readonly string[];
  readonly parentSectionId?: string;
  readonly entityHintIds: readonly string[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapTableSegment {
  readonly pageId: string;
  readonly position: 'START' | 'CONTINUE' | 'END' | 'WHOLE';
  readonly inheritedHeaderBlockIds: readonly string[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapTable {
  readonly tableId: string;
  readonly documentId: string;
  readonly titleHint?: string;
  readonly pageIds: readonly string[];
  readonly headerBlockIds: readonly string[];
  readonly segments: readonly CommercialDocumentMapTableSegment[];
  readonly approximateRowCount?: number;
  readonly columnHeaderLabels: readonly string[];
  readonly entityHintIds: readonly string[];
  readonly footnoteNoteIds: readonly string[];
  readonly contextEdgeIds: readonly string[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapNote {
  readonly noteId: string;
  readonly documentId: string;
  readonly pageId: string;
  readonly noteKind: CommercialDocumentNoteKind;
  readonly relevantForExtraction: boolean;
  readonly sectionIds: readonly string[];
  readonly tableIds: readonly string[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapEntityHint {
  readonly entityHintId: string;
  readonly documentId: string;
  readonly hintKind: CommercialDocumentEntityHintKind;
  readonly value: string;
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialDocumentMapContextEdge {
  readonly contextEdgeId: string;
  readonly relation: CommercialDocumentContextRelation;
  readonly from: CommercialDocumentMapRef;
  readonly to: CommercialDocumentMapRef;
  readonly reason: string;
}

export interface CommercialDocumentMapV1 {
  readonly schemaVersion: typeof COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION;
  readonly documentCount: number;
  readonly pageCount: number;
  readonly documents: readonly CommercialDocumentMapDocument[];
  readonly pages: readonly CommercialDocumentMapPage[];
  readonly contentBlocks: readonly CommercialDocumentMapContentBlock[];
  readonly sections: readonly CommercialDocumentMapSection[];
  readonly tables: readonly CommercialDocumentMapTable[];
  readonly notes: readonly CommercialDocumentMapNote[];
  readonly entityHints: readonly CommercialDocumentMapEntityHint[];
  readonly contextEdges: readonly CommercialDocumentMapContextEdge[];
}

export const COMMERCIAL_EXTRACTION_UNIT_TYPES = [
  'TABLE',
  'SECTION',
  'FAMILY',
  'CHANNEL',
  'PAGE_RANGE_FALLBACK',
] as const;
export type CommercialExtractionUnitType = (typeof COMMERCIAL_EXTRACTION_UNIT_TYPES)[number];

export interface CommercialExtractionUnitOverlap {
  readonly refType: 'PAGE' | 'CONTENT_BLOCK' | 'NOTE';
  readonly refId: string;
  readonly usage: 'CONTEXT_ONLY' | 'PARTITION_PRIMARY';
  readonly reason:
    | 'INHERITED_HEADER'
    | 'SHARED_NOTE'
    | 'DOCUMENT_RULE'
    | 'SECTION_CONTEXT'
    | 'TABLE_PARTITION'
    | 'CONTEXT_EDGE';
}

export interface CommercialExtractionUnit {
  readonly unitId: string;
  readonly unitType: CommercialExtractionUnitType;
  readonly ordinal: number;
  readonly documentId: string;
  readonly primaryPageIds: readonly string[];
  readonly contextPageIds: readonly string[];
  readonly primaryContentBlockIds: readonly string[];
  readonly contextContentBlockIds: readonly string[];
  readonly sectionIds: readonly string[];
  readonly tableIds: readonly string[];
  readonly noteIds: readonly string[];
  readonly entityHintIds: readonly string[];
  readonly expectedTableRows?: number;
  readonly logicalTableId?: string;
  readonly partition?: { readonly index: number; readonly count: number };
  readonly reason: string;
  readonly overlaps: readonly CommercialExtractionUnitOverlap[];
}

export interface CommercialExtractionUnitPlanCoverage {
  readonly allPagesClassified: boolean;
  readonly assignedPageIds: readonly string[];
  readonly assignedSectionIds: readonly string[];
  readonly assignedTableIds: readonly string[];
  readonly reachableNoteIds: readonly string[];
  readonly assignedPrimaryContentBlockIds: readonly string[];
  readonly orphanPageIds: readonly string[];
  readonly orphanSectionIds: readonly string[];
  readonly orphanTableIds: readonly string[];
  readonly unreachableNoteIds: readonly string[];
  readonly orphanContentBlockIds: readonly string[];
}

export interface CommercialExtractionUnitPlanV1 {
  readonly schemaVersion: typeof COMMERCIAL_EXTRACTION_UNIT_PLAN_SCHEMA_VERSION;
  readonly sourceMapSchemaVersion: typeof COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION;
  readonly units: readonly CommercialExtractionUnit[];
  readonly coverage: CommercialExtractionUnitPlanCoverage;
}
