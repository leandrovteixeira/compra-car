import { describe, expect, it } from 'vitest';

import { parseImportExtractionMode } from '../src/server/import-extraction-mode';

describe('import extraction mode', () => {
  it('keeps one-shot as the safe explicit and implicit default', () => {
    expect(parseImportExtractionMode(undefined)).toBe('one_shot');
    expect(parseImportExtractionMode('')).toBe('one_shot');
    expect(parseImportExtractionMode('one_shot')).toBe('one_shot');
  });

  it('requires an exact segmented opt-in and rejects invalid configuration', () => {
    expect(parseImportExtractionMode('segmented')).toBe('segmented');
    expect(() => parseImportExtractionMode('SEGMENTED')).toThrow('IMPORT_EXTRACTION_MODE_INVALID');
  });
});
