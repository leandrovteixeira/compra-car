import { describe, expect, it } from 'vitest';
import type { StructuredExtractionProvider } from '@compra-car/core';

import { createConfiguredStructuredExtractionProvider } from '../src/server/structured-extraction-provider';

const fake = {} as StructuredExtractionProvider;

describe('structured extraction provider factory', () => {
  it('allows an explicitly injected fake only outside production', () => {
    expect(
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'fake', NODE_ENV: 'test' },
        fakeProvider: fake,
      }),
    ).toBe(fake);
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'fake', NODE_ENV: 'production' },
        fakeProvider: fake,
      }),
    ).toThrow('SEGMENTED_FAKE_PROVIDER_FORBIDDEN');
  });

  it('fails safely for missing fake injection and unknown providers', () => {
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'fake', NODE_ENV: 'test' },
      }),
    ).toThrow('SEGMENTED_FAKE_PROVIDER_NOT_INJECTED');
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'other', NODE_ENV: 'test' },
      }),
    ).toThrow('SEGMENTED_STRUCTURED_PROVIDER_UNKNOWN');
  });
});
