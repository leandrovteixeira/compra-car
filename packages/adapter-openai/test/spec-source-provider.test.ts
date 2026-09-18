import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import {
  specSemanticInput,
  specSemanticSchema,
  OpenAISpecSourceProvider,
} from '../src/spec-source-provider';
import {
  buildSpecSourceTargets,
  connectorOfficialSource,
  modelYearFixture,
  type SpecSemanticInput,
} from '@compra-car/core/agents';
import type { Response } from 'openai/resources/responses/responses';
const fixture = modelYearFixture('Jeep');
const target = buildSpecSourceTargets(
  fixture.context,
  fixture.rows,
  { country: 'BR', brand: 'Jeep' },
  connectorOfficialSource(fixture.active),
)[0]!;
const input: SpecSemanticInput = {
  target,
  snapshot: {
    sourceUrl: 'https://jeep.com.br/car',
    finalUrl: 'https://jeep.com.br/car',
    sourceKind: 'OFFICIAL_HTML',
    contentHash: 'abc',
    contentType: 'text/html',
    fetchedAt: 'today',
    extractorVersion: '1',
    targetKey: 'target',
  },
  sections: [],
};
describe('Spec Source semantic boundary', () => {
  const validate = new Ajv({ strict: true }).compile(specSemanticSchema);
  it('requires evidence for every fact', () =>
    expect(
      validate({
        facts: [{ locator: 'a', observedLabel: 'Torque', rawValue: '270', rawUnit: 'Nm' }],
      }),
    ).toBe(false));
  it.each(['productionYear', 'specCode', 'equipmentId', 'canonicalSpec', 'productSpecId'])(
    'schema excludes %s',
    (key) => expect(JSON.stringify(specSemanticSchema)).not.toContain(key),
  );
  it('input is allowlist projection without external context injection', () => {
    const polluted = {
      ...input,
      target: { ...target, specCode: 'secret', productionYear: 2025 },
      specMaster: ['secret'],
    };
    const projected = JSON.stringify(specSemanticInput(polluted));
    expect(projected).not.toContain('secret');
    expect(projected).not.toContain('productionYear');
  });
  it('uses strict schema, bounded sections, no tools and existing background transport', async () => {
    let request: unknown;
    const provider = new OpenAISpecSourceProvider({
      apiKey: 'fixture',
      model: 'fixture',
      transport: async (r) => {
        request = r;
        return {
          id: 'res1',
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: '{"facts":[]}' }] }],
        } as Response;
      },
    });
    await expect(provider.extract(input)).resolves.toEqual([]);
    expect(request).toMatchObject({
      background: true,
      tools: [],
      max_output_tokens: 4000,
      text: { format: { strict: true } },
    });
  });
});
