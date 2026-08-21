import { describe, expect, it } from 'vitest';

import type {
  CommercialDocumentConfidence,
  CommercialSourceDocument,
} from '../src/import/commercial-document-extraction';
import { resolveCommercialDocumentPeriod } from '../src/import/commercial-document-period-resolution';
import type { SemanticallyReconciledCommercialDocument } from '../src/import/commercial-document-semantic-reconciliation';

const confidence: CommercialDocumentConfidence = {
  score: 99,
  ambiguous: false,
  requiresReview: false,
  reasons: [],
};
const evidence = { blockIds: ['block-period'] };

const document = (input: {
  readonly competences?: readonly string[];
  readonly validities?: readonly { readonly startsOn?: string; readonly endsOn?: string }[];
}): CommercialSourceDocument => ({
  documentId: 'document-main',
  ordinal: 1,
  pageCount: 1,
  documentKind: 'commercial_letter',
  competenceCandidates: (input.competences ?? []).map((value) => ({ value, evidence, confidence })),
  validityCandidates: (input.validities ?? []).map((validity) => ({
    ...validity,
    rawText: [validity.startsOn, validity.endsOn].filter(Boolean).join(' a '),
    evidence,
    confidence,
  })),
  notes: [],
});

const semantic = (documents: readonly CommercialSourceDocument[]) =>
  ({ documents }) as SemanticallyReconciledCommercialDocument;

describe('commercial document period resolution', () => {
  it('uses a valid server-owned batch competence when documentary candidates are compatible', () => {
    expect(
      resolveCommercialDocumentPeriod({
        batchCompetence: '2026-02',
        semanticDocument: semantic([
          document({
            competences: ['2026-02'],
            validities: [{ startsOn: '2026-02-01', endsOn: '2026-02-28' }],
          }),
        ]),
      }),
    ).toEqual({
      status: 'resolved',
      source: 'batch',
      period: {
        competence: '2026-02',
        kind: 'monthly',
        startsOn: '2026-02-01',
        endsOn: '2026-02-28',
      },
    });
  });

  it('uses explicit documentary validity when batch competence is absent', () => {
    expect(
      resolveCommercialDocumentPeriod({
        batchCompetence: null,
        semanticDocument: semantic([
          document({ validities: [{ startsOn: '2026-02-01', endsOn: '2026-02-28' }] }),
        ]),
      }),
    ).toMatchObject({
      status: 'resolved',
      source: 'document_validity',
      period: { competence: '2026-02', startsOn: '2026-02-01', endsOn: '2026-02-28' },
    });
  });

  it('derives only calendar bounds from an explicit documentary competence', () => {
    expect(
      resolveCommercialDocumentPeriod({
        batchCompetence: null,
        semanticDocument: semantic([document({ competences: ['2028-02'] })]),
      }),
    ).toMatchObject({
      status: 'resolved',
      source: 'document_competence',
      period: { startsOn: '2028-02-01', endsOn: '2028-02-29' },
    });
  });

  it('refuses a genuinely unavailable period without fabricating dates', () => {
    expect(
      resolveCommercialDocumentPeriod({
        batchCompetence: null,
        semanticDocument: semantic([document({})]),
      }),
    ).toEqual({ status: 'unavailable', reason: 'DOCUMENT_PERIOD_UNAVAILABLE' });
  });

  it.each([
    {
      name: 'conflicting documentary competences',
      batchCompetence: null,
      value: document({ competences: ['2026-02', '2026-03'] }),
    },
    {
      name: 'batch/document mismatch',
      batchCompetence: '2026-02',
      value: document({ competences: ['2026-03'] }),
    },
    {
      name: 'different documentary validity ranges',
      batchCompetence: null,
      value: document({
        validities: [
          { startsOn: '2026-02-01', endsOn: '2026-02-28' },
          { startsOn: '2026-02-10', endsOn: '2026-02-20' },
        ],
      }),
    },
  ])('refuses $name', ({ batchCompetence, value }) => {
    expect(
      resolveCommercialDocumentPeriod({
        batchCompetence,
        semanticDocument: semantic([value]),
      }),
    ).toEqual({ status: 'ambiguous', reason: 'DOCUMENT_PERIOD_CONFLICT' });
  });

  it('deduplicates compatible repeated validity and remains deterministic and immutable', () => {
    const value = semantic([
      document({
        competences: ['2026-02', '2026-02'],
        validities: [
          { startsOn: '2026-02-01', endsOn: '2026-02-28' },
          { startsOn: '2026-02-01', endsOn: '2026-02-28' },
        ],
      }),
    ]);
    const before = structuredClone(value);
    const first = resolveCommercialDocumentPeriod({
      batchCompetence: null,
      semanticDocument: value,
    });
    const second = resolveCommercialDocumentPeriod({
      batchCompetence: null,
      semanticDocument: value,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ status: 'resolved', source: 'document_validity' });
    expect(value).toEqual(before);
  });
});
