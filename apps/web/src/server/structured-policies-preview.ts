import 'server-only';
import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';

import {
  CommercialImportContractParseError,
  parseCommercialImportContractV1,
  validateCommercialImportContractV1,
  commercialProductResolutionYears,
  resolveCommercialProducts,
  type CommercialProductCatalogReader,
} from '@compra-car/core';
import {
  checkStructuredPoliciesFile,
  type StructuredPoliciesResult,
} from '@/application/admin/structured-policies';

export async function previewStructuredPolicies(
  file: File,
  reader?: CommercialProductCatalogReader,
): Promise<StructuredPoliciesResult> {
  const rejected = checkStructuredPoliciesFile(file);
  if (rejected) return rejected;
  try {
    const contract = parseCommercialImportContractV1(await file.arrayBuffer());
    const validation = validateCommercialImportContractV1(contract);
    if (!validation.ok)
      return { status: 'STRUCTURALLY_INVALID', diagnostics: validation.diagnostics };
    try {
      const years = commercialProductResolutionYears(contract.products);
      const catalog = years.length
        ? await (reader ?? new LegacySupabaseAdapter()).listCommercialResolutionProducts(years)
        : [];
      const resolution = resolveCommercialProducts(contract.products, catalog);
      return {
        status: 'STRUCTURALLY_VALID',
        filename: file.name,
        contract,
        resolution,
        operatorCatalog: catalog,
      };
    } catch {
      console.error('[structured-policies] Product catalog resolution failed');
      return {
        status: 'STRUCTURALLY_VALID',
        filename: file.name,
        contract,
        operatorCatalog: [],
        resolution: {
          status: 'PRODUCT_RESOLUTION_FAILED',
          message:
            'Não foi possível concluir a leitura do catálogo. Valide novamente para tentar resolver os produtos.',
        },
      };
    }
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
