import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_LETTERS_PLUGIN,
  hasPdfSignature,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_MAX_PDF_BYTES,
  sanitizeImportFileName,
  validateImportBatchForm,
  validateImportDocumentCount,
  validateImportDocumentMetadata,
} from '../src';

describe('Import Engine core', () => {
  it('registers only the provider-independent commercial letters plugin', () => {
    expect(COMMERCIAL_LETTERS_PLUGIN).toEqual({
      key: 'commercial_letters',
      version: '1',
      displayName: 'Cartas Comerciais',
      acceptedDocumentTypes: ['pdf'],
    });
  });

  it('accepts an absent competence hint and validates an informed value', () => {
    expect(
      validateImportBatchForm({
        competence: '2026-13',
        notes: '',
        idempotencyKey: 'forged',
      }),
    ).toEqual({
      competence: expect.any(Array),
      idempotencyKey: expect.any(Array),
    });
    expect(
      validateImportBatchForm({
        competence: '2026-07',
        notes: '',
        idempotencyKey: '10000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({});
    expect(
      validateImportBatchForm({
        competence: '',
        notes: '',
        idempotencyKey: '10000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({});
  });

  it('enforces PDF metadata, size, role and document-count limits', () => {
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.exe',
        mimeType: 'application/octet-stream',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES + 1,
        role: 'invented',
      }),
    ).toHaveLength(4);
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES + 1,
        role: 'primary',
      }),
    ).toContain('O PDF excede o limite de 32 MiB.');
    expect(
      validateImportDocumentMetadata({
        originalFileName: 'carta.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: IMPORT_ENGINE_MAX_PDF_BYTES,
        role: 'primary',
      }),
    ).toEqual([]);
    expect(validateImportDocumentCount(0)).not.toEqual([]);
    expect(validateImportDocumentCount(IMPORT_ENGINE_MAX_DOCUMENTS + 1)).not.toEqual([]);
  });

  it('checks the PDF signature and sanitizes names without path traversal', () => {
    expect(hasPdfSignature(new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(hasPdfSignature(new TextEncoder().encode('<html>'))).toBe(false);
    expect(sanitizeImportFileName('../../Política Comercial Julho.pdf')).toBe(
      'Politica-Comercial-Julho.pdf',
    );
    expect(sanitizeImportFileName('🔥.pdf')).toBe('documento.pdf');
  });
});
