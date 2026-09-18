import { describe, it, expect } from 'vitest';
import {
  textGrounding,
  groundEvidence,
  sourceStructureCensus,
  validateDocumentExtraction,
  assessCompleteness,
} from '../src/agents';
import { source, target, content } from './document-intelligence-fixture';
const clone = () => structuredClone(content);
describe('21.6 source-aware grounding', () => {
  it('exact text', () =>
    expect(textGrounding('Motor 200 TSI', 'Motor 200 TSI')).toBe('EXACT_TEXT'));
  it('multiline normalized text', () =>
    expect(
      textGrounding(
        'Central de 14,6”\nintegrada com painel',
        'Central de 14,6" integrada com painel',
      ),
    ).toBe('NORMALIZED_TEXT'));
  it('bounded marker fragmentation', () =>
    expect(
      textGrounding(
        'Central 14,6" • integrada com painel',
        'Central 14,6" integrada com painel',
        true,
      ),
    ).toBe('BOUNDED_WINDOW'));
  it('tracked multiline title grounds', () =>
    expect(textGrounding('F I C H A - C S 5 5 P R I M E\nMotor', 'CS55 PRIME', true)).toBe(
      'BOUNDED_WINDOW',
    ));
  it('distant words cannot be stitched', () =>
    expect(textGrounding('Central outra versão 14,6 painel', 'Central 14,6 painel', true)).toBe(
      'NOT_GROUNDED',
    ));
  it('order cannot change', () =>
    expect(textGrounding('Motor TSI 200', 'Motor 200 TSI', true)).toBe('NOT_GROUNDED'));
  it('digits preserved', () =>
    expect(textGrounding('Potência 180', 'Potência 190', true)).toBe('NOT_GROUNDED'));
  it('decimal punctuation preserved', () =>
    expect(textGrounding('Torque 29,2', 'Torque 29.2', true)).toBe('NOT_GROUNDED'));
  it('page mismatch rejected', () =>
    expect(
      groundEvidence(source, {
        sourceHash: 'hash',
        locator: 'card',
        quote: 'Motor 200 TSI',
        page: 9,
      }),
    ).toBe('NOT_GROUNDED'));
  it('structural card grounded', () =>
    expect(
      groundEvidence(source, {
        sourceHash: 'hash',
        locator: 'card',
        quote: 'Comfortline 200 TSI',
        evidenceType: 'STRUCTURAL_CONTEXT',
      }),
    ).toBe('STRUCTURAL_CONTEXT'));
  it('another block cannot supply quote', () =>
    expect(
      groundEvidence(source, { sourceHash: 'hash', locator: 'other', quote: 'Motor 200 TSI' }),
    ).toBe('NOT_GROUNDED'));
  it('missing identity output is repairable when source has identity', () => {
    const c = clone();
    c.documentIdentity.model = null;
    const r = validateDocumentExtraction(source, target, c);
    expect(r.status).toBe('REPAIR_REQUIRED');
    expect(r.issues.some((i) => i.code === 'IDENTITY_OUTPUT_INCOMPLETE')).toBe(true);
  });
  it('genuinely ambiguous source needs review', () => {
    const c = clone();
    c.documentIdentity.evidence = [];
    const s = structuredClone(source);
    s.blocks[0]!.text = 'Motor 200 TSI';
    const r = validateDocumentExtraction(s, target, c);
    expect(r.status).toBe('HUMAN_REVIEW_REQUIRED');
    expect(r.issues.some((i) => i.code === 'IDENTITY_SOURCE_AMBIGUOUS')).toBe(true);
  });
  it('malformed citation with visible fact is repairable', () => {
    const c = clone();
    c.sections[0]!.items[0]!.evidence = [
      { sourceHash: 'hash', locator: 'card', quote: 'synthetic bad citation' },
    ];
    const r = validateDocumentExtraction(source, target, c);
    expect(r.status).toBe('REPAIR_REQUIRED');
    expect(r.issues.some((i) => i.code === 'MODEL_OUTPUT_EVIDENCE_MALFORMED')).toBe(true);
  });
  it('unsupported fact is never emitted', () => {
    const c = clone();
    c.sections[0]!.items[0]!.rawValue = '999 kW';
    c.sections[0]!.items[0]!.evidence[0]!.quote = 'Motor 999 kW';
    const r = validateDocumentExtraction(source, target, c);
    expect(r.observations).toEqual([]);
    expect(r.issues.some((i) => i.code === 'SOURCE_EVIDENCE_UNAVAILABLE')).toBe(true);
  });
  it('old capture citations are not fabricated', () => {
    const c = clone();
    c.documentIdentity.evidence = [];
    const before = JSON.stringify(c);
    const r = validateDocumentExtraction(source, target, c);
    expect(r.status).toBe('REPAIR_REQUIRED');
    expect(JSON.stringify(c)).toBe(before);
  });
  it('same result without any Golden argument or file access', () => {
    expect(validateDocumentExtraction(source, target, clone())).toEqual(
      validateDocumentExtraction(source, target, clone()),
    );
  });
  it('audit records grounding quality', () =>
    expect(
      validateDocumentExtraction(source, target, clone()).grounding?.some(
        (g) => g.quality === 'EXACT_TEXT',
      ),
    ).toBe(true));
});
describe('21.6 structural census independent of domain', () => {
  const s = {
    ...source,
    format: 'PDF_FILE' as const,
    blocks: [
      {
        ...source.blocks[0]!,
        type: 'PAGE' as const,
        text: 'ALPHA\nA 1\nBETA\nB 2\nGAMMA\nC 3\n' + Array(20).fill('Item •').join('\n'),
      },
    ],
  };
  it('detects headings and markers without extracting values', () => {
    const c = sourceStructureCensus(s);
    expect(c.headings).toEqual(['ALPHA', 'BETA', 'GAMMA']);
    expect(c.markerCount).toBe(20);
    expect(JSON.stringify(c)).not.toContain('specCode');
  });
  it('missing headings yield LOW completeness', () =>
    expect(assessCompleteness(sourceStructureCensus(s), clone()).confidence).toBe('LOW'));
  it('substantial missing presence is detected', () =>
    expect(
      assessCompleteness(sourceStructureCensus(s), clone()).major.some((x) =>
        x.includes('PRESENT'),
      ),
    ).toBe(true));
  it('minor marker discrepancy does not fail', () => {
    const c = clone();
    c.sections[0]!.items = Array.from({ length: 19 }, () => ({
      ...c.sections[0]!.items[0]!,
      kind: 'PRESENT' as const,
      present: true,
    }));
    const census = { ...sourceStructureCensus(s), headings: [] };
    expect(assessCompleteness(census, c).major).toEqual([]);
  });
});

