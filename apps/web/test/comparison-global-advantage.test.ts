import { describe, expect, it } from 'vitest';

import {
  rankBinaryValues,
  rankNumericValues,
  rankScaleRelativeValues,
} from '../src/application/comparison/comparison-global-advantage';

describe('global comparison advantage', () => {
  it('marks only the global numeric maximum when positive is better', () => {
    expect(rankNumericValues([14.8, 15.6, 12.3], 'positive')).toEqual([
      'disadvantage',
      'advantage',
      'disadvantage',
    ]);
  });

  it('marks only the global numeric minimum when negative is better', () => {
    expect(rankNumericValues([2.05, 1.92, 2.18], 'negative')).toEqual([
      'disadvantage',
      'advantage',
      'disadvantage',
    ]);
  });

  it('ranks scale by relative_value, never by digits in the display label', () => {
    expect(rankScaleRelativeValues([2850, 2280, 2280])).toEqual([
      'advantage',
      'disadvantage',
      'disadvantage',
    ]);
  });

  it('allows multiple winners only when they tie at the best value', () => {
    expect(rankScaleRelativeValues([320, 320, 260])).toEqual([
      'advantage',
      'advantage',
      'disadvantage',
    ]);
    expect(rankScaleRelativeValues([320, 320, 320])).toEqual(['tie', 'tie', 'tie']);
  });

  it('treats true as better than false for binary and does not invent an advantage on equality', () => {
    expect(rankBinaryValues([true, true, false])).toEqual([
      'advantage',
      'advantage',
      'disadvantage',
    ]);
    expect(rankBinaryValues([true, true, true])).toEqual(['tie', 'tie', 'tie']);
  });

  it('treats missing binary association as absent, matching seller dot/dash semantics', () => {
    expect(rankBinaryValues([true, null, false])).toEqual([
      'advantage',
      'disadvantage',
      'disadvantage',
    ]);
    expect(rankBinaryValues([null, false, null])).toEqual(['tie', 'tie', 'tie']);
  });

  it('does not claim a global winner for unknown numeric or scale values', () => {
    expect(rankNumericValues([100, null, 90], 'positive')).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ]);
    expect(rankScaleRelativeValues([2850, null, 2280])).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ]);
  });
});
