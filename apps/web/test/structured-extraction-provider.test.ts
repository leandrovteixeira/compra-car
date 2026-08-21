import { describe, expect, it } from 'vitest';
import type { StructuredExtractionProvider } from '@compra-car/core';

import { OpenAIStructuredExtractionProvider } from '../src/server/openai-structured-extraction-provider';
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

  it('rejects fake without explicit injection', () => {
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'fake', NODE_ENV: 'test' },
      }),
    ).toThrow('SEGMENTED_FAKE_PROVIDER_NOT_INJECTED');
  });

  it('rejects missing and unknown provider configuration', () => {
    expect(() =>
      createConfiguredStructuredExtractionProvider({ env: { NODE_ENV: 'test' } }),
    ).toThrow('SEGMENTED_STRUCTURED_PROVIDER_NOT_CONFIGURED');
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: { IMPORT_EXTRACTION_PROVIDER: 'other', NODE_ENV: 'test' },
      }),
    ).toThrow('SEGMENTED_STRUCTURED_PROVIDER_UNKNOWN');
  });

  it('creates the OpenAI structured provider without making an external call', () => {
    expect(
      createConfiguredStructuredExtractionProvider({
        env: {
          IMPORT_EXTRACTION_PROVIDER: 'openai',
          OPENAI_API_KEY: 'test-key-not-used',
          OPENAI_IMPORT_MODEL: 'gpt-test-not-used',
          NODE_ENV: 'test',
        },
      }),
    ).toBeInstanceOf(OpenAIStructuredExtractionProvider);
  });

  it.each([
    { OPENAI_API_KEY: '', OPENAI_IMPORT_MODEL: 'gpt-test-not-used' },
    { OPENAI_API_KEY: 'test-key-not-used', OPENAI_IMPORT_MODEL: '' },
  ])('rejects incomplete OpenAI configuration', (openAIEnv) => {
    expect(() =>
      createConfiguredStructuredExtractionProvider({
        env: {
          IMPORT_EXTRACTION_PROVIDER: 'openai',
          NODE_ENV: 'test',
          ...openAIEnv,
        },
      }),
    ).toThrow('SEGMENTED_OPENAI_CONFIG_INVALID');
  });
});
