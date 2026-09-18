import { describe, expect, it } from 'vitest';
import {
  buildSpecSourceTargets,
  connectorOfficialSource,
  modelYearFixture,
  specTargetKey,
  specCacheDecision,
  specApplicability,
  extractDeterministicSpecs,
  validateSemanticSpecs,
  type SourceScope,
  type SourceSnapshot,
} from '../src/agents';
const f = modelYearFixture('Jeep');
const targets = buildSpecSourceTargets(
  f.context,
  f.rows,
  { country: 'BR', brand: 'Jeep' },
  connectorOfficialSource(f.active),
);
const target = targets.find((t) => t.modelYear === 2026)!;
const snapshot: SourceSnapshot = {
  sourceUrl: 'https://jeep.com.br/modelos',
  finalUrl: 'https://jeep.com.br/modelos',
  sourceKind: 'OFFICIAL_HTML',
  fetchedAt: '2026-09-16T00:00:00Z',
  contentType: 'text/html',
  contentHash: 'abc',
  extractorVersion: '1',
  targetKey: specTargetKey(target),
};
const scope: SourceScope = {
  model: target.model,
  version: target.officialVersionLabel,
  modelYear: 2026,
  matrix: false,
  shared: false,
  currentLineup: false,
};
const doc = (value: string, binding = scope) => ({
  snapshot,
  facts: [
    {
      label: 'Motor',
      value,
      unit: null,
      text: value,
      locator: 'row/1',
      scope: binding,
      method: 'DOM_PAIR' as const,
    },
  ],
  sections: [],
  links: [],
  issues: [],
});
describe('Spec Source pure domain', () => {
  it('dedupes multiple physical PY rows to one MMV + MY target', () => {
    expect(f.rows.filter((r) => r.modelYear === 2026)).toHaveLength(2);
    expect(targets.filter((t) => t.modelYear === 2026)).toHaveLength(1);
  });
  it('rejects incomplete discovery', () =>
    expect(
      buildSpecSourceTargets(
        null,
        f.rows,
        { country: 'BR', brand: 'Jeep' },
        connectorOfficialSource(f.active),
      ),
    ).toEqual([]));
  it.each(['productionYear', 'specCode', 'equipmentId', 'canonicalSpec', 'productSpecId'])(
    'target excludes %s',
    (key) => expect(JSON.stringify(target)).not.toContain('"' + key + '"'),
  );
  it.each(['productionYear', 'specCode', 'equipmentId', 'canonicalSpec', 'productSpecId'])(
    'observation excludes %s',
    (key) =>
      expect(
        JSON.stringify(extractDeterministicSpecs(target, doc('1.3')).observations),
      ).not.toContain('"' + key + '"'),
  );
  it('omitted feature emits no negative', () =>
    expect(extractDeterministicSpecs(target, { ...doc(''), facts: [] }).observations).toEqual([]));
  it('explicit negative is false', () =>
    expect(
      extractDeterministicSpecs(target, doc('não disponível')).observations[0]?.observation,
    ).toMatchObject({ polarity: 'EXPLICIT_NEGATIVE', parsedValue: false }));
  it('blank matrix cell is not false', () =>
    expect(extractDeterministicSpecs(target, doc('—')).observations).toEqual([]));
  it('atomizes explicitly named quantities from one sentence', () =>
    expect(
      extractDeterministicSpecs(
        target,
        doc('Cilindrada de 1.3 L, potência de 185 cv e torque de 270 Nm'),
      ).observations.map((o) => o.observation.parsedValue),
    ).toEqual([1.3, 185, 270]));
  it('keeps exact version and exact MY', () =>
    expect(specApplicability(scope, target)).toMatchObject({
      versionBinding: 'EXACT_VERSION',
      yearBinding: 'EXACT_MY',
    }));
  it('keeps matrix binding instead of upgrading', () =>
    expect(specApplicability({ ...scope, matrix: true }, target)).toMatchObject({
      versionBinding: 'VERSION_MATRIX',
    }));
  it('does not leak another version', () =>
    expect(
      extractDeterministicSpecs(target, doc('1.995', { ...scope, version: 'Other' })),
    ).toMatchObject({ observations: [], rejections: ['VERSION_MISMATCH'] }));
  it('does not leak another MY', () =>
    expect(
      extractDeterministicSpecs(target, doc('1.995', { ...scope, modelYear: 2025 })),
    ).toMatchObject({ observations: [], rejections: ['MY_MISMATCH'] }));
  it('unresolved remains unresolved', () =>
    expect(specApplicability({ ...scope, version: null, modelYear: null }, target)).toMatchObject({
      versionBinding: 'UNRESOLVED',
      yearBinding: 'UNRESOLVED',
    }));
  it('retains unresolved source observations without exact promotion', () =>
    expect(
      extractDeterministicSpecs(target, doc('185', { ...scope, version: null })).observations[0]
        ?.applicability.versionBinding,
    ).toBe('UNRESOLVED'));
  it('preserves shared and current lineup without exact inference', () =>
    expect(
      specApplicability(
        { ...scope, version: null, modelYear: null, shared: true, currentLineup: true },
        target,
      ),
    ).toMatchObject({ versionBinding: 'MODEL_SHARED', yearBinding: 'CURRENT_LINEUP' }));
  it('rejects model mismatch', () =>
    expect(specApplicability({ ...scope, model: 'Other' }, target)).toBe('MODEL_NOT_BOUND'));
  it('same source/hash reuses', () =>
    expect(specCacheDecision(snapshot, { ...snapshot, fetchedAt: 'later' })).toBe('REUSE'));
  it.each([
    { contentHash: 'changed' },
    { targetKey: 'another' },
    { extractorVersion: '2' },
    { finalUrl: 'https://jeep.com.br/other' },
  ])('cache key change extracts %j', (change) =>
    expect(specCacheDecision(snapshot, { ...snapshot, ...change })).toBe('EXTRACT'),
  );
  const input = {
    target,
    snapshot,
    sections: [{ locator: 'p/1', text: 'Potência: 185 cv', scope }],
  };
  const fact = {
    locator: 'p/1',
    observedLabel: 'Potência',
    rawValue: '185',
    rawUnit: 'cv',
    evidenceText: 'Potência: 185 cv',
  };
  it('accepts grounded semantic fact', () =>
    expect(validateSemanticSpecs(input, [fact]).observations).toHaveLength(1));
  it.each([
    { evidenceText: '' },
    { evidenceText: 'Potência: 200 cv' },
    { rawValue: '200' },
    { rawUnit: 'kgfm' },
    { locator: 'missing' },
    { observedLabel: 'Torque' },
  ])('rejects semantic hallucination %j', (change) =>
    expect(validateSemanticSpecs(input, [{ ...fact, ...change }]).rejections).toEqual([
      'INVALID_EVIDENCE',
    ]),
  );
});

it('semantic validation rejects a value belonging to a different label in the same evidence', () => {
  const text = 'Potência: 185 cv; Torque: 270 Nm';
  const result = validateSemanticSpecs(
    { target, snapshot, sections: [{ locator: 'p', text, scope }] },
    [{ locator: 'p', observedLabel: 'Torque', rawValue: '185', rawUnit: 'cv', evidenceText: text }],
  );
  expect(result.observations).toEqual([]);
  expect(result.rejections).toEqual(['INVALID_EVIDENCE']);
});
it('semantic validation does not accept a numeric substring of a different value', () => {
  const text = 'Potência: 185 cv';
  expect(
    validateSemanticSpecs({ target, snapshot, sections: [{ locator: 'p', text, scope }] }, [
      {
        locator: 'p',
        observedLabel: 'Potência',
        rawValue: '18',
        rawUnit: 'cv',
        evidenceText: text,
      },
    ]).observations,
  ).toEqual([]);
});
