export const IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT = '64mb' as const;
export const IMPORT_ENGINE_MAX_SELECTION_BYTES = 60 * 1024 * 1024;
export const IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE =
  'O conjunto de documentos selecionado é muito grande para um único envio. Remova alguns arquivos e tente novamente.';

export function exceedsImportSelectionLimit(files: readonly { readonly size: number }[]): boolean {
  return files.reduce((total, file) => total + file.size, 0) > IMPORT_ENGINE_MAX_SELECTION_BYTES;
}
