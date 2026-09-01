import type {
  CommercialDocumentExtractionV1,
  CommercialDocumentFact,
  CommercialDocumentFactType,
  CommercialDocumentVehicleIdentity,
} from './commercial-document-extraction';

export type GoldenBenchmarkUnit = 'BRL' | 'percent' | 'months' | 'days' | 'text';

export interface GoldenBenchmarkFact {
  readonly id: string;
  readonly document: string;
  readonly page: number;
  readonly channel: string;
  readonly model: string;
  readonly version?: string;
  readonly productionYear?: number;
  readonly modelYear?: number;
  readonly factType: CommercialDocumentFactType;
  readonly value: string;
  readonly unit: GoldenBenchmarkUnit;
  readonly evidence: string;
  readonly critical: boolean;
}

export interface GoldenBenchmarkComposition {
  readonly id: string;
  readonly document: string;
  readonly page: number;
  readonly channel: string;
  readonly model: string;
  readonly version?: string;
  readonly relation: 'AND' | 'OR';
  readonly memberFactIds: readonly string[];
  readonly evidence: string;
}

export type GoldenBenchmarkFailureCode =
  | 'MISSING_FACT'
  | 'WRONG_FACT_TYPE'
  | 'WRONG_VALUE'
  | 'WRONG_UNIT'
  | 'WRONG_CHANNEL'
  | 'WRONG_VEHICLE'
  | 'WRONG_PAGE'
  | 'MISSING_EVIDENCE'
  | 'WRONG_EVIDENCE'
  | 'UNEXPECTED_FACT'
  | 'WRONG_COMPOSITION_RELATION'
  | 'WRONG_COMPOSITION_MEMBERSHIP'
  | 'WRONG_COMPOSITION_SCOPE'
  | 'WRONG_COMPOSITION_EVIDENCE';

export interface GoldenBenchmarkFailure {
  readonly code: GoldenBenchmarkFailureCode;
  readonly expectedId?: string;
  readonly actualId?: string;
  readonly message: string;
}

export interface GoldenBenchmarkFactCount {
  readonly expected: number;
  readonly matched: number;
  readonly missing: number;
  readonly wrong: number;
  readonly unexpected: number;
}

export interface GoldenBenchmarkCompositionCount {
  readonly expected: number;
  readonly matched: number;
  readonly wrong: number;
}

export interface CommercialDocumentGoldenBenchmarkReport {
  readonly document: string;
  readonly facts: GoldenBenchmarkFactCount;
  readonly criticalFacts: GoldenBenchmarkFactCount;
  readonly composition: GoldenBenchmarkCompositionCount;
  readonly criticalFactRecall: number;
  readonly overallFactRecall: number;
  readonly precision: number;
  readonly compositionAccuracy: number;
  readonly provenanceAccuracy: number;
  readonly failures: readonly GoldenBenchmarkFailure[];
  readonly status: 'PASS' | 'FAIL';
}

export interface RunCommercialDocumentGoldenBenchmarkInput {
  readonly document: string;
  readonly artifact: CommercialDocumentExtractionV1 | readonly CommercialDocumentExtractionV1[];
  readonly expectedFacts: readonly GoldenBenchmarkFact[];
  readonly expectedCompositions: readonly GoldenBenchmarkComposition[];
}

interface ResolvedContext {
  readonly channels: readonly string[];
  readonly vehicles: readonly CommercialDocumentVehicleIdentity[];
  readonly models: readonly string[];
  readonly versions: readonly string[];
}

interface ActualFact {
  readonly artifactIndex: number;
  readonly fact: CommercialDocumentFact;
  readonly pages: readonly number[];
  readonly evidenceText: string;
  readonly evidenceReferencesValid: boolean;
  readonly context: ResolvedContext;
  readonly value: string;
  readonly unit: string;
}

const normalizedText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');

const normalizedNumber = (value: string): string => {
  const compact = value.trim().replace(/\s+/gu, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(compact)) return normalizedText(value);
  const negative = compact.startsWith('-');
  const unsigned = compact.replace(/^[+-]/u, '');
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const normalizedInteger = integer.replace(/^0+(?=\d)/u, '') || '0';
  const normalizedFraction = fraction.replace(/0+$/u, '');
  return `${negative ? '-' : ''}${normalizedInteger}${normalizedFraction ? `.${normalizedFraction}` : ''}`;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];
const normalizedIncludes = (values: readonly string[], expected: string): boolean =>
  values.some((value) => normalizedText(value) === normalizedText(expected));
