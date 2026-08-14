import { describe, expect, it } from 'vitest';

import {
  commercialLetterExtractionInstructions,
  commercialLetterExtractionInstructionsV1,
  commercialLetterExtractionInstructionsV2,
  COMMERCIAL_LETTER_EXTRACTION_PROMPT_VERSION,
  COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION,
} from '../src/server/commercial-letter-openai-extraction';
import { OpenAIExtractionProvider } from '../src/server/openai-extraction-provider';

describe('commercial letter extraction prompt v2', () => {
  it('versions v1 and v2 explicitly without changing the semantic schema', () => {
    expect(COMMERCIAL_LETTER_EXTRACTION_PROMPT_VERSION).toBe('2');
    expect(COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION).toBe('CommercialLetterExtraction/1');
    expect(commercialLetterExtractionInstructions).toBe(commercialLetterExtractionInstructionsV2);
    expect(commercialLetterExtractionInstructionsV1).not.toBe(
      commercialLetterExtractionInstructionsV2,
    );
    expect(
      new OpenAIExtractionProvider(
        { apiKey: 'fixture', model: 'fixture' },
        {
          upload: async () => ({ id: 'fixture' }),
          respond: async () => ({ id: 'fixture', output_text: '{"rows":[]}' }),
          deleteFile: async () => undefined,
        },
      ).version,
    ).toBe('2');
  });

  it.each([
    ['scope propagation', /escopo amplo a todos e somente aos MMVs abrangidos/u],
    ['MMV coverage matrix', /matriz de cobertura para cada MMV/u],
    ['reconciliation pass', /primeiro extração, depois reconciliação de cobertura/u],
    ['general benefit inheritance', /benefício geral[\s\S]*inclua-o em cada\s+Offer alternativa/u],
    ['E/OU preservation', /Preserve relações E e OU/u],
    ['table context', /cabeçalhos, rótulos de linhas e colunas/u],
    ['confidence and completeness', /Confidence[\s\S]*completude da row/u],
    ['review for ambiguity', /REVIEW[\s\S]*SOURCE_AMBIGUITY/u],
    ['evidence of scope', /evidence[\s\S]*existência,[\s\S]*valor,[\s\S]*escopo/u],
  ])('contains an explicit %s rule', (_rule, expected) => {
    expect(commercialLetterExtractionInstructionsV2).toMatch(expected);
  });

  it('preserves source-only extraction and server-owned authority', () => {
    expect(commercialLetterExtractionInstructionsV2).toMatch(/não invente dados/u);
    expect(commercialLetterExtractionInstructionsV2).toMatch(/Nunca escolha Product/u);
    expect(commercialLetterExtractionInstructionsV2).toMatch(/selectedProductId/u);
    expect(commercialLetterExtractionInstructionsV2).toMatch(/promotionPlan/u);
    expect(commercialLetterExtractionInstructionsV2).toMatch(/sem expor\s+raciocínio/u);
  });
});
