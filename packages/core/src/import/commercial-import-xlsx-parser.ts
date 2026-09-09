import { strFromU8, unzipSync } from 'fflate';

import {
  COMMERCIAL_IMPORT_COLUMNS,
  COMMERCIAL_IMPORT_REQUIRED_SHEETS,
  CommercialImportContractParseError,
  type CommercialImportContractV1,
  type CommercialImportDiagnostic,
  type CommercialImportEvidenceV1,
  type CommercialImportIssueV1,
  type CommercialImportMetadataV1,
  type CommercialImportOfferPolicyV1,
  type CommercialImportOfferV1,
  type CommercialImportPolicyV1,
  type CommercialImportProductV1,
  type CommercialImportRequiredSheet,
} from './commercial-import-contract';

const MAX_COMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 50_000;
const ALLOWED_SHEETS = new Set<string>([...COMMERCIAL_IMPORT_REQUIRED_SHEETS, 'README']);

type CellValue = string | number | boolean | null;
type RawRow = Readonly<Record<string, CellValue>>;
type ParsedSheets = Readonly<Record<CommercialImportRequiredSheet, readonly RawRow[]>>;

const XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

function decodeXml(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/giu, (_match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return XML_ENTITIES[entity] ?? _match;
  });
}

function attribute(fragment: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(fragment);
  return match ? decodeXml(match[1] ?? '') : undefined;
}

function textNodes(xml: string): string {
  return [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/gu)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
}

function xmlEntry(files: Readonly<Record<string, Uint8Array>>, path: string): string {
  const bytes = files[path];
  if (!bytes) throw new Error(`Required OpenXML part is missing: ${path}`);
  return strFromU8(bytes);
}

function normalizePartPath(target: string): string {
  const normalized = target.replace(/\\/gu, '/').replace(/^\//u, '');
  return normalized.startsWith('xl/') ? normalized : `xl/${normalized.replace(/^\.\//u, '')}`;
}

function columnName(cellReference: string): string {
  const match = /^[A-Z]+/u.exec(cellReference.toUpperCase());
  if (!match) throw new Error(`Invalid cell reference: ${cellReference}`);
  return match[0];
}

function parseSharedStrings(xml: string | undefined): readonly string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/gu)].map((match) =>
    textNodes(match[1] ?? ''),
  );
}

function parseCellValue(
  attributes: string,
  content: string,
  sharedStrings: readonly string[],
): CellValue {
  const type = attribute(attributes, 't');
  if (type === 'inlineStr') return textNodes(content);
  const valueMatch = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/u.exec(content);
  if (!valueMatch) return null;
  const raw = decodeXml(valueMatch[1] ?? '');
  if (type === 's') {
    const index = Number(raw);
    if (!Number.isSafeInteger(index) || sharedStrings[index] === undefined)
      throw new Error(`Invalid shared string index: ${raw}`);
    return sharedStrings[index] ?? null;
  }
  if (type === 'b') {
    if (raw === '1') return true;
    if (raw === '0') return false;
    throw new Error(`Invalid boolean cell value: ${raw}`);
  }
  if (type === 'str' || type === 'e') return raw;
  const numeric = Number(raw);
  return raw !== '' && Number.isFinite(numeric) ? numeric : raw;
}

function worksheetRows(
  xml: string,
  sharedStrings: readonly string[],
): readonly Map<string, CellValue>[] {
  const rows: Map<string, CellValue>[] = [];
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?row>/gu)) {
    if (rows.length >= MAX_ROWS_PER_SHEET) throw new Error('Worksheet row limit exceeded.');
    const cells = new Map<string, CellValue>();
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(
      /<(?:\w+:)?c(\s[^>]*?)(?:\/\s*>|>([\s\S]*?)<\/(?:\w+:)?c>)/gu,
    )) {
      const attributes = cellMatch[1] ?? '';
      const reference = attribute(attributes, 'r');
      if (!reference) throw new Error('Cell without a reference.');
      cells.set(
        columnName(reference),
        parseCellValue(attributes, cellMatch[2] ?? '', sharedStrings),
      );
    }
    rows.push(cells);
  }
  return rows;
}