const sameSet = (left: readonly string[], right: readonly string[]): boolean => {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};
const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 1 : numerator / denominator;

const valueAndUnit = (fact: CommercialDocumentFact): { value: string; unit: string } => {
  switch (fact.value.kind) {
    case 'money':
      return {
        value: normalizedNumber(fact.value.amount),
        unit: fact.value.currency.toUpperCase(),
      };
    case 'percentage':
      return { value: normalizedNumber(fact.value.percentage), unit: 'percent' };
    case 'quantity':
      return { value: normalizedNumber(fact.value.amount), unit: normalizedText(fact.value.unit) };
    case 'text':
      return { value: normalizedText(fact.value.text), unit: 'text' };
    case 'boolean':
      return { value: String(fact.value.value), unit: 'text' };
  }
};

const resolveContext = (
  artifact: CommercialDocumentExtractionV1,
  scopeIds: readonly string[],
  directChannel?: string,
): ResolvedContext => {
  const scopeIdSet = new Set(scopeIds);
  const scopes = artifact.scopes.filter((scope) => scopeIdSet.has(scope.scopeId));
  const vehicleIds = new Set(scopes.flatMap((scope) => scope.selector.vehicleIdentityIds ?? []));
  const vehicles = artifact.vehicleIdentities.filter((vehicle) =>
    vehicleIds.has(vehicle.vehicleIdentityId),
  );
  return {
    channels: unique([
      ...(directChannel ? [directChannel] : []),
      ...scopes.flatMap((scope) => scope.selector.channels ?? []),
    ]),
    vehicles,
    models: unique([
      ...vehicles.map((vehicle) => vehicle.model),
      ...scopes.flatMap((scope) => scope.selector.models ?? []),
    ]),
    versions: unique([
      ...vehicles.flatMap((vehicle) => (vehicle.version ? [vehicle.version] : [])),
      ...scopes.flatMap((scope) => scope.selector.versions ?? []),
    ]),
  };
};

const resolvesVehicle = (actual: ActualFact, expected: GoldenBenchmarkFact): boolean => {
  if (actual.context.vehicles.length)
    return actual.context.vehicles.some(
      (vehicle) =>
        normalizedText(vehicle.model) === normalizedText(expected.model) &&
        (expected.version === undefined ||
          (vehicle.version !== undefined &&
            normalizedText(vehicle.version) === normalizedText(expected.version))) &&
        (expected.productionYear === undefined ||
          vehicle.productionYear === expected.productionYear) &&
        (expected.modelYear === undefined || vehicle.modelYear === expected.modelYear),
    );
  return (
    normalizedIncludes(actual.context.models, expected.model) &&
    (expected.version === undefined ||
      normalizedIncludes(actual.context.versions, expected.version)) &&
    expected.productionYear === undefined &&
    expected.modelYear === undefined
  );
};

const actualFacts = (artifacts: readonly CommercialDocumentExtractionV1[]): ActualFact[] =>
  artifacts.flatMap((artifact, artifactIndex) => {
    const blocks = new Map(artifact.blocks.map((block) => [block.blockId, block]));
    return artifact.facts.map((fact) => {
      const referencedBlocks = fact.evidence.blockIds.map((blockId) => blocks.get(blockId));
      const resolvedBlocks = referencedBlocks.filter((block) => block !== undefined);
      const normalized = valueAndUnit(fact);
      return {
        artifactIndex,
        fact,
        pages: unique(resolvedBlocks.map((block) => String(block.page))).map(Number),
        evidenceText: [fact.evidence.excerpt ?? '', ...resolvedBlocks.map((block) => block.excerpt)]
          .filter(Boolean)
          .join(' '),
        evidenceReferencesValid:
          fact.evidence.blockIds.length > 0 && resolvedBlocks.length === referencedBlocks.length,
        context: resolveContext(artifact, fact.scopeIds, fact.channel),
        value: normalized.value,
        unit: normalized.unit,
      };
    });
  });

type SemanticDifference = 'factType' | 'value' | 'unit' | 'channel' | 'vehicle' | 'page';

