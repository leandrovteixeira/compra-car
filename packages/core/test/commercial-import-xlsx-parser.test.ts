import { validContract } from './fixtures/import/structured-commercial-fixture';
import { readFileSync } from 'node:fs';

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_IMPORT_CONTRACT_VERSION,
  COMMERCIAL_IMPORT_REQUIRED_SHEETS,
  CommercialImportContractParseError,
  type CommercialImportContractV1,
} from '../src/import/commercial-import-contract';
import { validateCommercialImportContractV1 } from '../src/import/commercial-import-structural-validator';
import { parseCommercialImportContractV1 } from '../src/import/commercial-import-xlsx-parser';

const template = (): Uint8Array =>
  readFileSync(
    new URL(
      '../../../docs/import/contracts/CommercialImportContract_v1_Template.xlsx',
      import.meta.url,
    ),
  );

function rewritePart(
  input: Uint8Array,
  path: string,
  rewrite: (xml: string) => string,
): Uint8Array {
  const files = unzipSync(input);
  const part = files[path];
  if (!part) throw new Error(`Fixture part not found: ${path}`);
  files[path] = strToU8(rewrite(strFromU8(part)));
  return zipSync(files);
}

describe('CommercialImportContract/1 XLSX ingestion boundary', () => {
  it('parses the canonical template and ignores README plus visually empty rows', () => {
    const contract = parseCommercialImportContractV1(template());

    expect(contract.metadata.contractVersion).toBe(COMMERCIAL_IMPORT_CONTRACT_VERSION);
    expect(contract.products).toEqual([]);
    expect(contract.policies).toEqual([]);
    expect(contract.offers).toEqual([]);
    expect(contract.offerPolicies).toEqual([]);
    expect(contract.issues).toEqual([]);
    expect(contract.evidence).toEqual([]);
    expect(validateCommercialImportContractV1(contract).diagnostics).toEqual([]);
  });

  it('rejects an omitted required sheet rather than silently inventing it', () => {
    const input = rewritePart(template(), 'xl/workbook.xml', (xml) =>
      xml.replace('name="Products"', 'name="ProductsRenamed"'),
    );

    expect(() => parseCommercialImportContractV1(input)).toThrow(
      CommercialImportContractParseError,
    );
    try {
      parseCommercialImportContractV1(input);
    } catch (error) {
      expect(
        (error as CommercialImportContractParseError).diagnostics.map((item) => item.code),
      ).toEqual(expect.arrayContaining(['MISSING_SHEET', 'UNEXPECTED_SHEET']));
    }
  });

  it('rejects a missing canonical header and reports the sheet and column', () => {
    const input = rewritePart(template(), 'xl/worksheets/sheet3.xml', (xml) =>
      xml.replace(/product_external_key(?=<\/)/u, 'product_external_key_removed'),
    );

    try {
      parseCommercialImportContractV1(input);
      throw new Error('Expected parser rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialImportContractParseError);
      expect((error as CommercialImportContractParseError).diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MISSING_COLUMN',
            sheet: 'Products',
            column: 'product_external_key',
          }),
        ]),
      );
    }
  });

  it('structurally validates canonical vocabulary and references without resolving products', () => {
    expect(validateCommercialImportContractV1(validContract())).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it('returns stable diagnostics for duplicate keys and unknown membership references', () => {
    const contract = validContract();
    const invalid: CommercialImportContractV1 = {
      ...contract,
      products: [...contract.products, contract.products[0]!],
      offerPolicies: [
        ...contract.offerPolicies,
        { offerExternalKey: 'offer-missing', policyExternalKey: 'policy-missing' },
      ],
    };
    const result = validateCommercialImportContractV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_KEY', 'UNKNOWN_REFERENCE']),
    );
  });

  it('keeps the seven required sheet names frozen in contract order', () => {
    expect(COMMERCIAL_IMPORT_REQUIRED_SHEETS).toEqual([
      'Metadata',
      'Products',
      'Policies',
      'Offers',
      'OfferPolicies',
      'Issues',
      'Evidence',
    ]);
  });
});
