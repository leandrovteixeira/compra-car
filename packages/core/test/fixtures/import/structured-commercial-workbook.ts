import { strToU8, zipSync } from 'fflate';
import {
  COMMERCIAL_IMPORT_COLUMNS,
  COMMERCIAL_IMPORT_REQUIRED_SHEETS,
  type CommercialImportContractV1,
} from '../../../src/import/commercial-import-contract';

/** Synthetic OpenXML transport for the shared 15C.1 fixture; never a real commercial file. */
export function fixtureWorkbook(contract: CommercialImportContractV1): Uint8Array {
  const escape = (value: unknown) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('"', '&quot;');
  const column = (index: number): string =>
    index < 26
      ? String.fromCharCode(65 + index)
      : column(Math.floor(index / 26) - 1) + column(index % 26);
  const datasets = [
    [contract.metadata],
    contract.products,
    contract.policies,
    contract.offers,
    contract.offerPolicies,
    contract.issues,
    contract.evidence,
  ];
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<workbook><sheets>${COMMERCIAL_IMPORT_REQUIRED_SHEETS.map((sheet, i) => `<sheet name="${sheet}" r:id="r${i}"/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships>${COMMERCIAL_IMPORT_REQUIRED_SHEETS.map((_, i) => `<Relationship Id="r${i}" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`,
    ),
  };
  COMMERCIAL_IMPORT_REQUIRED_SHEETS.forEach((sheet, i) => {
    const headers = COMMERCIAL_IMPORT_COLUMNS[sheet];
    const rows = [
      headers,
      ...(datasets[i] ?? []).map((record) =>
        headers.map((header) => {
          const key = header.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
          return (record as unknown as Record<string, unknown>)[key];
        }),
      ),
    ];
    files[`xl/worksheets/sheet${i}.xml`] = strToU8(
      `<worksheet><sheetData>${rows.map((row, r) => `<row>${row.map((value, c) => `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`,
    );
  });
  return zipSync(files);
}
