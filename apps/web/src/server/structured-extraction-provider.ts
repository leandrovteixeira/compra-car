import 'server-only';

import type { StructuredExtractionProvider } from '@compra-car/core';

import { OfficialOpenAIClient, parseOpenAIImportTimeoutMs } from './openai-extraction-provider';
import { OpenAIStructuredExtractionProvider } from './openai-structured-extraction-provider';

export function createConfiguredStructuredExtractionProvider(
  input: {
    readonly env?: NodeJS.ProcessEnv;
    readonly fakeProvider?: StructuredExtractionProvider;
  } = {},
): StructuredExtractionProvider {
  const env = input.env ?? process.env;
  const key = env.IMPORT_EXTRACTION_PROVIDER?.trim() || 'fake';
  if (key === 'fake') {
    if (env.NODE_ENV === 'production') throw new Error('SEGMENTED_FAKE_PROVIDER_FORBIDDEN');
    if (!input.fakeProvider) throw new Error('SEGMENTED_FAKE_PROVIDER_NOT_INJECTED');
    return input.fakeProvider;
  }
  if (key !== 'openai') throw new Error('SEGMENTED_STRUCTURED_PROVIDER_UNKNOWN');
  const apiKey = env.OPENAI_API_KEY ?? '';
  const model = env.OPENAI_IMPORT_MODEL ?? '';
  if (!apiKey.trim() || !model.trim()) throw new Error('SEGMENTED_OPENAI_CONFIG_INVALID');
  return new OpenAIStructuredExtractionProvider(
    new OfficialOpenAIClient(apiKey, parseOpenAIImportTimeoutMs(env.OPENAI_IMPORT_TIMEOUT_MS)),
    model,
  );
}