function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
}

function parseSheet(
  sheet: CommercialImportRequiredSheet,
  xml: string,
  sharedStrings: readonly string[],
  diagnostics: CommercialImportDiagnostic[],
): readonly RawRow[] {
  const worksheet = worksheetRows(xml, sharedStrings);
  const header = worksheet[0];
  const expected = COMMERCIAL_IMPORT_COLUMNS[sheet];
  if (!header) {
    diagnostics.push({
      code: 'MISSING_COLUMN',
      sheet,
      row: 1,
      message: `${sheet} has no header row.`,
    });
    return [];
  }
  const actualByColumn = new Map<string, string>();
  for (const [column, value] of header) {
    const name = cellText(value).trim();
    if (name) actualByColumn.set(column, name);
  }
  const names = [...actualByColumn.values()];
  for (const required of expected) {
    if (!names.includes(required))
      diagnostics.push({
        code: 'MISSING_COLUMN',
        sheet,
        row: 1,
        column: required,
        message: `${sheet} is missing required column ${required}.`,
      });
  }
  for (const name of names) {
    if (names.filter((candidate) => candidate === name).length > 1)
      diagnostics.push({
        code: 'DUPLICATE_COLUMN',
        sheet,
        row: 1,
        column: name,
        message: `${sheet} contains duplicate column ${name}.`,
      });
    if (!(expected as readonly string[]).includes(name))
      diagnostics.push({
        code: 'UNEXPECTED_COLUMN',
        sheet,
        row: 1,
        column: name,
        message: `${sheet} contains unexpected column ${name}.`,
      });
  }
  if (diagnostics.some((item) => item.sheet === sheet)) return [];
  const columnByName = new Map([...actualByColumn].map(([column, name]) => [name, column]));
  return worksheet.slice(1).flatMap((cells) => {
    const material = expected.some((name) => {
      const value = cells.get(columnByName.get(name) ?? '');
      return value !== null && value !== undefined && cellText(value).trim() !== '';
    });
    if (!material) return [];
    return [
      Object.fromEntries(
        expected.map((name) => [name, cells.get(columnByName.get(name) ?? '') ?? null]),
      ),
    ];
  });
}

function nullableText(row: RawRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  const text = cellText(value).trim();
  return text === '' ? null : text;
}

function requiredText(row: RawRow, column: string): string {
  return nullableText(row, column) ?? '';
}

function nullableNumber(
  row: RawRow,
  column: string,
  sheet: CommercialImportRequiredSheet,
  rowNumber: number,
  diagnostics: CommercialImportDiagnostic[],
): number | null {
  const value = row[column];
  if (value === null || value === undefined || cellText(value).trim() === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isFinite(parsed)) return parsed;
  diagnostics.push({
    code: 'INVALID_CELL_TYPE',
    sheet,
    row: rowNumber,
    column,
    message: `${sheet}!${column} must be numeric.`,
  });
  return null;
}

function nullableBoolean(
  row: RawRow,
  column: string,
  rowNumber: number,
  diagnostics: CommercialImportDiagnostic[],
): boolean | null {
  const value = row[column];
  if (value === null || value === undefined || cellText(value).trim() === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'não', 'nao'].includes(normalized)) return false;
  diagnostics.push({
    code: 'INVALID_CELL_TYPE',
    sheet: 'Issues',
    row: rowNumber,
    column,
    message: `Issues!${column} must be boolean.`,
  });
  return null;
}

function moneyText(row: RawRow, column: string): string | null {
  const value = row[column];
  if (typeof value === 'number') return value.toString();
  return nullableText(row, column);
}