const semanticDifferences = (
  actual: ActualFact,
  expected: GoldenBenchmarkFact,
): SemanticDifference[] => {
  const differences: SemanticDifference[] = [];
  if (actual.fact.factType !== expected.factType) differences.push('factType');
  const expectedValue =
    expected.unit === 'text' ? normalizedText(expected.value) : normalizedNumber(expected.value);
  if (actual.value !== expectedValue) differences.push('value');
  const expectedUnit = expected.unit === 'BRL' ? 'BRL' : normalizedText(expected.unit);
  if (actual.unit !== expectedUnit) differences.push('unit');
  if (!normalizedIncludes(actual.context.channels, expected.channel)) differences.push('channel');
  if (!resolvesVehicle(actual, expected)) differences.push('vehicle');
  if (!actual.pages.includes(expected.page)) differences.push('page');
  return differences;
};

const evidenceCompatible = (actual: string, expected: string): boolean => {
  const normalizedActual = normalizedText(actual);
  const normalizedExpected = normalizedText(expected);
  if (!normalizedActual || !normalizedExpected) return false;
  if (
    normalizedActual.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedActual)
  )
    return true;
  const expectedTokens = unique(normalizedExpected.split(' ').filter((token) => token.length > 1));
  const actualTokens = new Set(normalizedActual.split(' '));
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
  return (
    matched >= Math.min(2, expectedTokens.length) && ratio(matched, expectedTokens.length) >= 0.5
  );
};

const evidenceFailure = (
  actual: ActualFact,
  expected: GoldenBenchmarkFact,
): GoldenBenchmarkFailure | undefined => {
  if (!actual.evidenceReferencesValid || !actual.evidenceText.trim())
    return {
      code: 'MISSING_EVIDENCE',
      expectedId: expected.id,
      actualId: actual.fact.factId,
      message: `Fact ${expected.id} has empty or disconnected evidence.`,
    };
  if (
    !actual.pages.includes(expected.page) ||
    !evidenceCompatible(actual.evidenceText, expected.evidence)
  )
    return {
      code: 'WRONG_EVIDENCE',
      expectedId: expected.id,
      actualId: actual.fact.factId,
      message: `Fact ${expected.id} evidence does not support the audited page/content.`,
    };
  return undefined;
};

const similarity = (actual: ActualFact, expected: GoldenBenchmarkFact): number => {
  let score = 0;
  if (actual.fact.factType === expected.factType) score += 2;
  const expectedValue =
    expected.unit === 'text' ? normalizedText(expected.value) : normalizedNumber(expected.value);
  if (actual.value === expectedValue) score += 2;
  if (normalizedIncludes(actual.context.channels, expected.channel)) score += 3;
  if (resolvesVehicle(actual, expected)) score += 4;
  if (actual.pages.includes(expected.page)) score += 1;
  return score;
};

const differenceFailure = (
  difference: SemanticDifference,
  expected: GoldenBenchmarkFact,
  actual: ActualFact,
): GoldenBenchmarkFailure => {
  const mapping: Record<SemanticDifference, GoldenBenchmarkFailureCode> = {
    factType: 'WRONG_FACT_TYPE',
    value: 'WRONG_VALUE',
    unit: 'WRONG_UNIT',
    channel: 'WRONG_CHANNEL',
    vehicle: 'WRONG_VEHICLE',
    page: 'WRONG_PAGE',
  };
  return {
    code: mapping[difference],
    expectedId: expected.id,
    actualId: actual.fact.factId,
    message: `Fact ${expected.id} has wrong ${difference}.`,
  };
};

const scopeMatchesComposition = (
  artifact: CommercialDocumentExtractionV1,
  scopeIds: readonly string[],
  expected: GoldenBenchmarkComposition,
): boolean => {
  const context = resolveContext(artifact, scopeIds);
  const vehicleMatches = context.vehicles.some(
    (vehicle) =>
      normalizedText(vehicle.model) === normalizedText(expected.model) &&
      (expected.version === undefined ||
        (vehicle.version !== undefined &&
          normalizedText(vehicle.version) === normalizedText(expected.version))),
  );
  const selectorMatches =
    normalizedIncludes(context.models, expected.model) &&
    (expected.version === undefined || normalizedIncludes(context.versions, expected.version));
  return (
    normalizedIncludes(context.channels, expected.channel) && (vehicleMatches || selectorMatches)
  );
};

