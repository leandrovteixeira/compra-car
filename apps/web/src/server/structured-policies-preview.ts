import 'server-only';

import {
  CommercialImportContractParseError,
  parseCommercialImportContractV1,
  validateCommercialImportContractV1,
} from '@compra-car/core';
import {
  checkStructuredPoliciesFile,
  type StructuredPoliciesResult,
} from '@/application/admin/structured-policies';

export async function previewStructuredPolicies(file: File): Promise<StructuredPoliciesResult> {
  const rejected = checkStructuredPoliciesFile(file);
  if (rejected) return rejected;
  try {
    const contract = parseCommercialImportContractV1(await file.arrayBuffer());
    const validation = validateCommercialImportContractV1(contract);
    if (!validation.ok)
      return { status: 'STRUCTURALLY_INVALID', diagnostics: validation.diagnostics };
    return { status: 'STRUCTURALLY_VALID', filename: file.name, contract };
  } catch (error) {
    if (error instanceof CommercialImportContractParseError)
      return { status: 'PARSER_FAILURE', diagnostics: error.diagnostics };
    console.error('[structured-policies] Unexpected preview failure');
    return {
      status: 'TECHNICAL_ERROR',
      message: 'Não foi possível validar o arquivo. Tente novamente.',
    };
  }
}