function mapMetadata(row: RawRow): CommercialImportMetadataV1 {
  return {
    contractVersion: requiredText(row, 'contract_version'),
    sourceDocumentName: nullableText(row, 'source_document_name'),
    sourceDocumentSha256: nullableText(row, 'source_document_sha256'),
    issuerBrand: nullableText(row, 'issuer_brand'),
    competence: nullableText(row, 'competence'),
    periodKind: nullableText(row, 'period_kind'),
    validFrom: nullableText(row, 'valid_from'),
    validTo: nullableText(row, 'valid_to'),
    generatedAt: nullableText(row, 'generated_at'),
    extractionMethod: nullableText(row, 'extraction_method'),
    promptVersion: nullableText(row, 'prompt_version'),
    handbookVersion: nullableText(row, 'handbook_version'),
    sourceChannel: nullableText(row, 'source_channel'),
    notes: nullableText(row, 'notes'),
  };
}

function mapProduct(
  row: RawRow,
  index: number,
  diagnostics: CommercialImportDiagnostic[],
): CommercialImportProductV1 {
  return {
    productExternalKey: nullableText(row, 'product_external_key'),
    brand: nullableText(row, 'brand'),
    model: nullableText(row, 'model'),
    version: nullableText(row, 'version'),
    productionYear: nullableNumber(row, 'production_year', 'Products', index + 2, diagnostics),
    modelYear: nullableNumber(row, 'model_year', 'Products', index + 2, diagnostics),
    sourceMvs: nullableText(row, 'source_mvs'),
    sourcePage: nullableNumber(row, 'source_page', 'Products', index + 2, diagnostics),
    sourceReference: nullableText(row, 'source_reference'),
    confidenceStatus: nullableText(row, 'confidence_status'),
    confidenceScore: nullableNumber(row, 'confidence_score', 'Products', index + 2, diagnostics),
    reasonCode: nullableText(row, 'reason_code'),
    resolutionStatus: nullableText(row, 'resolution_status'),
    resolvedProductId: nullableText(row, 'resolved_product_id'),
    notes: nullableText(row, 'notes'),
  };
}

function mapPolicy(
  row: RawRow,
  index: number,
  diagnostics: CommercialImportDiagnostic[],
): CommercialImportPolicyV1 {
  const number = (column: string) =>
    nullableNumber(row, column, 'Policies', index + 2, diagnostics);
  return {
    policyExternalKey: nullableText(row, 'policy_external_key'),
    productExternalKey: nullableText(row, 'product_external_key'),
    competence: nullableText(row, 'competence'),
    policyType: nullableText(row, 'policy_type'),
    title: nullableText(row, 'title'),
    description: nullableText(row, 'description'),
    startsOn: nullableText(row, 'starts_on'),
    endsOn: nullableText(row, 'ends_on'),
    amount: moneyText(row, 'amount'),
    dealerRebateAmount: moneyText(row, 'dealer_rebate_amount'),
    customerBenefitAmount: moneyText(row, 'customer_benefit_amount'),
    valueOrigin: nullableText(row, 'value_origin'),
    termMonths: number('term_months'),
    customerInterestRateMonthly: moneyText(row, 'customer_interest_rate_monthly'),
    downPaymentPercentage: moneyText(row, 'down_payment_percentage'),
    financedPrincipal: moneyText(row, 'financed_principal'),
    annualRate: moneyText(row, 'annual_rate'),
    offerMonth: number('offer_month'),
    remainingMonths: number('remaining_months'),
    coverageYears: moneyText(row, 'coverage_years'),
    maintenanceCount: number('maintenance_count'),
    coverageMonths: number('coverage_months'),
    coverageKm: moneyText(row, 'coverage_km'),
    voucherType: nullableText(row, 'voucher_type'),
    calculationBasePriceId: nullableText(row, 'calculation_base_price_id'),
    financialParameterSetId: nullableText(row, 'financial_parameter_set_id'),
    eligibilityOrRestriction: nullableText(row, 'eligibility_or_restriction'),
    confidenceStatus: nullableText(row, 'confidence_status'),
    confidenceScore: number('confidence_score'),
    reasonCode: nullableText(row, 'reason_code'),
    sourcePage: number('source_page'),
    sourceReference: nullableText(row, 'source_reference'),
    notes: nullableText(row, 'notes'),
  };
}

