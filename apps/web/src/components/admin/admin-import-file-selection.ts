import type { ImportDocumentRole } from '@compra-car/core';

export interface SelectedImportFile {
  readonly id: string;
  readonly file: File;
  readonly role: ImportDocumentRole;
}

export interface AppendImportFilesResult {
  readonly selection: readonly SelectedImportFile[];
  readonly duplicateNames: readonly string[];
  readonly rejectedByLimit: number;
  readonly rejectedByTotalBytes: number;
}

function fileIdentity(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join('\u0000');
}

function selectionId(file: File): string {
  return encodeURIComponent(fileIdentity(file));
}

export function appendImportFiles(
  current: readonly SelectedImportFile[],
  incoming: readonly File[],
  maximumFiles: number,
  maximumTotalBytes: number,
  firstDocumentRole: ImportDocumentRole,
): AppendImportFilesResult {
  const selection = [...current];
  const identities = new Set(current.map(({ file }) => fileIdentity(file)));
  const duplicateNames: string[] = [];
  let rejectedByLimit = 0;
  let rejectedByTotalBytes = 0;
  let totalBytes = current.reduce((total, { file }) => total + file.size, 0);

  for (const file of incoming) {
    const identity = fileIdentity(file);
    if (identities.has(identity)) {
      duplicateNames.push(file.name);
      continue;
    }
    identities.add(identity);
    if (selection.length >= maximumFiles) {
      rejectedByLimit += 1;
      continue;
    }
    if (totalBytes + file.size > maximumTotalBytes) {
      rejectedByTotalBytes += 1;
      continue;
    }
    selection.push({
      id: selectionId(file),
      file,
      role: selection.length === 0 ? firstDocumentRole : 'other',
    });
    totalBytes += file.size;
  }

  return {
    selection: Object.freeze(selection),
    duplicateNames: Object.freeze(duplicateNames),
    rejectedByLimit,
    rejectedByTotalBytes,
  };
}

export function removeImportFile(
  current: readonly SelectedImportFile[],
  index: number,
): readonly SelectedImportFile[] {
  return Object.freeze(current.filter((_, candidate) => candidate !== index));
}

export function updateImportFileRole(
  current: readonly SelectedImportFile[],
  index: number,
  role: ImportDocumentRole,
): readonly SelectedImportFile[] {
  return Object.freeze(
    current.map((item, candidate) => (candidate === index ? { ...item, role } : item)),
  );
}