it('structural context cannot borrow unrelated sibling identity', () => {
  const s = structuredClone(source);
  s.blocks = [...s.blocks, { ...s.blocks[0]!, locator: 'gts', text: 'GTS 250 TSI' }];
  expect(
    groundEvidence(s, {
      sourceHash: 'hash',
      locator: 'card',
      quote: 'Motor 200 TSI',
      parentContext: 'GTS 250 TSI',
      evidenceType: 'STRUCTURAL_CONTEXT',
    }),
  ).toBe('NOT_GROUNDED');
});
it('no numeric substitution through layout window', () => {
  expect(textGrounding('Central 14,6 • painel 10,3', 'Central 14,6 painel 10,4', true)).toBe(
    'NOT_GROUNDED',
  );
});

it('PDF quote cannot borrow another known section', () => {
  const s = {
    ...source,
    format: 'PDF_FILE' as const,
    blocks: [
      {
        ...source.blocks[0]!,
        locator: 'page/1',
        page: 1,
        text: 'ALPHA\nMotor 200 TSI\nBETA\nMotor 300 TSI',
      },
    ],
  };
  expect(
    groundEvidence(s, {
      sourceHash: 'hash',
      locator: 'page/1',
      page: 1,
      quote: 'Motor 300 TSI',
      sectionHeading: 'ALPHA',
      evidenceType: 'TEXT_WINDOW',
    }),
  ).toBe('NOT_GROUNDED');
  expect(
    groundEvidence(s, {
      sourceHash: 'hash',
      locator: 'page/1',
      page: 1,
      quote: 'Motor 300 TSI',
      sectionHeading: 'BETA',
      evidenceType: 'TEXT_WINDOW',
    }),
  ).toBe('EXACT_TEXT');
});

it('repeated heading occurrences on one page are not erased by deduplication', () => {
  const s = {
    ...source,
    format: 'PDF_FILE' as const,
    blocks: [
      { ...source.blocks[0]!, type: 'PAGE' as const, text: 'ALPHA\nA 1\nBETA\nB 2\nBETA\nC 3' },
    ],
  };
  const c = clone();
  c.sections = [
    { ...c.sections[0]!, sourceHeading: 'ALPHA' },
    { ...c.sections[0]!, sourceHeading: 'BETA' },
  ];
  expect(sourceStructureCensus(s).headings).toEqual(['ALPHA', 'BETA', 'BETA']);
  expect(assessCompleteness(sourceStructureCensus(s), c).confidence).toBe('LOW');
});
it('repeated multipage headings remain a conservative warning', () => {
  const census = {
    ...sourceStructureCensus(source),
    pageCount: 2,
    headings: ['ALPHA', 'ALPHA', 'ALPHA'],
  };
  expect(assessCompleteness(census, clone()).confidence).toBe('MEDIUM');
});
