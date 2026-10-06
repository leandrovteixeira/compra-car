import { describe, expect, it } from 'vitest';
import { parseModelYearArguments, runModelYearCli } from '../run-model-year';

describe('Model Year CLI', () => {
  it('parses a fixture dry-run', () => {
    expect(parseModelYearArguments(['--brand', 'Jeep', '--provider', 'fixture'])).toMatchObject({
      provider: 'fixture',
      persistFindings: false,
      scope: { country: 'BR', brand: 'Jeep' },
    });
  });

  it('rejects persistence without Supabase configuration', async () => {
    const logs: string[] = [];
    const code = await runModelYearCli(
      ['--brand', 'Jeep', '--provider', 'fixture', '--persist-findings'],
      {},
      (line) => logs.push(line),
    );
    expect(code).toBe(1);
    expect(logs.join('\n')).toContain('SUPABASE_AGENT_CONFIG_REQUIRED');
  });
});
