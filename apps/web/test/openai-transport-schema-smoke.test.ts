import OpenAI, { APIError } from 'openai';
import { describe, expect, it } from 'vitest';

import { commercialLetterExtractionSchema } from '../src/server/commercial-letter-openai-extraction';

const enabled = process.env.RUN_OPENAI_SCHEMA_PROBE === '1';

const safeScalar = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9_.:/-]{1,160}$/u.test(value) ? value : undefined;

const sanitizedMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const sanitized = value
    .replaceAll(apiKey, apiKey ? '[REDACTED]' : '')
    .replace(/\b(?:sk|sess)-[A-Za-z0-9_-]{8,}\b/gu, '[REDACTED]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [REDACTED]')
    .replace(/https?:\/\/\S+/giu, '[URL_REDACTED]')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  return sanitized ? sanitized.slice(0, 500) : undefined;
};

describe.skipIf(!enabled)('OpenAI transport schema acceptance probe', () => {
  it('submits the production transport schema once without files or tools', async () => {
    expect(process.env.OPENAI_API_KEY).toBeTruthy();
    expect(process.env.OPENAI_IMPORT_MODEL).toBe('gpt-5.6-terra');
    expect(process.env.OPENAI_IMPORT_DIAGNOSTICS).toBe('1');

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 120_000,
    });
    const started = performance.now();
    try {
      const response = await client.responses.create({
        model: process.env.OPENAI_IMPORT_MODEL!,
        store: false,
        input:
          'Produce the smallest valid object permitted by the supplied schema. This is a schema transport test only.',
        max_output_tokens: 128,
        text: {
          format: {
            type: 'json_schema',
            name: 'commercial_letter_extraction_v1',
            strict: true,
            schema: commercialLetterExtractionSchema,
          },
        },
      });
      console.log(
        'OPENAI_SCHEMA_PROBE_RESULT',
        JSON.stringify({
          accepted: true,
          model: process.env.OPENAI_IMPORT_MODEL,
          responseId: safeScalar(response.id),
          status: safeScalar(response.status),
          elapsedMs: Math.round(performance.now() - started),
          usage: response.usage
            ? {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : null,
        }),
      );
    } catch (error) {
      const sdkError = error instanceof APIError ? error : undefined;
      console.log(
        'OPENAI_SCHEMA_PROBE_ERROR',
        JSON.stringify({
          accepted: false,
          stage: 'response_create',
          errorClass: safeScalar(error?.constructor?.name),
          httpStatus: sdkError?.status,
          code: safeScalar(sdkError?.code),
          type: safeScalar(sdkError?.type),
          param: safeScalar(sdkError?.param),
          requestId: safeScalar(sdkError?.requestID),
          message: sanitizedMessage(sdkError?.message),
          elapsedMs: Math.round(performance.now() - started),
        }),
      );
      throw error;
    }
  }, 150_000);
});
