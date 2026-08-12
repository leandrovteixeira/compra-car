import { describe, expect, it } from 'vitest';

import {
  appendImportFiles,
  removeImportFile,
  updateImportFileRole,
} from '../src/components/admin/admin-import-file-selection';

function pdf(name: string, lastModified: number): File {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf', lastModified });
}

function sizedFile(name: string, size: number): File {
  return { name, size, lastModified: 1, type: 'application/pdf' } as File;
}

describe('admin import file selection', () => {
  it('accumulates sequential, multi-select and drag-and-drop additions in order', () => {
    const a = pdf('A.pdf', 1);
    const b = pdf('B.pdf', 2);
    const c = pdf('C.pdf', 3);
    const d = pdf('D.pdf', 4);
    const first = appendImportFiles([], [a], 20, Number.MAX_SAFE_INTEGER, 'primary');
    const second = appendImportFiles(
      first.selection,
      [b, c],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    );
    const dropped = appendImportFiles(
      second.selection,
      [d],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    );

    expect(dropped.selection.map(({ file }) => file.name)).toEqual([
      'A.pdf',
      'B.pdf',
      'C.pdf',
      'D.pdf',
    ]);
    expect(dropped.selection.map(({ role }) => role)).toEqual([
      'primary',
      'other',
      'other',
      'other',
    ]);
  });

  it('removes one file while preserving the roles of the remaining documents', () => {
    const initial = appendImportFiles(
      [],
      [pdf('A.pdf', 1), pdf('B.pdf', 2)],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    );
    const withRole = updateImportFileRole(initial.selection, 1, 'errata');
    const remaining = removeImportFile(withRole, 0);

    expect(remaining).toMatchObject([{ file: { name: 'B.pdf' }, role: 'errata' }]);
  });

  it('keeps file and visible role as one unit across removal and reinsertion', () => {
    const a = pdf('A.pdf', 1);
    const b = pdf('B.pdf', 2);
    const initial = appendImportFiles([], [a, b], 20, Number.MAX_SAFE_INTEGER, 'primary');
    const removed = removeImportFile(initial.selection, 0);
    const reinserted = appendImportFiles(
      removed,
      [a],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    ).selection;

    expect(initial.selection.map(({ file, role }) => [file.name, role])).toEqual([
      ['A.pdf', 'primary'],
      ['B.pdf', 'other'],
    ]);
    expect(reinserted.map(({ file, role }) => [file.name, role])).toEqual([
      ['B.pdf', 'other'],
      ['A.pdf', 'other'],
    ]);
    expect(new Set(reinserted.map(({ id }) => id)).size).toBe(2);
  });

  it('supports explicit inverse and multiple-primary roles without changing file order', () => {
    const initial = appendImportFiles(
      [],
      [pdf('A.pdf', 1), pdf('B.pdf', 2)],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    ).selection;
    const inverse = updateImportFileRole(updateImportFileRole(initial, 0, 'other'), 1, 'primary');
    const bothPrimary = updateImportFileRole(inverse, 0, 'primary');

    expect(inverse.map(({ file, role }) => [file.name, role])).toEqual([
      ['A.pdf', 'other'],
      ['B.pdf', 'primary'],
    ]);
    expect(bothPrimary.map(({ file, role }) => [file.name, role])).toEqual([
      ['A.pdf', 'primary'],
      ['B.pdf', 'primary'],
    ]);
  });

  it('reports local duplicates and enforces the maximum without replacing prior files', () => {
    const files = Array.from({ length: 20 }, (_, index) => pdf(`${index}.pdf`, index));
    const initial = appendImportFiles([], files, 20, Number.MAX_SAFE_INTEGER, 'primary');
    const result = appendImportFiles(
      initial.selection,
      [files[0]!, pdf('extra.pdf', 21)],
      20,
      Number.MAX_SAFE_INTEGER,
      'primary',
    );

    expect(result.selection).toHaveLength(20);
    expect(result.selection[0]?.file).toBe(files[0]);
    expect(result.duplicateNames).toEqual(['0.pdf']);
    expect(result.rejectedByLimit).toBe(1);
  });

  it('accepts a set at the transport selection limit and blocks the next file', () => {
    const maximum = 60 * 1024 * 1024;
    const accepted = appendImportFiles(
      [],
      [sizedFile('A.pdf', 30 * 1024 * 1024), sizedFile('B.pdf', 30 * 1024 * 1024)],
      20,
      maximum,
      'primary',
    );
    const rejected = appendImportFiles(
      accepted.selection,
      [sizedFile('C.pdf', 1)],
      20,
      maximum,
      'primary',
    );

    expect(accepted.selection).toHaveLength(2);
    expect(accepted.rejectedByTotalBytes).toBe(0);
    expect(rejected.selection).toEqual(accepted.selection);
    expect(rejected.rejectedByTotalBytes).toBe(1);
  });
});