const benchmarkCompositions = (
  artifacts: readonly CommercialDocumentExtractionV1[],
  expectedCompositions: readonly GoldenBenchmarkComposition[],
  matchedFacts: ReadonlyMap<string, ActualFact>,
): { matched: number; failures: GoldenBenchmarkFailure[]; provenancePassed: number } => {
  let matched = 0;
  let provenancePassed = 0;
  const failures: GoldenBenchmarkFailure[] = [];
  for (const expected of expectedCompositions) {
    const members = expected.memberFactIds.map((id) => matchedFacts.get(id));
    if (members.some((member) => member === undefined)) {
      failures.push({
        code: 'WRONG_COMPOSITION_MEMBERSHIP',
        expectedId: expected.id,
        message: `Composition ${expected.id} references an unmatched expected fact.`,
      });
      continue;
    }
    const actualMembers = members as ActualFact[];
    if (new Set(actualMembers.map((member) => member.artifactIndex)).size !== 1) {
      failures.push({
        code: 'WRONG_COMPOSITION_MEMBERSHIP',
        expectedId: expected.id,
        message: `Composition ${expected.id} members were emitted in disconnected artifacts.`,
      });
      continue;
    }
    const artifact = artifacts[actualMembers[0]!.artifactIndex]!;
    const memberIds = actualMembers.map((member) => member.fact.factId);
    const groupType = expected.relation === 'OR' ? 'ALTERNATIVE' : 'CUMULATIVE';
    const relationType = expected.relation === 'OR' ? 'MUTUALLY_EXCLUSIVE' : 'APPLIES_TOGETHER';
    const oppositeType = expected.relation === 'OR' ? 'APPLIES_TOGETHER' : 'MUTUALLY_EXCLUSIVE';
    const group = artifact.composition.groups.find(
      (candidate) =>
        candidate.groupType === groupType && sameSet(candidate.memberFactIds, memberIds),
    );
    const relationship = artifact.composition.relationships.find(
      (candidate) =>
        candidate.relationType === relationType && sameSet(candidate.factIds, memberIds),
    );
    if (!group || !relationship) {
      const opposite = artifact.composition.relationships.some(
        (candidate) =>
          candidate.relationType === oppositeType && sameSet(candidate.factIds, memberIds),
      );
      failures.push({
        code: opposite ? 'WRONG_COMPOSITION_RELATION' : 'WRONG_COMPOSITION_MEMBERSHIP',
        expectedId: expected.id,
        message: opposite
          ? `Composition ${expected.id} changed ${expected.relation} semantics.`
          : `Composition ${expected.id} does not preserve exact fact membership.`,
      });
      continue;
    }
    const scopeIds = unique([...group.scopeIds, ...relationship.scopeIds]);
    if (!scopeMatchesComposition(artifact, scopeIds, expected)) {
      failures.push({
        code: 'WRONG_COMPOSITION_SCOPE',
        expectedId: expected.id,
        actualId: relationship.relationId,
        message: `Composition ${expected.id} has the wrong channel or vehicle scope.`,
      });
      continue;
    }
    const blocks = relationship.evidenceBlockIds
      .map((id) => artifact.blocks.find((block) => block.blockId === id))
      .filter((block) => block !== undefined);
    const evidenceValid =
      relationship.evidenceBlockIds.length > 0 &&
      blocks.length === relationship.evidenceBlockIds.length &&
      blocks.some((block) => block.page === expected.page) &&
      evidenceCompatible(blocks.map((block) => block.excerpt).join(' '), expected.evidence);
    if (!evidenceValid) {
      failures.push({
        code: 'WRONG_COMPOSITION_EVIDENCE',
        expectedId: expected.id,
        actualId: relationship.relationId,
        message: `Composition ${expected.id} has empty, disconnected, or incompatible evidence.`,
      });
      continue;
    }
    matched += 1;
    provenancePassed += 1;
  }
  return { matched, failures, provenancePassed };
};

