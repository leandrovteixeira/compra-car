import { describe, expect, it, vi } from 'vitest';
import { APIConnectionTimeoutError, APIError } from 'openai';

import fixture from '../../../docs/import/examples/commercial-letter-mmv-example-v1.json';
import canonicalSchema from '../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';
import {
  auditOpenAITransportSchema,
  commercialLetterExtractionSchema,
  commercialLetterExtractionSchemaAudit,
  COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION,
  OpenAITransportSchemaError,
} from '../src/server/commercial-letter-openai-extraction';
import {
  createConfiguredExtractionProvider,
  OpenAIExtractionProvider,
  OpenAIExtractionProviderError,
  OPENAI_IMPORT_DEFAULT_TIMEOUT_MS,
  OPENAI_IMPORT_MAX_TIMEOUT_MS,
  parseOpenAIImportTimeoutMs,
  type OpenAIClientBoundary,
} from '../src/server/openai-extraction-provider';

type JsonObject = Record<string, unknown>;

function extractionRow(): JsonObject {
  const row = structuredClone(fixture) as JsonObject;
  for (const key of ['schemaVersion', 'productMatch', 'promotionPlan', 'validation'])
    delete row[key];
  const price = row.publicPrice as JsonObject;
  if (price.candidate) {
    const candidate = price.candidate as JsonObject;
    for (const key of ['promotionAction', 'existingPriceId', 'expectedLockVersion'])
      delete candidate[key];
  }
  for (const policy of row.policies as JsonObject[])
    for (const key of ['promotionAction', 'existingPolicyId', 'predecessor']) delete policy[key];
  for (const offer of row.offers as JsonObject[])
    for (const key of ['promotionAction', 'existingOfferId']) delete offer[key];
  const source = row.source as JsonObject;
  source.notes ??= [];
  const mmv = row.mmv as JsonObject;
  mmv.variantRestrictions ??= [];
  const completeEvidenceRegion = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const object = value as JsonObject;
    if ('documentPage' in object && 'excerpt' in object && 'blockKey' in object)
      object.region ??= null;
    for (const nested of Object.values(object)) {
      if (Array.isArray(nested)) nested.forEach(completeEvidenceRegion);
      else completeEvidenceRegion(nested);
    }
  };
  completeEvidenceRegion(row);
  return row;
}

const request = (filename = 'meaningful-name.pdf') => ({
  documents: [
    {
      id: 'doc-2',
      ordinal: 2,
      role: 'errata',
      mimeType: 'application/pdf' as const,
      contentSha256: 'b'.repeat(64),
      originalFileName: filename,
      bytes: new Uint8Array([2]),
    },
    {
      id: 'doc-1',
      ordinal: 1,
      role: 'primary',
      mimeType: 'application/pdf' as const,
      contentSha256: 'a'.repeat(64),
      originalFileName: 'primary.pdf',
      bytes: new Uint8Array([1]),
    },
  ],
  schemaVersion: 'commercial-letter/mmv-payload/1',
  schema: {},
  instructions: 'plugin rules',
});

function client(overrides: Partial<OpenAIClientBoundary> = {}) {
  let upload = 0;
  return {
    upload: vi.fn(async () => ({ id: `file-${++upload}` })),
    respond: vi.fn(async () => ({
      id: 'resp-safe-id',
      output_text: JSON.stringify({ rows: [extractionRow()] }),
      output: [],
      usage: { input_tokens: 123, output_tokens: 45, total_tokens: 168 },
    })),
    deleteFile: vi.fn(async () => undefined),
    ...overrides,
  } satisfies OpenAIClientBoundary;
}

function sdkError(
  status: number,
  message = 'safe fixture error',
  code = 'invalid_request_error',
  param?: string,
) {
  return APIError.generate(
    status,
    { error: { code, type: 'invalid_request_error', message, param } },
    undefined,
    new Headers({ 'x-request-id': 'req_safe_fixture' }),
  );
}

