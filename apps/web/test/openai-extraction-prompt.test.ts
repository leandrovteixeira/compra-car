import { describe, expect, it } from 'vitest';

import {
  commercialLetterExtractionInstructions,
  commercialLetterExtractionInstructionsV1,
  commercialLetterExtractionInstructionsV2,
  commercialLetterExtractionInstructionsV3,
  commercialLetterExtractionInstructionsV4,
  COMMERCIAL_LETTER_EXTRACTION_PROMPT_VERSION,
  COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION,
} from '../src/server/commercial-letter-openai-extraction';
import { OpenAIExtractionProvider } from '../src/server/openai-extraction-provider';

describe('commercial letter extraction prompt versions', () => {
  it('preserves v1/v2/v3 and activates v4 without changing the semantic schema', () => {
    expect(COMMERCIAL_LETTER_EXTRACTION_PROMPT_VERSION).toBe('4');
    expect(COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION).toBe('CommercialLetterExtraction/1');
    expect(commercialLetterExtractionInstructions).toBe(commercialLetterExtractionInstructionsV4);
    expect(commercialLetterExtractionInstructionsV1).not.toBe(
      commercialLetterExtractionInstructionsV2,
    );
    expect(commercialLetterExtractionInstructionsV2).not.toBe(
      commercialLetterExtractionInstructionsV3,
    );
    expect(commercialLetterExtractionInstructionsV3).not.toBe(
      commercialLetterExtractionInstructionsV4,
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
    ).toBe('4');
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

  it.each([
    [
      'document inventory',
      /PHASE 1 — document inventory[\s\S]*período,[\s\S]*seções,[\s\S]*tabelas/u,
    ],
    ['MMV inventory', /MMV\/table inventory[\s\S]*enumere nominalmente todos os MMVs/u],
    ['exhaustive table enumeration', /Não amostre tabelas[\s\S]*Examine cada linha nominal/u],
    ['PY/MY separation', /productionYear \(PY\) e modelYear \(MY\) são campos separados/u],
    [
      'quantitative coverage reconciliation',
      /quantitative coverage reconciliation[\s\S]*MMVs nominais identificados versus[\s\S]*rows finais/u,
    ],
    ['family coverage', /family coverage:[\s\S]*toda família\/modelo identificada/u],
    ['Policy-first extraction', /Construa Policies antes de Offers/u],
    [
      'referential-integrity check',
      /cada Offer\.policyClientIds[\s\S]*Policies\[\]\.clientPolicyId existente/u,
    ],
    ['clientId discipline', /clientPolicyId local, estável e único/u],
    [
      'general-benefit propagation',
      /cada benefício geral[\s\S]*underpropagation e overpropagation/u,
    ],
    ['channel coverage', /Trate canal como dimensão explícita/u],
    ['multi-page table context', /tabela multipágina[\s\S]*documento independente/u],
    ['price classification', /MSRP\/preço público, preço promocional, preço por canal/u],
    ['E/OU validation', /Preserve relações E e OU[\s\S]*alternativas foram fundidas/u],
    [
      'completeness-aware confidence',
      /Confidence mede[\s\S]*integridade referencial e completude/u,
    ],
    [
      'completeness REVIEW',
      /COVERAGE_INCOMPLETE[\s\S]*SOURCE_BLOCK_INCOMPLETE ou OFFER_COVERAGE_GAP/u,
    ],
    [
      'no chain-of-thought exposure',
      /Não exponha chain-of-thought[\s\S]*somente Structured Output/u,
    ],
  ])('v3 contains an explicit %s rule', (_rule, expected) => {
    expect(commercialLetterExtractionInstructionsV3).toMatch(expected);
  });

  it('keeps precision and server-owned authority explicit in v3', () => {
    expect(commercialLetterExtractionInstructionsV3).toMatch(/Precision é\s+prioridade absoluta/u);
    expect(commercialLetterExtractionInstructionsV3).toMatch(/não invente rows, Policies, Offers/u);
    expect(commercialLetterExtractionInstructionsV3).toMatch(/Nunca escolha Product/u);
    expect(commercialLetterExtractionInstructionsV3).toMatch(/selectedProductId/u);
    expect(commercialLetterExtractionInstructionsV3).toMatch(/promotionPlan/u);
  });

  it.each([
    ['rule inventory / scope ledger', /RULE INVENTORY \/ SCOPE LEDGER/u],
    ['rule-centric reconciliation', /RULE-CENTRIC:[\s\S]*para cada regra/u],
    ['row-centric reconciliation', /ROW-CENTRIC:[\s\S]*para cada\s+row/u],
    ['bidirectional coverage', /BIDIRECTIONAL COVERAGE/u],
    ['exceptions before propagation', /exceptions first:[\s\S]*exclusões e exceções explícitas/u],
    ['scope independent of proximity', /escopo vem da linguagem documental, não da proximidade/u],
    ['general rule in every alternative', /GENERAL RULE[\s\S]*OFFER A OU OFFER B/u],
    ['exclusion-aware propagation', /não a inclua onde houver exclusão explícita/u],
    [
      'rule coverage confidence gate',
      /regra ampla[\s\S]*destinatário não reconciliado,[\s\S]*HIGH é proibida/u,
    ],
    [
      'completeness issue fallback',
      /fallback,[\s\S]*OFFER_COVERAGE_GAP,[\s\S]*SOURCE_BLOCK_INCOMPLETE[\s\S]*SOURCE_AMBIGUITY/u,
    ],
    ['Policy-first preservation', /Construa Policies antes de Offers/u],
    [
      'referential integrity preservation',
      /Offer\.policyClientIds[\s\S]*Policies\[\]\.clientPolicyId/u,
    ],
  ])('v4 contains an explicit %s rule', (_rule, expected) => {
    expect(commercialLetterExtractionInstructionsV4).toMatch(expected);
  });

  it('contains no benchmark-specific manufacturer, model or benefit wording', () => {
    expect(commercialLetterExtractionInstructionsV4).not.toMatch(/Geely|EX5|wallbox|carência/iu);
  });
});
