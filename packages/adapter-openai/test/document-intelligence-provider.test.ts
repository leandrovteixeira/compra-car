import { describe, it, expect, vi } from 'vitest';
import {
  OpenAIDocumentTransport,
  documentIntelligencePayload,
} from '../src/document-intelligence-provider';
import { source, target, content } from '../../core/test/document-intelligence-fixture';
const request = { model: 'gpt-5.6-terra', source, target };
describe('document intelligence Responses transport', () => {
  it('PDF payload contains original input_file, no flattened text', () => {
    const p = documentIntelligencePayload({
      ...request,
      source: {
        ...source,
        format: 'PDF_FILE',
        bytes: new Uint8Array(Buffer.from('%PDF-original')),
        filename: 'sheet.pdf',
      },
    });
    const wire = JSON.stringify(p);
    expect(wire).toContain('input_file');
    expect(wire).toContain(Buffer.from('%PDF-original').toString('base64'));
    expect(wire).not.toContain(source.blocks[0]!.text);
    expect(p.reasoning?.effort).toBe('low');
    expect(p.tools).toEqual([]);
  });
  it('HTML preserves block/card context', () =>
    expect(JSON.stringify(documentIntelligencePayload(request))).toContain('parentLocator'));
  it('schema and model are explicit', () => {
    const p = documentIntelligencePayload(request);
    expect(p.model).toBe('gpt-5.6-terra');
    expect(p.text?.format).toMatchObject({ strict: true, type: 'json_schema' });
  });
  it('repair carries proposal and validator issues only', () => {
    const p = documentIntelligencePayload({
      ...request,
      model: 'gpt-5.6-sol',
      repair: {
        proposal: content,
        issues: [
          { code: 'EMPTY_SECTION', path: 'sections/0', severity: 'REPAIR', detail: 'empty' },
        ],
      },
    });
    expect(JSON.stringify(p)).toContain('EMPTY_SECTION');
    expect(p.model).toBe('gpt-5.6-sol');
  });
  it('mock HTTP count/generate capture usage and store false', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify(
          String(url).endsWith('input_tokens')
            ? { object: 'response.input_tokens', input_tokens: 20 }
            : {
                object: 'response',
                id: 'r',
                model: request.model,
                status: 'completed',
                output: [
                  {
                    type: 'message',
                    role: 'assistant',
                    content: [
                      { type: 'output_text', text: JSON.stringify(content), annotations: [] },
                    ],
                  },
                ],
                usage: {
                  input_tokens: 20,
                  input_tokens_details: { cached_tokens: 5 },
                  output_tokens: 10,
                  output_tokens_details: { reasoning_tokens: 2 },
                  total_tokens: 30,
                },
              },
        ),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    const t = new OpenAIDocumentTransport({ apiKey: 'mock', fetch: fetcher });
    expect(await t.count(request)).toBe(20);
    const r = await t.generate(request, 100);
    expect(r.usage.cachedInputTokens).toBe(5);
    expect(r.content).toEqual(content);
    expect(bodies[1]?.store).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
