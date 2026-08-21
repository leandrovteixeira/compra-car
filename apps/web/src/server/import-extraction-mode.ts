import 'server-only';

export type ImportExtractionMode = 'one_shot' | 'segmented';

export function parseImportExtractionMode(value: string | undefined): ImportExtractionMode {
  if (value === undefined || value === '' || value === 'one_shot') return 'one_shot';
  if (value === 'segmented') return 'segmented';
  throw new Error('IMPORT_EXTRACTION_MODE_INVALID');
}

export const getImportExtractionMode = (): ImportExtractionMode =>
  parseImportExtractionMode(process.env.IMPORT_EXTRACTION_MODE);
