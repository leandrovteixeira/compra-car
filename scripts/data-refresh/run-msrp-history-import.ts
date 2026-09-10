import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';
const DEFAULT_WORKBOOK = 'Product Price Tool V.76.xlsm';

type CellValue = string | number | boolean | null;
type Product = {
  id: number;
  brand: string;
  model: string;
  version: string;
  production_year: number;
  model_year: number;
  is_active: boolean;
};
type MsrpRow = {
  excelRow: number;
  brand: string;
  model: string;
  version: string;
  productionYear: number;
  modelYear: number;
  msrp: number;
  month: number;
};
type MatchedRow = MsrpRow & { productId: number; startsOn: string };

function parseEnv(source: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    source
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error('Declaração inválida em arquivo de ambiente.');
        const value = line.slice(separator + 1).trim();
        return [line.slice(0, separator).trim(), /^(['"]).*\1$/u.test(value) ? value.slice(1, -1) : value];
      }),
  );
}

function readTarget(env: Readonly<Record<string, string>>) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('URL/publishable key read-only indisponíveis.');
  if (new URL(url).hostname !== `${STAGING_REF}.supabase.co`) {
    throw new Error(`Projeto inesperado; esperado ${STAGING_REF}.`);
  }
  return { url: url.replace(/\/$/u, ''), key };
}

async function get<T>(target: { url: string; key: string }, path: string): Promise<readonly T[]> {
  if (!path.startsWith('/rest/v1/')) throw new Error('Somente GET REST é permitido pelo reconciliador.');
  const response = await fetch(`${target.url}${path}`, {
    method: 'GET',
    headers: { apikey: target.key, Authorization: `Bearer ${target.key}` },
  });
  if (!response.ok) throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json() as Promise<readonly T[]>;
}

const decodeXml = (value: string) =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/giu, (_match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ({ amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' } as const)[entity as 'amp'] ?? _match;
  });

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
  if (!bytes) throw new Error(`OpenXML part ausente: ${path}`);
  return strFromU8(bytes);
}

function workbookSheetPath(files: Readonly<Record<string, Uint8Array>>, sheetName: string): string {
  const workbook = xmlEntry(files, 'xl/workbook.xml');
  const sheet = [...workbook.matchAll(/<(?:\w+:)?sheet\s([^>]*?)\/?\s*>/gu)].find(
    (match) => attribute(match[1] ?? '', 'name') === sheetName,
  );
  if (!sheet) throw new Error(`Aba ${sheetName} não encontrada.`);
  const relationshipId = attribute(sheet[1] ?? '', 'r:id');
  if (!relationshipId) throw new Error(`Relacionamento da aba ${sheetName} ausente.`);
  const rels = xmlEntry(files, 'xl/_rels/workbook.xml.rels');
  const relation = [...rels.matchAll(/<(?:\w+:)?Relationship\s([^>]*?)\/?\s*>/gu)].find(
    (match) => attribute(match[1] ?? '', 'Id') === relationshipId,
  );
  const target = relation ? attribute(relation[1] ?? '', 'Target') : undefined;
  if (!target) throw new Error(`Target da aba ${sheetName} ausente.`);
  const normalized = target.replace(/\\/gu, '/').replace(/^\//u, '').replace(/^\.\//u, '');
  return normalized.startsWith('xl/') ? normalized : `xl/${normalized}`;
}

function sharedStrings(files: Readonly<Record<string, Uint8Array>>): readonly string[] {
  const bytes = files['xl/sharedStrings.xml'];
  if (!bytes) return [];
  const xml = strFromU8(bytes);
  return [...xml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/gu)].map((match) =>
    textNodes(match[1] ?? ''),
  );
}

function parseCell(attributes: string, content: string, strings: readonly string[]): CellValue {
  const type = attribute(attributes, 't');
  if (type === 'inlineStr') return textNodes(content);
  const match = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/u.exec(content);
  if (!match) return null;
  const raw = decodeXml(match[1] ?? '');
  if (type === 's') return strings[Number(raw)] ?? null;
  if (type === 'b') return raw === '1';
  const numeric = Number(raw);
  return raw !== '' && Number.isFinite(numeric) ? numeric : raw;
}

function worksheetRows(xml: string, strings: readonly string[]) {
  return [...xml.matchAll(/<(?:\w+:)?row\s([^>]*?)>([\s\S]*?)<\/(?:\w+:)?row>/gu)].map((rowMatch) => {
    const rowNumber = Number(attribute(rowMatch[1] ?? '', 'r'));
    const cells = new Map<string, CellValue>();
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(
      /<(?:\w+:)?c(\s[^>]*?)(?:\/\s*>|>([\s\S]*?)<\/(?:\w+:)?c>)/gu,
    )) {
      const attrs = cellMatch[1] ?? '';
      const ref = attribute(attrs, 'r');
      if (!ref) continue;
      const column = /^[A-Z]+/u.exec(ref.toUpperCase())?.[0];
      if (column) cells.set(column, parseCell(attrs, cellMatch[2] ?? '', strings));
    }
    return { rowNumber, cells };
  });
}

