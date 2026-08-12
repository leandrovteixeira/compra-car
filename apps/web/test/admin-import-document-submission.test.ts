import { describe, expect, it } from 'vitest';

import {
  importDocumentFileFieldName,
  importDocumentRoleFieldName,
  parseImportDocumentSubmissions,
} from '../src/application/admin/import-document-submission';

function pdf(name: string): File {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

describe('admin import document submission', () => {
  it('binds each role to its stable file id even when FormData fields are interleaved', () => {
    const data = new FormData();
    data.append(importDocumentRoleFieldName('hyundai'), 'primary');
    data.append(importDocumentFileFieldName('gac'), pdf('GAC 202511-01.pdf'));
    data.append(importDocumentRoleFieldName('gac'), 'errata');
    data.append(importDocumentFileFieldName('hyundai'), pdf('Hyundai 202601-01.pdf'));

    const parsed = parseImportDocumentSubmissions(data);
    expect(parsed.hasInvalidPairing).toBe(false);
    expect(parsed.documents.map(({ id, file, role }) => ({ id, name: file.name, role }))).toEqual([
      { id: 'gac', name: 'GAC 202511-01.pdf', role: 'errata' },
      { id: 'hyundai', name: 'Hyundai 202601-01.pdf', role: 'primary' },
    ]);
  });

  it('rejects a missing or duplicate role instead of applying a silent fallback', () => {
    const data = new FormData();
    data.append(importDocumentFileFieldName('a'), pdf('A.pdf'));
    data.append(importDocumentRoleFieldName('a'), 'primary');
    data.append(importDocumentRoleFieldName('a'), 'other');
    data.append(importDocumentRoleFieldName('orphan'), 'errata');

    expect(parseImportDocumentSubmissions(data)).toMatchObject({
      documents: [],
      hasInvalidPairing: true,
    });
  });
});
