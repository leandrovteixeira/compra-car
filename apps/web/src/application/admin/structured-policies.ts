import type {
  AdministrativeVehicle,
  CommercialImportContractV1,
  CommercialImportDiagnostic,
  CommercialProductResolutionSummary,
} from '@compra-car/core';

export const STRUCTURED_POLICIES_MAX_BYTES = 25 * 1024 * 1024;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type StructuredPoliciesResult =
  | {
      readonly status: 'STRUCTURALLY_VALID';
      readonly filename: string;
      readonly contract: CommercialImportContractV1;
      readonly operatorCatalog: readonly AdministrativeVehicle[];
      readonly resolution:
        | CommercialProductResolutionSummary
        | { readonly status: 'PRODUCT_RESOLUTION_FAILED'; readonly message: string };
    }
  | {
      readonly status: 'STRUCTURALLY_INVALID' | 'PARSER_FAILURE';
      readonly diagnostics: readonly CommercialImportDiagnostic[];
    }
  | {
      readonly status: 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE' | 'TECHNICAL_ERROR';
      readonly message: string;
    };

export function checkStructuredPoliciesFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
): Extract<StructuredPoliciesResult, { message: string }> | null {
  if (
    !file.name.toLowerCase().endsWith('.xlsx') ||
    (file.type !== '' && file.type !== XLSX_MIME && file.type !== 'application/octet-stream')
  ) {
    return {
      status: 'UNSUPPORTED_FILE',
      message: 'Formato não aceito. Selecione somente um arquivo .xlsx.',
    };
  }
  if (file.size > STRUCTURED_POLICIES_MAX_BYTES)
    return { status: 'FILE_TOO_LARGE', message: 'Arquivo muito grande. O limite é 25 MiB.' };
  return null;
}
