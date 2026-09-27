import type { ComparisonOutcome } from '@compra-car/contracts';

type NumericDirection = 'positive' | 'negative';

function unknownOutcomes(length: number): readonly ComparisonOutcome[] {
  return Object.freeze(Array.from({ length }, () => 'unknown' as const));
}

function rankNumbers(
  values: readonly (number | null)[],
  direction: NumericDirection,
): readonly ComparisonOutcome[] {
  if (values.some((value) => value === null || !Number.isFinite(value))) {
    return unknownOutcomes(values.length);
  }

  const numericValues = values as readonly number[];
  const first = numericValues[0];
  if (first === undefined || numericValues.every((value) => value === first)) {
    return Object.freeze(numericValues.map(() => 'tie' as const));
  }

  const best =
    direction === 'positive' ? Math.max(...numericValues) : Math.min(...numericValues);
  return Object.freeze(
    numericValues.map((value) => (value === best ? 'advantage' : 'disadvantage') as const),
  );
}

export function rankNumericValues(
  values: readonly (number | null)[],
  direction: NumericDirection | null,
): readonly ComparisonOutcome[] {
  if (direction === null) return unknownOutcomes(values.length);
  return rankNumbers(values, direction);
}

export function rankScaleRelativeValues(
  values: readonly (number | null)[],
): readonly ComparisonOutcome[] {
  return rankNumbers(values, 'positive');
}

export function rankBinaryValues(
  values: readonly (boolean | null)[],
): readonly ComparisonOutcome[] {
  if (values.some((value) => value === null)) return unknownOutcomes(values.length);

  const binaryValues = values as readonly boolean[];
  const first = binaryValues[0];
  if (first === undefined || binaryValues.every((value) => value === first)) {
    return Object.freeze(binaryValues.map(() => 'tie' as const));
  }

  return Object.freeze(
    binaryValues.map((value) => (value ? 'advantage' : 'disadvantage') as const),
  );
}
