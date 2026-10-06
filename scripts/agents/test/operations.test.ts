import { describe, expect, it } from 'vitest';
import { commandFor, parseOperationsArguments } from '../operations';

describe('Sprint 25 operations', () => {
  it('builds a deterministic low-cost default pipeline', () => {
    const parsed = parseOperationsArguments(['--brands','Jeep,VW']);
    expect(parsed.market).toBe('BR');
    expect(parsed.maxRetries).toBe(1);
    expect(parsed.stages).toEqual(['BRAND_CONNECTOR','MMV_DISCOVERY','MODEL_YEAR']);
    expect(commandFor('MODEL_YEAR','Jeep','BR')).toContain('structured');
  });

  it('caps retries at two and rejects duplicate brands', () => {
    expect(() => parseOperationsArguments(['--brands','Jeep','--max-retries','3'])).toThrow();
    expect(() => parseOperationsArguments(['--brands','Jeep,jeep'])).toThrow();
  });

  it('supports a no-side-effect dry run', () => {
    const parsed = parseOperationsArguments([
      '--brands','Toyota',
      '--stages','MODEL_YEAR',
      '--dry-run',
    ]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.stages).toEqual(['MODEL_YEAR']);
  });
});
