import { strFromU8, unzipSync } from 'fflate';

import type { MatrixCell, MatrixRow } from './vehicle-specs-matrix-dry-run';

const MAX_COMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 350 * 1024 * 1024;
const SPEC_DB_SHEET = 'Spec DB';
const REQUIRED_METADATA_CODES = Object.freeze(['SC_0001', 'SC_0002', 'SC_0003', 'SC_0004', 'SC_0005'] as const);

export const V74_EXCLUDED_TORQUE_ALIAS_CODES = Object.freeze([
  'PW_0013',
  'PW_0024',
  'PW_0027',
  'PW_0034',
] as const);

export const V74_TORQUE_ALIAS_TARGETS: Readonly<Record<string, string>> = Object.freeze({
  PW_0013: 'PW_0012',
  PW_0024: 'PW_0023',
  PW_0027: 'PW_0026',
  PW_0034: 'PW_0033',
});

export type V74SpecMappingAction =
  | 'DIRECT'
  | 'REMAP'
  | 'COMPOUND_REMAP'
  | 'VALUE_NORMALIZATION'
  | 'EXCLUDE_REDUNDANT_ALIAS';

export interface V74SpecMappingEntry {
  readonly sourceCode: string;
  readonly targetCode: string | null;
  readonly action: V74SpecMappingAction;
  readonly reason: string;
  readonly nonEmptyCells: number;
}

export interface V74SourceWarning {
  readonly category: 'ALIAS_WITHOUT_CANONICAL' | 'ALIAS_CONVERSION_MISMATCH';
  readonly sourceCode: string;
  readonly targetCode: string;
  readonly sourceColumn: string;
  readonly aliasValue: MatrixCell;
  readonly canonicalValue: MatrixCell;
  readonly message: string;
}

export interface ProductPriceToolV74Matrix {
  readonly sourceRows: readonly MatrixRow[];
  readonly normalizedRows: readonly MatrixRow[];
  readonly sourceColumns: readonly string[];
  readonly mappings: readonly V74SpecMappingEntry[];
  readonly warnings: readonly V74SourceWarning[];
}

type CellValue = string | number | boolean | null;

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
  if (!bytes) throw new Error(`Product Price Tool V.74: OpenXML part ausente: ${path}.`);
  return strFromU8(bytes);
}

function normalizePartPath(target: string): string {
  const normalized = target.replace(/\\/gu, '/').replace(/^\//u, '');
  return normalized.startsWith('xl/') ? normalized : `xl/${normalized.replace(/^\.\//u, '')}`;
}

function columnName(cellReference: string): string {
  const match = /^[A-Z]+/u.exec(cellReference.toUpperCase());
  if (!match) throw new Error(`Referência de célula inválida: ${cellReference}.`);
  return match[0];
}

function parseSharedStrings(xml: string | undefined): readonly string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/gu)].map((match) =>
    textNodes(match[1] ?? ''),
  );
}

function parseCellValue(attributes: string, content: string, sharedStrings: readonly string[]): CellValue {
  const type = attribute(attributes, 't');
  if (type === 'inlineStr') return textNodes(content);
  const valueMatch = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/u.exec(content);
  if (!valueMatch) return null;
  const raw = decodeXml(valueMatch[1] ?? '');
  if (type === 's') {
    const index = Number(raw);
    if (!Number.isSafeInteger(index) || sharedStrings[index] === undefined) {
      throw new Error(`Índice inválido em sharedStrings: ${raw}.`);
    }
    return sharedStrings[index] ?? null;
  }
  if (type === 'b') return raw === '1';
  if (type === 'str' || type === 'e') return raw;
  const numeric = Number(raw);
  return raw !== '' && Number.isFinite(numeric) ? numeric : raw;
}

function worksheetRows(xml: string, sharedStrings: readonly string[]): readonly Map<string, CellValue>[] {
  const rows: Map<string, CellValue>[] = [];
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?row>/gu)) {
    const cells = new Map<string, CellValue>();
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(
      /<(?:\w+:)?c(\s[^>]*?)(?:\/\s*>|>([\s\S]*?)<\/(?:\w+:)?c>)/gu,
    )) {
      const attributes = cellMatch[1] ?? '';
      const reference = attribute(attributes, 'r');
      if (!reference) continue;
      cells.set(columnName(reference), parseCellValue(attributes, cellMatch[2] ?? '', sharedStrings));
    }
    rows.push(cells);
  }
  return rows;
}