function mapOffer(
  row: RawRow,
  index: number,
  diagnostics: CommercialImportDiagnostic[],
): CommercialImportOfferV1 {
  return {
    offerExternalKey: nullableText(row, 'offer_external_key'),
    productExternalKey: nullableText(row, 'product_external_key'),
    competence: nullableText(row, 'competence'),
    validFrom: nullableText(row, 'valid_from'),
    validTo: nullableText(row, 'valid_to'),
    publicPriceId: nullableText(row, 'public_price_id'),
    publicPriceAmount: moneyText(row, 'public_price_amount'),
    benefitAmount: moneyText(row, 'benefit_amount'),
    transactionalPrice: moneyText(row, 'transactional_price'),
    confidenceStatus: nullableText(row, 'confidence_status'),
    confidenceScore: nullableNumber(row, 'confidence_score', 'Offers', index + 2, diagnostics),
    reasonCode: nullableText(row, 'reason_code'),
    sourcePage: nullableNumber(row, 'source_page', 'Offers', index + 2, diagnostics),
    sourceReference: nullableText(row, 'source_reference'),
    notes: nullableText(row, 'notes'),
  };
}

function mapOfferPolicy(row: RawRow): CommercialImportOfferPolicyV1 {
  return {
    offerExternalKey: nullableText(row, 'offer_external_key'),
    policyExternalKey: nullableText(row, 'policy_external_key'),
  };
}

function mapIssue(
  row: RawRow,
  index: number,
  diagnostics: CommercialImportDiagnostic[],
): CommercialImportIssueV1 {
  return {
    issueExternalKey: nullableText(row, 'issue_external_key'),
    entityType: nullableText(row, 'entity_type'),
    entityKey: nullableText(row, 'entity_key'),
    severity: nullableText(row, 'severity'),
    reasonCode: nullableText(row, 'reason_code'),
    explanation: nullableText(row, 'explanation'),
    decisionTaken: nullableText(row, 'decision_taken'),
    sourcePage: nullableNumber(row, 'source_page', 'Issues', index + 2, diagnostics),
    sourceReference: nullableText(row, 'source_reference'),
    promptVersion: nullableText(row, 'prompt_version'),
    blocksApply: nullableBoolean(row, 'blocks_apply', index + 2, diagnostics),
  };
}

function mapEvidence(
  row: RawRow,
  index: number,
  diagnostics: CommercialImportDiagnostic[],
): CommercialImportEvidenceV1 {
  return {
    evidenceExternalKey: nullableText(row, 'evidence_external_key'),
    entityType: nullableText(row, 'entity_type'),
    entityKey: nullableText(row, 'entity_key'),
    sourceDocumentName: nullableText(row, 'source_document_name'),
    sourcePage: nullableNumber(row, 'source_page', 'Evidence', index + 2, diagnostics),
    tableOrBlockReference: nullableText(row, 'table_or_block_reference'),
    cellReference: nullableText(row, 'cell_reference'),
    evidenceExcerpt: nullableText(row, 'evidence_excerpt'),
    valueOrigin: nullableText(row, 'value_origin'),
    notes: nullableText(row, 'notes'),
  };
}