describe('OpenAIExtractionProvider', () => {
  it('materializes a strict root-defs schema with only the supported keyword allowlist', () => {
    const schema = commercialLetterExtractionSchema as JsonObject;
    expect(schema.$defs).toBeTypeOf('object');
    expect(JSON.stringify((schema.properties as JsonObject).rows)).not.toContain('"$defs"');
    expect(commercialLetterExtractionSchemaAudit).toMatchObject({
      definitionCount: expect.any(Number),
      referenceCount: expect.any(Number),
      maxDepth: expect.any(Number),
    });
    expect(commercialLetterExtractionSchemaAudit.definitionCount).toBeGreaterThan(0);
    expect(commercialLetterExtractionSchemaAudit.referenceCount).toBeGreaterThan(0);
    expect(commercialLetterExtractionSchemaAudit.maxDepth).toBeLessThanOrEqual(10);
    expect(commercialLetterExtractionSchemaAudit.propertyCount).toBeLessThanOrEqual(5_000);
    expect(commercialLetterExtractionSchemaAudit.globalStringSize).toBeLessThanOrEqual(120_000);
    expect(commercialLetterExtractionSchemaAudit.enumValueCount).toBeLessThanOrEqual(1_000);
    expect(commercialLetterExtractionSchemaAudit.anyOfCount).toBe(19);
    for (const keyword of [
      '$id',
      '$schema',
      'allOf',
      'if',
      'maxLength',
      'minLength',
      'not',
      'oneOf',
      'then',
      'uniqueItems',
    ])
      expect(commercialLetterExtractionSchemaAudit.keywords).not.toContain(keyword);
  });

  it.each([
    [
      'root non-object',
      (schema: JsonObject) => {
        schema.type = 'array';
        schema.items = { type: 'string' };
      },
      /root must be an object/u,
    ],
    [
      'missing additionalProperties',
      (schema: JsonObject) => {
        delete schema.additionalProperties;
      },
      /additionalProperties=false/u,
    ],
    [
      'property absent from required',
      (schema: JsonObject) => {
        schema.required = [];
      },
      /all object properties must be required/u,
    ],
    [
      'oneOf',
      (schema: JsonObject) => {
        schema.oneOf = [{ type: 'object' }];
      },
      /unsupported keyword oneOf/u,
    ],
    [
      'arbitrary forbidden keyword',
      (schema: JsonObject) => {
        schema.patternProperties = {};
      },
      /unsupported keyword patternProperties/u,
    ],
    [
      'enum without type',
      (schema: JsonObject) => {
        (schema.properties as JsonObject).untypedEnum = { enum: ['a', 'b'] };
        schema.required = [...(schema.required as string[]), 'untypedEnum'];
      },
      /enum\/const schema must declare type/u,
    ],
    [
      'optional without null',
      (schema: JsonObject) => {
        const definitions = schema.$defs as JsonObject;
        const source = definitions.source as JsonObject;
        (source.properties as JsonObject).notes = { type: 'array', items: { type: 'string' } };
      },
      /source.notes must permit null/u,
    ],
    [
      'broken ref',
      (schema: JsonObject) => {
        (schema.properties as JsonObject).broken = { $ref: '#/$defs/missing' };
        schema.required = [...(schema.required as string[]), 'broken'];
      },
      /unresolved reference/u,
    ],
  ])('rejects %s before any provider call', (_name, mutate, expected) => {
    const invalid = structuredClone(commercialLetterExtractionSchema) as JsonObject;
    mutate(invalid);
    expect(() => auditOpenAITransportSchema(invalid)).toThrow(OpenAITransportSchemaError);
    expect(() => auditOpenAITransportSchema(invalid)).toThrow(expected);
  });

  it.each([
    [
      'more than 5000 object properties',
      (schema: JsonObject) => {
        const properties = schema.properties as JsonObject;
        const required = schema.required as string[];
        for (let index = 0; index < 5_000; index += 1) {
          const name = `extra${index}`;
          properties[name] = { type: 'string' };
          required.push(name);
        }
      },
      /property limit exceeded/u,
    ],
    [
      'global schema string budget above 120000',
      (schema: JsonObject) => {
        const name = 'x'.repeat(120_001);
        (schema.properties as JsonObject)[name] = { type: 'string' };
        schema.required = [...(schema.required as string[]), name];
      },
      /global string limit exceeded/u,
    ],
    [
      'more than 1000 enum values',
      (schema: JsonObject) => {
        (schema.properties as JsonObject).oversizedEnum = {
          type: 'string',
          enum: Array.from({ length: 1_001 }, (_, index) => `v${index}`),
        };
        schema.required = [...(schema.required as string[]), 'oversizedEnum'];
      },
      /enum value limit exceeded/u,
    ],
    [
      'single large string enum',
      (schema: JsonObject) => {
        (schema.properties as JsonObject).largeStringEnum = {
          type: 'string',
          enum: Array.from({ length: 251 }, (_, index) => `${index}-${'x'.repeat(60)}`),
        };
        schema.required = [...(schema.required as string[]), 'largeStringEnum'];
      },
      /single enum string limit exceeded/u,
    ],
    [
      'object nesting above 10',
      (schema: JsonObject) => {
        let nested: JsonObject = { type: 'string' };
        for (let index = 0; index < 11; index += 1)
          nested = {
            type: 'object',
            additionalProperties: false,
            properties: { child: nested },
            required: ['child'],
          };
        (schema.properties as JsonObject).tooDeep = nested;
        schema.required = [...(schema.required as string[]), 'tooDeep'];
      },
      /depth limit exceeded/u,
    ],
    [
      'invalid anyOf branch',
      (schema: JsonObject) => {
        (schema.properties as JsonObject).invalidUnion = {
          anyOf: [{ type: 'object', properties: {}, required: [] }, { type: 'null' }],
        };
        schema.required = [...(schema.required as string[]), 'invalidUnion'];
      },
      /additionalProperties=false/u,
    ],
  ])('rejects official global limit violation: %s', (_name, mutate, expected) => {
    const invalid = structuredClone(commercialLetterExtractionSchema) as JsonObject;
    mutate(invalid);
    expect(() => auditOpenAITransportSchema(invalid)).toThrow(expected);
  });

  it('keeps stricter Draft 2020-12 constraints exclusively in the canonical schema', () => {
    const canonicalText = JSON.stringify(canonicalSchema);
    const transportText = JSON.stringify(commercialLetterExtractionSchema);
    expect(canonicalText).toContain('"minLength"');
    expect(canonicalText).toContain('"maxLength"');
    expect(canonicalText).toContain('"uniqueItems"');
    expect(transportText).not.toContain('"minLength"');
    expect(transportText).not.toContain('"maxLength"');
    expect(transportText).not.toContain('"uniqueItems"');
  });

  it('uploads all PDFs, sends roles, strict schema and store false, then reconstructs canonical rows', async () => {
    const mock = client();
    const result = await new OpenAIExtractionProvider(
      { apiKey: 'test-key', model: 'configured-model' },
      mock,
    ).extract(request());
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mock.upload).mock.calls.map(([item]) => item.filename)).toEqual([
      'document-1.pdf',
      'document-2.pdf',
    ]);
    const sent = vi.mocked(mock.respond).mock.calls[0]![0] as JsonObject;
    expect(sent).toMatchObject({ model: 'configured-model', store: false });
    expect(JSON.stringify(sent)).toContain('role=primary');
    expect(JSON.stringify(sent)).toContain('role=errata');
    expect(sent.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'commercial_letter_extraction_v1',
        strict: true,
        schema: commercialLetterExtractionSchema,
      },
    });
    expect(result.payloads[0]).toMatchObject({
      schemaVersion: 'commercial-letter/mmv-payload/1',
      productMatch: { status: 'unmatched', selectedProductId: null },
      promotionPlan: { mode: 'blocked' },
      validation: { readyForPromotion: false },
    });
    expect(result.usage).toEqual({ inputUnits: 123, outputUnits: 45, totalUnits: 168 });
    expect(mock.deleteFile).toHaveBeenCalledTimes(2);
    const schemaText = JSON.stringify(commercialLetterExtractionSchema);
    expect(schemaText).not.toContain('"oneOf"');
    expect(schemaText).toContain('"anyOf"');
    const assertAllObjectPropertiesRequired = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const object = value as JsonObject;
      if (object.type === 'object' && object.properties) {
        expect(new Set(object.required as string[])).toEqual(
          new Set(Object.keys(object.properties as JsonObject)),
        );
      }
      for (const nested of Object.values(object)) {
        if (Array.isArray(nested)) nested.forEach(assertAllObjectPropertiesRequired);
        else assertAllObjectPropertiesRequired(nested);
      }
    };
    assertAllObjectPropertiesRequired(commercialLetterExtractionSchema);
  });

  it('maps refusal and invalid output safely', async () => {
    const refusal = client({
      respond: vi.fn(async () => ({
        id: 'r',
        output_text: '',
        output: [{ type: 'message', content: [{ type: 'refusal' }] }],
      })),
    });
    await expect(
      new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, refusal).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_REFUSAL' });
    const invalid = client({
      respond: vi.fn(async () => ({ id: 'r', output_text: '{', output: [] })),
    });
    await expect(
      new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, invalid).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_OUTPUT' });
  });

  it('accepts null transport optionals and omits them in canonical reconstruction', async () => {
    const row = extractionRow();
    (row.source as JsonObject).notes = null;
    (row.mmv as JsonObject).variantRestrictions = null;
    const mock = client({
      respond: vi.fn(async () => ({
        id: 'r',
        output_text: JSON.stringify({ rows: [row] }),
        output: [],
      })),
    });
    const result = await new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, mock).extract(
      request(),
    );
    const payload = result.payloads[0] as JsonObject;
    expect((payload.source as JsonObject).notes).toBeUndefined();
    expect((payload.mmv as JsonObject).variantRestrictions).toBeUndefined();
  });

  it.each([
    [sdkError(400), 'PROVIDER_REQUEST_INVALID'],
    [sdkError(401), 'PROVIDER_AUTH_ERROR'],
    [sdkError(403), 'PROVIDER_AUTH_ERROR'],
    [sdkError(429), 'PROVIDER_RATE_LIMITED'],
    [sdkError(500), 'PROVIDER_UNKNOWN_ERROR'],
    [new APIConnectionTimeoutError(), 'PROVIDER_TIMEOUT'],
    [new Error('unknown fixture failure'), 'PROVIDER_UNKNOWN_ERROR'],
  ])('maps external error %#', async (external, code) => {
    const mock = client({
      respond: vi.fn(async () => {
        throw external;
      }),
    });
    await expect(
      new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, mock).extract(request()),
    ).rejects.toMatchObject({ code });
    expect(mock.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('times out a long-running provider operation and attempts cleanup deterministically', async () => {
    vi.useFakeTimers();
    try {
      const mock = client({ respond: vi.fn(() => new Promise<never>(() => undefined)) });
      const extraction = new OpenAIExtractionProvider(
        { apiKey: 'k', model: 'm', timeoutMs: 30_000 },
        mock,
      ).extract(request());
      const rejection = expect(extraction).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(30_000);
      await rejection;
      expect(mock.deleteFile).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not mask provider timeout when cleanup also fails', async () => {
    vi.useFakeTimers();
    try {
      const observe = vi.fn();
      const mock = client({
        respond: vi.fn(() => new Promise<never>(() => undefined)),
        deleteFile: vi.fn(async () => {
          throw new Error('safe cleanup fixture');
        }),
      });
      const extraction = new OpenAIExtractionProvider(
        { apiKey: 'k', model: 'm', timeoutMs: 30_000 },
        mock,
        observe,
      ).extract(request());
      const rejection = expect(extraction).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(30_000);
      await rejection;
      expect(observe).toHaveBeenCalledWith({ code: 'PROVIDER_FILE_CLEANUP_FAILED', count: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps normal provider success unchanged under the configured timeout', async () => {
    await expect(
      new OpenAIExtractionProvider(
        { apiKey: 'k', model: 'm', timeoutMs: 30_000 },
        client(),
      ).extract(request()),
    ).resolves.toMatchObject({ providerRunId: 'resp-safe-id' });
  });

  it('validates the server-only timeout range and default', () => {
    expect(parseOpenAIImportTimeoutMs(undefined)).toBe(OPENAI_IMPORT_DEFAULT_TIMEOUT_MS);
    expect(parseOpenAIImportTimeoutMs('30000')).toBe(30_000);
    expect(parseOpenAIImportTimeoutMs(String(OPENAI_IMPORT_MAX_TIMEOUT_MS))).toBe(
      OPENAI_IMPORT_MAX_TIMEOUT_MS,
    );
    for (const value of ['1', '600001', '30.5', 'invalid'])
      expect(() => parseOpenAIImportTimeoutMs(value)).toThrowError(
        expect.objectContaining({ code: 'PROVIDER_REQUEST_INVALID' }),
      );
  });

  it('maps upload failures and cleans files already uploaded', async () => {
    let calls = 0;
    const mock = client({
      upload: vi.fn(async () => {
        if (++calls === 2) throw new Error('body must not escape');
        return { id: 'first' };
      }),
    });
    await expect(
      new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, mock).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_FILE_UPLOAD_FAILED' });
    expect(mock.deleteFile).toHaveBeenCalledWith('first');
  });

  it('keeps Files API errors scoped to upload after auth/rate/timeout classification', async () => {
    for (const [external, code] of [
      [sdkError(400), 'PROVIDER_FILE_UPLOAD_FAILED'],
      [sdkError(401), 'PROVIDER_AUTH_ERROR'],
      [sdkError(429), 'PROVIDER_RATE_LIMITED'],
      [new APIConnectionTimeoutError(), 'PROVIDER_TIMEOUT'],
    ] as const) {
      const mock = client({
        upload: vi.fn(async () => {
          throw external;
        }),
      });
      await expect(
        new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, mock).extract(request()),
      ).rejects.toMatchObject({ code });
    }
  });

  it('observes cleanup failure without masking success', async () => {
    const observe = vi.fn();
    const mock = client({
      deleteFile: vi.fn(async () => {
        throw new Error('cleanup details');
      }),
    });
    const result = await new OpenAIExtractionProvider(
      { apiKey: 'k', model: 'm' },
      mock,
      observe,
    ).extract(request());
    expect(result.providerRunId).toBe('resp-safe-id');
    expect(observe).toHaveBeenCalledWith({ code: 'PROVIDER_FILE_CLEANUP_FAILED', count: 2 });
  });

  it('reports safe opt-in diagnostics without leaking SDK message, headers or secret fixture', async () => {
    const observe = vi.fn();
    const secret = 'sk-secret-fixture-that-must-never-escape';
    const mock = client({
      respond: vi.fn(async () => {
        throw sdkError(400, `bad request containing ${secret}`);
      }),
    });
    await expect(
      new OpenAIExtractionProvider(
        { apiKey: secret, model: 'm', diagnostics: true },
        mock,
        observe,
      ).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_REQUEST_INVALID' });
    expect(observe).toHaveBeenCalledWith({
      code: 'PROVIDER_REQUEST_INVALID',
      stage: 'response_create',
      errorName: 'BadRequestError',
      httpStatus: 400,
      openaiCode: 'invalid_request_error',
      openaiType: 'invalid_request_error',
      requestId: 'req_safe_fixture',
      message: 'OpenAI request failed with HTTP 400.',
    });
    expect(JSON.stringify(observe.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(observe.mock.calls)).not.toContain('headers');
  });

  it('reports only sanitized invalid-schema param and bounded message', async () => {
    const observe = vi.fn();
    const secret = 'sk-secret-fixture-that-must-never-escape';
    const mock = client({
      respond: vi.fn(async () => {
        throw sdkError(
          400,
          `Invalid schema near ${secret}\nsee https://example.invalid/private`,
          'invalid_json_schema',
          'text.format.schema',
        );
      }),
    });
    await expect(
      new OpenAIExtractionProvider(
        { apiKey: secret, model: 'm', diagnostics: true },
        mock,
        observe,
      ).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_REQUEST_INVALID' });
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'response_create',
        openaiCode: 'invalid_json_schema',
        openaiParam: 'text.format.schema',
        message: expect.stringContaining('[REDACTED]'),
      }),
    );
    const serialized = JSON.stringify(observe.mock.calls);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('example.invalid');
    expect((observe.mock.calls[0]![0] as { message: string }).message.length).toBeLessThanOrEqual(
      500,
    );
  });

  it('distinguishes JSON parsing and extraction-schema validation diagnostics', async () => {
    const parseObserve = vi.fn();
    await expect(
      new OpenAIExtractionProvider(
        { apiKey: 'k', model: 'm', diagnostics: true },
        client({ respond: vi.fn(async () => ({ id: 'r', output_text: '{', output: [] })) }),
        parseObserve,
      ).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_OUTPUT' });
    expect(parseObserve).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'response_parse', code: 'PROVIDER_INVALID_OUTPUT' }),
    );

    const validationObserve = vi.fn();
    await expect(
      new OpenAIExtractionProvider(
        { apiKey: 'k', model: 'm', diagnostics: true },
        client({
          respond: vi.fn(async () => ({
            id: 'r',
            output_text: JSON.stringify({ rows: [] }),
            output: [],
          })),
        }),
        validationObserve,
      ).extract(request()),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_OUTPUT' });
    expect(validationObserve).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'extraction_validate', code: 'PROVIDER_INVALID_OUTPUT' }),
    );
  });

  it('sanitizes non numeric usage and keeps semantic instructions independent of filename', async () => {
    const first = client({
      respond: vi.fn(async () => ({
        id: 'r',
        output_text: JSON.stringify({ rows: [extractionRow()] }),
        output: [],
        usage: { input_tokens: Number.NaN, output_tokens: -1 },
      })),
    });
    const second = client();
    const a = await new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, first).extract(
      request('brand.pdf'),
    );
    await new OpenAIExtractionProvider({ apiKey: 'k', model: 'm' }, second).extract(
      request('opaque.pdf'),
    );
    expect(a.usage).toEqual({ inputUnits: 0, outputUnits: 0, totalUnits: 0 });
    expect((vi.mocked(first.respond).mock.calls[0]![0] as JsonObject).instructions).toBe(
      (vi.mocked(second.respond).mock.calls[0]![0] as JsonObject).instructions,
    );
  });

  it('requires server-side config and defaults composition to fake', () => {
    expect(createConfiguredExtractionProvider({} as NodeJS.ProcessEnv).key).toBe('fake');
    expect(() =>
      createConfiguredExtractionProvider({
        IMPORT_EXTRACTION_PROVIDER: 'openai',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(OpenAIExtractionProviderError);
    expect(() => new OpenAIExtractionProvider({ apiKey: 'k', model: '' }, client())).toThrowError(
      expect.objectContaining({ code: 'PROVIDER_INVALID_OUTPUT' }),
    );
    expect(COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION).toBe('CommercialLetterExtraction/1');
  });
});
