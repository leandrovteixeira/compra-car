import { describe, expect, it } from 'vitest';
import type { Response } from 'openai/resources/responses/responses';
import { OpenAISpecDiscoveryProvider } from '../src/spec-source-discovery-provider';
import {
  modelYearFixture,
  buildSpecSourceTargets,
  connectorOfficialSource,
} from '@compra-car/core/agents';
const f = modelYearFixture('VW'),
  source = connectorOfficialSource(f.active),
  target = buildSpecSourceTargets(f.context, f.rows, { country: 'BR', brand: 'VW' }, source)[0]!;
describe('bounded URL-only official search', () => {
  it('requests one tool call and only returns observed allowlisted URLs', async () => {
    let request: unknown;
    const provider = new OpenAISpecDiscoveryProvider({
      apiKey: 'fixture',
      model: 'fixture',
      transport: async (r) => {
        request = r;
        return {
          id: 'r1',
          status: 'completed',
          output: [
            {
              type: 'web_search_call',
              status: 'completed',
              action: {
                type: 'search',
                sources: [{ type: 'url', url: 'https://vw.com.br/nivus' }],
              },
            },
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    candidates: [
                      { url: 'https://vw.com.br/nivus', label: 'Nivus' },
                      { url: 'https://vw.com.br/invented', label: 'Nivus manual' },
                      { url: 'https://outside.example/nivus', label: 'Nivus' },
                    ],
                  }),
                },
              ],
            },
          ],
        } as Response;
      },
    });
    expect(await provider.discover(target, source)).toEqual([
      { url: 'https://vw.com.br/nivus', label: 'Nivus', method: 'OFFICIAL_SEARCH' },
    ]);
    expect(request).toMatchObject({
      max_tool_calls: 1,
      max_output_tokens: 2000,
      tools: [{ type: 'web_search', filters: { allowed_domains: source.allowedDomains } }],
      text: { format: { strict: true } },
    });
    expect(JSON.stringify(request)).not.toContain('specMaster');
  });
  it('rejects results without a completed search', async () => {
    const provider = new OpenAISpecDiscoveryProvider({
      apiKey: 'fixture',
      model: 'fixture',
      transport: async () => ({ id: 'r', status: 'completed', output: [] }) as unknown as Response,
    });
    await expect(provider.discover(target, source)).rejects.toThrow('INVALID_DISCOVERY_OUTPUT');
  });
});