const text = (value: CellValue | undefined) => String(value ?? '').trim();
const comparisonKey = (value: string) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');

function parsePyMy(value: CellValue | undefined): { productionYear: number; modelYear: number } | null {
  const digits = text(value).replace(/\D/gu, '');
  if (!/^\d{4}$/u.test(digits)) return null;
  return { productionYear: 2000 + Number(digits.slice(0, 2)), modelYear: 2000 + Number(digits.slice(2, 4)) };
}

function monthToDate(value: CellValue | undefined): { month: number; startsOn: string } | null {
  const digits = text(value).replace(/\D/gu, '');
  if (!/^20\d{4}$/u.test(digits)) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (month < 1 || month > 12) return null;
  return { month: Number(digits), startsOn: `${year}-${String(month).padStart(2, '0')}-01` };
}

function parseMsrpWorkbook(bytes: Uint8Array): readonly MsrpRow[] {
  const files = unzipSync(bytes);
  const rows = worksheetRows(xmlEntry(files, workbookSheetPath(files, 'MSRP')), sharedStrings(files));
  let identity: Omit<MsrpRow, 'excelRow' | 'msrp' | 'month'> | null = null;
  const output: MsrpRow[] = [];
  for (const row of rows) {
    const brand = text(row.cells.get('B'));
    const model = text(row.cells.get('C'));
    const version = text(row.cells.get('D'));
    if (comparisonKey(brand) === 'brand' || comparisonKey(model) === 'model' || comparisonKey(version) === 'version') {
      identity = null;
      continue;
    }
    const pyMy = parsePyMy(row.cells.get('F'));
    if (brand && model && version && pyMy) identity = { brand, model, version, ...pyMy };
    if (!identity) continue;
    const msrp = Number(row.cells.get('H'));
    const month = monthToDate(row.cells.get('V'));
    if (!Number.isFinite(msrp) || msrp <= 0 || !month) continue;
    output.push({ excelRow: row.rowNumber, ...identity, msrp, month: month.month });
  }
  return output;
}

function identityKey(row: Pick<MsrpRow, 'brand' | 'model' | 'version' | 'productionYear' | 'modelYear'>): string {
  return [comparisonKey(row.brand), comparisonKey(row.model), comparisonKey(row.version), row.productionYear, row.modelYear].join('|');
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}