export function runCommercialDocumentGoldenBenchmark(
  input: RunCommercialDocumentGoldenBenchmarkInput,
): CommercialDocumentGoldenBenchmarkReport {
  const artifacts = Array.isArray(input.artifact) ? input.artifact : [input.artifact];
  const expectedFacts = input.expectedFacts.filter((fact) => fact.document === input.document);
  const expectedCompositions = input.expectedCompositions.filter(
    (composition) => composition.document === input.document,
  );
  const actual = actualFacts(artifacts);
  const usedActual = new Set<ActualFact>();
  const matchedFacts = new Map<string, ActualFact>();
  const wrongFacts = new Map<string, ActualFact>();
  const failures: GoldenBenchmarkFailure[] = [];
  let provenancePassed = 0;

  for (const expected of expectedFacts) {
    const match = actual.find(
      (candidate) =>
        !usedActual.has(candidate) && semanticDifferences(candidate, expected).length === 0,
    );
    if (!match) continue;
    usedActual.add(match);
    matchedFacts.set(expected.id, match);
    const provenanceFailure = evidenceFailure(match, expected);
    if (provenanceFailure) failures.push(provenanceFailure);
    else provenancePassed += 1;
  }

  for (const expected of expectedFacts.filter((fact) => !matchedFacts.has(fact.id))) {
    const candidate = actual
      .filter((item) => !usedActual.has(item))
      .map((item) => ({ item, score: similarity(item, expected) }))
      .filter(({ score }) => score >= 5)
      .sort((left, right) => right.score - left.score)[0]?.item;
    if (!candidate) {
      failures.push({
        code: 'MISSING_FACT',
        expectedId: expected.id,
        message: `Expected fact ${expected.id} is missing.`,
      });
      continue;
    }
    usedActual.add(candidate);
    wrongFacts.set(expected.id, candidate);
    failures.push(
      ...semanticDifferences(candidate, expected).map((difference) =>
        differenceFailure(difference, expected, candidate),
      ),
    );
  }

  const unexpected = actual.filter((fact) => !usedActual.has(fact));
  failures.push(
    ...unexpected.map((fact) => ({
      code: 'UNEXPECTED_FACT' as const,
      actualId: fact.fact.factId,
      message: `Unexpected fact ${fact.fact.factId} was emitted.`,
    })),
  );

  const composition = benchmarkCompositions(artifacts, expectedCompositions, matchedFacts);
  failures.push(...composition.failures);
  provenancePassed += composition.provenancePassed;

  const critical = expectedFacts.filter((fact) => fact.critical);
  const matchedCritical = critical.filter((fact) => matchedFacts.has(fact.id)).length;
  const wrongCritical = critical.filter((fact) => wrongFacts.has(fact.id)).length;
  const missingCritical = critical.length - matchedCritical - wrongCritical;
  const criticalFactRecall = ratio(matchedCritical, critical.length);
  const overallFactRecall = ratio(matchedFacts.size, expectedFacts.length);
  const precision = ratio(matchedFacts.size, actual.length);
  const compositionAccuracy = ratio(composition.matched, expectedCompositions.length);
  const provenanceAccuracy = ratio(
    provenancePassed,
    expectedFacts.length + expectedCompositions.length,
  );
  const status =
    criticalFactRecall === 1 &&
    precision === 1 &&
    compositionAccuracy === 1 &&
    provenanceAccuracy === 1
      ? 'PASS'
      : 'FAIL';

  return {
    document: input.document,
    facts: {
      expected: expectedFacts.length,
      matched: matchedFacts.size,
      missing: expectedFacts.length - matchedFacts.size - wrongFacts.size,
      wrong: wrongFacts.size,
      unexpected: unexpected.length,
    },
    criticalFacts: {
      expected: critical.length,
      matched: matchedCritical,
      missing: missingCritical,
      wrong: wrongCritical,
      unexpected: unexpected.filter((fact) =>
        critical.some((expected) => similarity(fact, expected) >= 5),
      ).length,
    },
    composition: {
      expected: expectedCompositions.length,
      matched: composition.matched,
      wrong: expectedCompositions.length - composition.matched,
    },
    criticalFactRecall,
    overallFactRecall,
    precision,
    compositionAccuracy,
    provenanceAccuracy,
    failures,
    status,
  };
}

export function formatCommercialDocumentGoldenBenchmark(
  report: CommercialDocumentGoldenBenchmarkReport,
): string {
  const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
  const lines = [
    `${report.status} ${report.document}`,
    `facts: ${report.facts.matched}/${report.facts.expected} matched; ${report.facts.missing} missing; ${report.facts.wrong} wrong; ${report.facts.unexpected} unexpected`,
    `critical recall: ${percent(report.criticalFactRecall)}`,
    `precision: ${percent(report.precision)}`,
    `composition: ${percent(report.compositionAccuracy)}`,
    `provenance: ${percent(report.provenanceAccuracy)}`,
  ];
  if (report.failures.length)
    lines.push(
      'failures:',
      ...report.failures.map(
        (failure) =>
          `- ${failure.code}${failure.expectedId ? ` expected=${failure.expectedId}` : ''}${failure.actualId ? ` actual=${failure.actualId}` : ''}: ${failure.message}`,
      ),
    );
  return lines.join('\n');
}