export function parseCommercialImportContractV1(
  input: Uint8Array | ArrayBuffer,
): CommercialImportContractV1 {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_COMPRESSED_BYTES)
    throw new CommercialImportContractParseError([
      { code: 'WORKBOOK_LIMIT_EXCEEDED', message: 'Compressed workbook exceeds 25 MiB.' },
    ]);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    throw new CommercialImportContractParseError(
      [{ code: 'INVALID_XLSX', message: 'Input is not a readable XLSX/OpenXML workbook.' }],
      { cause: error },
    );
  }
  if (
    Object.values(files).reduce((sum, value) => sum + value.byteLength, 0) > MAX_UNCOMPRESSED_BYTES
  )
    throw new CommercialImportContractParseError([
      { code: 'WORKBOOK_LIMIT_EXCEEDED', message: 'Uncompressed workbook exceeds 100 MiB.' },
    ]);

  const diagnostics: CommercialImportDiagnostic[] = [];
  try {
    const workbook = xmlEntry(files, 'xl/workbook.xml');
    const relationships = xmlEntry(files, 'xl/_rels/workbook.xml.rels');
    const sharedStrings = parseSharedStrings(
      files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : undefined,
    );
    const relationshipTargets = new Map<string, string>();
    for (const match of relationships.matchAll(/<(?:\w+:)?Relationship(\s[^>]*?)\/?\s*>/gu)) {
      const id = attribute(match[1] ?? '', 'Id');
      const target = attribute(match[1] ?? '', 'Target');
      if (id && target) relationshipTargets.set(id, normalizePartPath(target));
    }
    const sheetEntries: { name: string; path: string }[] = [];
    for (const match of workbook.matchAll(/<(?:\w+:)?sheet(\s[^>]*?)\/?\s*>/gu)) {
      const attributes = match[1] ?? '';
      const name = attribute(attributes, 'name');
      const relationId = attribute(attributes, 'r:id');
      const path = relationId ? relationshipTargets.get(relationId) : undefined;
      if (name && path) sheetEntries.push({ name, path });
    }
    for (const required of COMMERCIAL_IMPORT_REQUIRED_SHEETS) {
      const count = sheetEntries.filter((sheet) => sheet.name === required).length;
      if (count === 0)
        diagnostics.push({
          code: 'MISSING_SHEET',
          sheet: required,
          message: `Required sheet ${required} is missing.`,
        });
      if (count > 1)
        diagnostics.push({
          code: 'DUPLICATE_SHEET',
          sheet: required,
          message: `Required sheet ${required} is duplicated.`,
        });
    }
    for (const sheet of sheetEntries) {
      if (!ALLOWED_SHEETS.has(sheet.name))
        diagnostics.push({
          code: 'UNEXPECTED_SHEET',
          sheet: sheet.name,
          message: `Unexpected sheet ${sheet.name}.`,
        });
    }
    if (diagnostics.length) throw new CommercialImportContractParseError(diagnostics);
    const parsed = {} as Record<CommercialImportRequiredSheet, readonly RawRow[]>;
    for (const required of COMMERCIAL_IMPORT_REQUIRED_SHEETS) {
      const entry = sheetEntries.find((sheet) => sheet.name === required);
      if (!entry) continue;
      parsed[required] = parseSheet(
        required,
        xmlEntry(files, entry.path),
        sharedStrings,
        diagnostics,
      );
    }
    if (diagnostics.length) throw new CommercialImportContractParseError(diagnostics);
    const sheets = parsed as ParsedSheets;
    if (sheets.Metadata.length !== 1)
      diagnostics.push({
        code: 'INVALID_METADATA_CARDINALITY',
        sheet: 'Metadata',
        message: `Metadata must contain exactly one material data row; found ${sheets.Metadata.length}.`,
      });
    const metadata = mapMetadata(sheets.Metadata[0] ?? {});
    const contract: CommercialImportContractV1 = {
      metadata,
      products: sheets.Products.map((row, index) => mapProduct(row, index, diagnostics)),
      policies: sheets.Policies.map((row, index) => mapPolicy(row, index, diagnostics)),
      offers: sheets.Offers.map((row, index) => mapOffer(row, index, diagnostics)),
      offerPolicies: sheets.OfferPolicies.map(mapOfferPolicy),
      issues: sheets.Issues.map((row, index) => mapIssue(row, index, diagnostics)),
      evidence: sheets.Evidence.map((row, index) => mapEvidence(row, index, diagnostics)),
    };
    if (diagnostics.length) throw new CommercialImportContractParseError(diagnostics);
    return contract;
  } catch (error) {
    if (error instanceof CommercialImportContractParseError) throw error;
    throw new CommercialImportContractParseError(
      [{ code: 'INVALID_XLSX', message: 'Workbook OpenXML structure is invalid.' }],
      { cause: error },
    );
  }
}