function text(value: MatrixCell): string {
  return String(value ?? '').trim();
}

function isSelected(value: MatrixCell): boolean {
  return ['s', 'true', '1'].includes(text(value).toLocaleLowerCase('pt-BR'));
}

function isZero(value: MatrixCell): boolean {
  return text(value) === '0';
}

function normalizedYear(value: MatrixCell): MatrixCell {
  const raw = text(value).replace(/\.0+$/u, '');
  const compact = /^(\d{2})(\d{2})$/u.exec(raw);
  if (compact) return `${compact[1]}/${compact[2]}`;
  return value;
}

function countNonEmpty(row: MatrixRow, sourceColumns: readonly string[]): number {
  return sourceColumns.filter((column) => text(row[column]) !== '').length;
}

function rowByCode(rows: readonly MatrixRow[]): Map<string, MatrixRow> {
  const result = new Map<string, MatrixRow>();
  for (const row of rows) {
    const code = text(row.code);
    if (!code) continue;
    if (result.has(code)) throw new Error(`Spec DB: code duplicado ${code}.`);
    result.set(code, row);
  }
  return result;
}

function parseNumericLoose(value: MatrixCell): number | null {
  const raw = text(value).replace(/\s/gu, '').replace(',', '.');
  if (!raw || !/^-?\d+(?:\.\d+)?$/u.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function auditTorqueAliases(rows: readonly MatrixRow[], sourceColumns: readonly string[]): readonly V74SourceWarning[] {
  const byCode = rowByCode(rows);
  const warnings: V74SourceWarning[] = [];
  for (const [aliasCode, canonicalCode] of Object.entries(V74_TORQUE_ALIAS_TARGETS)) {
    const alias = byCode.get(aliasCode);
    const canonical = byCode.get(canonicalCode);
    if (!alias) continue;
    for (const sourceColumn of sourceColumns) {
      const aliasValue = alias[sourceColumn];
      if (text(aliasValue) === '') continue;
      const canonicalValue = canonical?.[sourceColumn];
      if (text(canonicalValue) === '') {
        warnings.push({
          category: 'ALIAS_WITHOUT_CANONICAL',
          sourceCode: aliasCode,
          targetCode: canonicalCode,
          sourceColumn,
          aliasValue,
          canonicalValue,
          message: `${aliasCode} possui valor em kgfm sem ${canonicalCode} canônico em Nm.`,
        });
        continue;
      }
      const kgfm = parseNumericLoose(aliasValue);
      const nm = parseNumericLoose(canonicalValue);
      if (kgfm === null || nm === null) continue;
      const expectedNm = kgfm * 9.80665;
      const tolerance = Math.max(1, Math.abs(nm) * 0.02);
      if (Math.abs(expectedNm - nm) > tolerance) {
        warnings.push({
          category: 'ALIAS_CONVERSION_MISMATCH',
          sourceCode: aliasCode,
          targetCode: canonicalCode,
          sourceColumn,
          aliasValue,
          canonicalValue,
          message: `${aliasCode}=${kgfm} kgfm sugere ${expectedNm.toFixed(2)} Nm, diferente de ${canonicalCode}=${nm} Nm (>2%). O conector preserva o valor canônico em Nm.`,
        });
      }
    }
  }
  return warnings;
}

export function normalizeProductPriceToolV74Rows(sourceRows: readonly MatrixRow[]): ProductPriceToolV74Matrix {
  const sourceByCode = rowByCode(sourceRows);
  for (const required of REQUIRED_METADATA_CODES) {
    if (!sourceByCode.has(required)) throw new Error(`Spec DB não contém ${required}.`);
  }
  const brandRow = sourceByCode.get('SC_0002')!;
  const sourceColumns = Object.keys(brandRow).filter((column) => column !== 'code' && text(brandRow[column]) !== '');
  if (sourceColumns.length === 0) throw new Error('Spec DB não contém colunas de veículos.');

  const warnings = auditTorqueAliases(sourceRows, sourceColumns);
  const mappings: V74SpecMappingEntry[] = [];
  const normalized: MatrixRow[] = [];

  const add = (sourceCode: string, targetCode: string | null, action: V74SpecMappingAction, reason: string, row?: MatrixRow) => {
    mappings.push({
      sourceCode,
      targetCode,
      action,
      reason,
      nonEmptyCells: row ? countNonEmpty(row, sourceColumns) : 0,
    });
  };

  for (const metadataCode of REQUIRED_METADATA_CODES) {
    const source = sourceByCode.get(metadataCode)!;
    const values: Record<string, MatrixCell> = { ...source, code: metadataCode };
    if (metadataCode === 'SC_0005') {
      for (const column of sourceColumns) values[column] = normalizedYear(source[column]);
    }
    normalized.push(values);
  }

  const tiltRight = sourceByCode.get('EX_0030');
  const tiltLeft = sourceByCode.get('EX_0031');
  const tiltRightTarget: Record<string, MatrixCell> = { code: 'EX_0030' };
  const tiltLeftTarget: Record<string, MatrixCell> = { code: 'EX_1006' };
  const tiltBothTarget: Record<string, MatrixCell> = { code: 'EX_0031' };
  const tiltNoneTarget: Record<string, MatrixCell> = { code: 'EX_1012' };
  if (tiltRight || tiltLeft) {
    for (const column of sourceColumns) {
      const rightRaw = tiltRight?.[column];
      const leftRaw = tiltLeft?.[column];
      const right = isSelected(rightRaw);
      const left = isSelected(leftRaw);
      if (right && left) tiltBothTarget[column] = 'S';
      else if (right) tiltRightTarget[column] = 'S';
      else if (left) tiltLeftTarget[column] = 'S';
      else if (isZero(rightRaw) || isZero(leftRaw)) tiltNoneTarget[column] = 'S';
      else {
        if (text(rightRaw) !== '') tiltRightTarget[column] = rightRaw;
        if (text(leftRaw) !== '') tiltLeftTarget[column] = leftRaw;
      }
    }
    normalized.push(tiltRightTarget, tiltLeftTarget, tiltBothTarget, tiltNoneTarget);
    if (tiltRight) add('EX_0030', 'EX_0030 / EX_0031', 'COMPOUND_REMAP', 'Tilt-down direito; combinado com esquerdo vira Both (EX_0031).', tiltRight);
    if (tiltLeft) add('EX_0031', 'EX_1006 / EX_0031', 'COMPOUND_REMAP', 'No V.74 EX_0031 significa Left; no DB atual Left=EX_1006 e Both=EX_0031.', tiltLeft);
  }

  for (const source of sourceRows) {
    const sourceCode = text(source.code);
    if (!sourceCode || REQUIRED_METADATA_CODES.includes(sourceCode as (typeof REQUIRED_METADATA_CODES)[number])) continue;
    if (sourceCode === 'EX_0030' || sourceCode === 'EX_0031') continue;
    if (V74_EXCLUDED_TORQUE_ALIAS_CODES.includes(sourceCode as (typeof V74_EXCLUDED_TORQUE_ALIAS_CODES)[number])) {
      add(sourceCode, V74_TORQUE_ALIAS_TARGETS[sourceCode] ?? null, 'EXCLUDE_REDUNDANT_ALIAS', 'Alias kgfm redundante; o DB preserva exclusivamente o torque canônico em Nm.', source);
      continue;
    }

    let targetCode = sourceCode;
    let action: V74SpecMappingAction = 'DIRECT';
    let reason = 'Mesmo spec_code e mesma semântica no perfil V.74.';
    if (sourceCode === 'PW_0016') {
      targetCode = 'PW_1045';
      action = 'REMAP';
      reason = 'No V.74 PW_0016=AT; no DB atual PW_0016=MT baseline e AT=PW_1045.';
    }

    const target: Record<string, MatrixCell> = { ...source, code: targetCode };
    let normalizedValues = false;
    for (const column of sourceColumns) {
      const raw = source[column];
      const lower = text(raw).toLocaleLowerCase('pt-BR');
      if (sourceCode === 'CO_0033' && lower === 'alert&can be closed') {
        target[column] = 'S';
        normalizedValues = true;
      }
      if (sourceCode === 'SF_0041' && lower === 'usb') {
        target[column] = '0';
        normalizedValues = true;
      }
    }

    if (sourceCode === 'SF_0034') {
      const camera360 = sourceByCode.get('SF_0035');
      if (camera360) {
        for (const column of sourceColumns) {
          if (isSelected(source[column]) && isSelected(camera360[column])) {
            target[column] = '0';
            normalizedValues = true;
          }
        }
      }
    }

    if (normalizedValues && action === 'DIRECT') {
      action = 'VALUE_NORMALIZATION';
      reason =
        sourceCode === 'CO_0033'
          ? 'Valor legado “Alert&Can be closed” normalizado para presente=true.'
          : sourceCode === 'SF_0041'
            ? 'Valor legado “USB” não representa Dashcam; normalizado para presente=false.'
            : sourceCode === 'SF_0034'
              ? 'Quando RVM e 360° aparecem juntos, 360° é o membro mais específico e RVM é desmarcado.'
              : reason;
    }

    normalized.push(target);
    add(sourceCode, targetCode, action, reason, source);
  }

  const duplicateCodes = normalized
    .map((row) => text(row.code))
    .filter((code, index, all) => code && all.indexOf(code) !== index);
  if (duplicateCodes.length) throw new Error(`Normalização V.74 gerou codes duplicados: ${[...new Set(duplicateCodes)].join(', ')}.`);

  return Object.freeze({
    sourceRows: Object.freeze([...sourceRows]),
    normalizedRows: Object.freeze(normalized),
    sourceColumns: Object.freeze(sourceColumns),
    mappings: Object.freeze(mappings.sort((a, b) => a.sourceCode.localeCompare(b.sourceCode))),
    warnings: Object.freeze(warnings),
  });
}

export function parseProductPriceToolV74(input: Uint8Array | ArrayBuffer): ProductPriceToolV74Matrix {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_COMPRESSED_BYTES) throw new Error('Product Price Tool excede 80 MiB compactados.');
  const files = unzipSync(bytes);
  const uncompressed = Object.values(files).reduce((sum, value) => sum + value.byteLength, 0);
  if (uncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('Product Price Tool excede 350 MiB descompactados.');

  const workbook = xmlEntry(files, 'xl/workbook.xml');
  const relationships = xmlEntry(files, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = parseSharedStrings(files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : undefined);
  const targets = new Map<string, string>();
  for (const match of relationships.matchAll(/<(?:\w+:)?Relationship(\s[^>]*?)\/?\s*>/gu)) {
    const id = attribute(match[1] ?? '', 'Id');
    const target = attribute(match[1] ?? '', 'Target');
    if (id && target) targets.set(id, normalizePartPath(target));
  }

  let sheetPath: string | undefined;
  for (const match of workbook.matchAll(/<(?:\w+:)?sheet(\s[^>]*?)\/?\s*>/gu)) {
    const attributes = match[1] ?? '';
    const name = attribute(attributes, 'name');
    const relationId = attribute(attributes, 'r:id');
    if (name === SPEC_DB_SHEET && relationId) sheetPath = targets.get(relationId);
  }
  if (!sheetPath) throw new Error(`Aba obrigatória “${SPEC_DB_SHEET}” não encontrada.`);

  const worksheet = worksheetRows(xmlEntry(files, sheetPath), sharedStrings);
  const sourceRows: MatrixRow[] = [];
  for (const cells of worksheet) {
    const code = String(cells.get('A') ?? '').trim();
    if (!code) continue;
    const row: Record<string, MatrixCell> = { code };
    for (const [column, value] of cells) {
      if (column === 'A') continue;
      row[column] = value;
    }
    sourceRows.push(row);
  }
  return normalizeProductPriceToolV74Rows(sourceRows);
}
