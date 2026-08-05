import {
  IMPORT_BATCH_STATUSES,
  type ImportBatchListQuery,
  type ImportBatchStatus,
} from '@compra-car/core';

export interface AdminImportQuery {
  readonly page?: string | string[];
  readonly status?: string | string[];
  readonly competence?: string | string[];
  readonly q?: string | string[];
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function parseAdminImportQuery(query: AdminImportQuery): ImportBatchListQuery {
  const parsedPage = Number(first(query.page));
  const rawStatus = first(query.status);
  const competence = first(query.competence);
  const text = first(query.q).trim();
  const status = IMPORT_BATCH_STATUSES.includes(rawStatus as ImportBatchStatus)
    ? (rawStatus as ImportBatchStatus)
    : undefined;
  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: 20,
    status,
    competence: /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(competence) ? competence : undefined,
    text: text ? text.slice(0, 100) : undefined,
  };
}