function buildApplySql(rows: readonly MatchedRow[], workbookName: string, actorId: string, expectedExisting: number): string {
  const tuples = rows.map((row) => {
    const snapshot = JSON.stringify({
      kind: 'excel_msrp_baseline', workbook: workbookName, sheet: 'MSRP', excel_row: row.excelRow,
      source_month: row.month, brand: row.brand, model: row.model, version: row.version,
      production_year: row.productionYear, model_year: row.modelYear,
    });
    return `(${row.productId}, ${row.msrp.toFixed(2)}, ${sqlLiteral(row.startsOn)}, ${sqlLiteral(snapshot)}::jsonb, ${sqlLiteral(`excel-msrp:${row.productId}:${row.month}`)})`;
  });
  return `-- Generated by scripts/data-refresh/run-msrp-history-import.ts\n-- Target: Compra Car Staging (${STAGING_REF})\nBEGIN;\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM product_public_prices) <> ${expectedExisting} THEN\n    RAISE EXCEPTION 'Safety stop: expected ${expectedExisting} existing product_public_prices rows before baseline replacement.';\n  END IF;\nEND $$;\n\n-- Replace the staging-only legacy/test baseline atomically. Any later failure rolls this delete back.\nDELETE FROM product_public_prices;\n\nCREATE TEMP TABLE _msrp_baseline (\n  product_id integer NOT NULL, amount numeric NOT NULL, starts_on date NOT NULL, source_snapshot jsonb NOT NULL, source_reference text NOT NULL,\n  UNIQUE(product_id, starts_on)\n) ON COMMIT DROP;\n\nINSERT INTO _msrp_baseline(product_id, amount, starts_on, source_snapshot, source_reference) VALUES\n${tuples.join(',\n')};\n\nINSERT INTO product_public_prices(\n  product_id, amount, currency_code, starts_on, status, source_type, source_snapshot, published_at, published_by, created_by, updated_by, price_type, source_reference\n)\nSELECT product_id, amount, 'BRL', starts_on, 'published', 'manual', source_snapshot, now(), ${sqlLiteral(actorId)}::uuid, ${sqlLiteral(actorId)}::uuid, ${sqlLiteral(actorId)}::uuid, 'msrp', source_reference\nFROM _msrp_baseline;\n\nDO $$\nBEGIN\n  IF (SELECT count(*) FROM product_public_prices WHERE source_reference LIKE 'excel-msrp:%') <> ${rows.length} THEN\n    RAISE EXCEPTION 'Validation failed: inserted MSRP row count mismatch.';\n  END IF;\n  IF EXISTS (SELECT 1 FROM product_public_prices GROUP BY product_id, starts_on HAVING count(*) > 1) THEN\n    RAISE EXCEPTION 'Validation failed: duplicate product/month.';\n  END IF;\nEND $$;\n\nCOMMIT;\n`;
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '../..');
  const workbookArg = process.argv.find((arg) => arg.startsWith('--workbook='))?.slice('--workbook='.length);
  const actorArg = process.argv.find((arg) => arg.startsWith('--actor-id='))?.slice('--actor-id='.length) ?? process.env.MSRP_IMPORT_ACTOR_ID;
  const workbookPath = resolve(root, workbookArg || DEFAULT_WORKBOOK);
  const workbookName = basename(workbookPath);
  const [envText, workbookBytes] = await Promise.all([
    readFile(resolve(root, 'apps/web/env/staging.env'), 'utf8'),
    readFile(workbookPath),
  ]);
  const target = readTarget(parseEnv(envText));
  const [products, existingPrices] = await Promise.all([
    get<Product>(target, '/rest/v1/products?select=id,brand,model,version,production_year,model_year,is_active&is_active=eq.true&limit=2000'),
    get<{ id: number; published_by: string | null }>(target, '/rest/v1/product_public_prices?select=id,published_by&limit=2000'),
  ]);
  const sourceRows = parseMsrpWorkbook(workbookBytes);
  const productsByIdentity = new Map<string, Product[]>();
  for (const product of products) {
    const key = identityKey({ brand: product.brand, model: product.model, version: product.version, productionYear: product.production_year, modelYear: product.model_year });
    productsByIdentity.set(key, [...(productsByIdentity.get(key) ?? []), product]);
  }

  const unmatched: MsrpRow[] = [];
  const ambiguous: MsrpRow[] = [];
  const rawMatches: MatchedRow[] = [];
  for (const row of sourceRows) {
    const candidates = productsByIdentity.get(identityKey(row)) ?? [];
    if (candidates.length === 0) { unmatched.push(row); continue; }
    if (candidates.length > 1) { ambiguous.push(row); continue; }
    rawMatches.push({ ...row, productId: candidates[0]!.id, startsOn: monthToDate(row.month)!.startsOn });
  }

  const deduped = new Map<string, MatchedRow>();
  const duplicateRows: MatchedRow[] = [];
  const conflicts: { current: MatchedRow; incoming: MatchedRow }[] = [];
  for (const row of rawMatches) {
    const key = `${row.productId}|${row.month}`;
    const current = deduped.get(key);
    if (!current) { deduped.set(key, row); continue; }
    if (current.msrp === row.msrp) duplicateRows.push(row);
    else conflicts.push({ current, incoming: row });
  }
  const matched = [...deduped.values()].sort((a, b) => a.productId - b.productId || a.month - b.month);
  const report = {
    target: STAGING_REF,
    workbook: workbookName,
    sheet: 'MSRP',
    sourceRows: sourceRows.length,
    matchedRowsBeforeDedupe: rawMatches.length,
    matchedProductMonths: matched.length,
    matchedProducts: new Set(matched.map((row) => row.productId)).size,
    duplicateIdenticalRows: duplicateRows.length,
    conflicts: conflicts.length,
    unmatchedRows: unmatched.length,
    unmatchedIdentities: new Set(unmatched.map(identityKey)).size,
    ambiguousRows: ambiguous.length,
    existingPriceRows: existingPrices.length,
    minMatchedMsrp: matched.length ? Math.min(...matched.map((row) => row.msrp)) : null,
    maxMatchedMsrp: matched.length ? Math.max(...matched.map((row) => row.msrp)) : null,
  };
  const outDir = resolve(root, 'artifacts/pricing-msrp');
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(resolve(outDir, 'unmatched.json'), `${JSON.stringify(unmatched, null, 2)}\n`, 'utf8'),
    writeFile(resolve(outDir, 'ambiguous.json'), `${JSON.stringify(ambiguous, null, 2)}\n`, 'utf8'),
    writeFile(resolve(outDir, 'conflicts.json'), `${JSON.stringify(conflicts, null, 2)}\n`, 'utf8'),
  ]);
  console.log(JSON.stringify(report, null, 2));
  if (ambiguous.length || conflicts.length) {
    throw new Error('Dry-run bloqueado: existem matches ambíguos ou conflitos de MSRP para produto/mês.');
  }
  if (actorArg) {
    await writeFile(resolve(outDir, 'apply.sql'), buildApplySql(matched, workbookName, actorArg, existingPrices.length), 'utf8');
    console.log(`SQL transacional gerado em ${resolve(outDir, 'apply.sql')}`);
  } else {
    console.log('Dry-run concluído. Para gerar apply.sql, informe --actor-id=<uuid> ou MSRP_IMPORT_ACTOR_ID.');
  }
}

void main();
