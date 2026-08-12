import type { ImportDocumentRole } from '@compra-car/core';

const DOCUMENT_FILE_PREFIX = 'importDocumentFile.';
const DOCUMENT_ROLE_PREFIX = 'importDocumentRole.';

export interface ImportDocumentSubmission {
  readonly id: string;
  readonly file: File;
  readonly role: string;
}

export interface ParsedImportDocumentSubmissions {
  readonly documents: readonly ImportDocumentSubmission[];
  readonly hasInvalidPairing: boolean;
}

export function importDocumentFileFieldName(id: string): string {
  return `${DOCUMENT_FILE_PREFIX}${id}`;
}

export function importDocumentRoleFieldName(id: string): string {
  return `${DOCUMENT_ROLE_PREFIX}${id}`;
}

export function appendImportDocumentSubmission(
  formData: FormData,
  input: {
    readonly id: string;
    readonly file: File;
    readonly role: ImportDocumentRole;
  },
): void {
  formData.append(importDocumentFileFieldName(input.id), input.file);
  formData.append(importDocumentRoleFieldName(input.id), input.role);
}

export function parseImportDocumentSubmissions(
  formData: FormData,
): ParsedImportDocumentSubmissions {
  const documents: ImportDocumentSubmission[] = [];
  const seenIds = new Set<string>();
  let hasInvalidPairing = false;

  for (const [fieldName, value] of formData.entries()) {
    if (!fieldName.startsWith(DOCUMENT_FILE_PREFIX)) continue;
    const id = fieldName.slice(DOCUMENT_FILE_PREFIX.length);
    const roles = formData.getAll(importDocumentRoleFieldName(id));
    if (
      !id ||
      seenIds.has(id) ||
      !(value instanceof File) ||
      value.size === 0 ||
      roles.length !== 1 ||
      typeof roles[0] !== 'string'
    ) {
      hasInvalidPairing = true;
      continue;
    }
    seenIds.add(id);
    documents.push(Object.freeze({ id, file: value, role: roles[0] }));
  }

  for (const [fieldName] of formData.entries()) {
    if (!fieldName.startsWith(DOCUMENT_ROLE_PREFIX)) continue;
    const id = fieldName.slice(DOCUMENT_ROLE_PREFIX.length);
    if (!seenIds.has(id)) hasInvalidPairing = true;
  }

  return {
    documents: Object.freeze(documents),
    hasInvalidPairing,
  };
}
