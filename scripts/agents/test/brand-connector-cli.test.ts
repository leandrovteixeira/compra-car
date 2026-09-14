import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { parseBrandConnectorArguments, runBrandConnectorCli } from '../run-brand-connector';
import { parseAgentArguments } from '../run-new-product-check';
describe('Brand Connector CLI', () => {
  it('MMV parser accepts a new textual brand independently of resolution', () =>
    expect(
      parseAgentArguments(['--brand', 'Volkswagen', '--provider', 'fixture']).scope.brand,
    ).toBe('Volkswagen'));
  it('rejects unknown flags and invalid modes', () => {
    expect(() =>
      parseBrandConnectorArguments([
        '--brand',
        'Volkswagen',
        '--provider',
        'fixture',
        '--mode',
        'rebuild',
      ]),
    ).toThrow();
  });
  it.each([false, true])('local JSON/Markdown and opt-in persistence=%s', async (persist) => {
    const root = await mkdtemp(join(tmpdir(), 'connector-cli-')),
      persistence = { persistRunBundle: vi.fn(async () => undefined) };
    try {
      expect(
        await runBrandConnectorCli(
          [
            '--brand',
            'Volkswagen',
            '--market',
            'BR',
            '--provider',
            'fixture',
            '--mode',
            'discover',
            ...(persist ? ['--persist-findings'] : []),
          ],
          {},
          vi.fn(),
          root,
          { persistence },
        ),
      ).toBe(0);
      expect(persistence.persistRunBundle).toHaveBeenCalledTimes(persist ? 1 : 0);
      const dir = join(root, '.local-reports/agents/brand-connector'),
        files = await readdir(dir);
      expect(files).toHaveLength(2);
      const report = JSON.parse(
        await readFile(
          join(
            dir,
            files.find((f) => f.endsWith('.json'))!,
          ),
          'utf8',
        ),
      );
      expect(report.run.agentType).toBe('BRAND_CONNECTOR');
      expect(
        await readFile(
          join(
            dir,
            files.find((f) => f.endsWith('.md'))!,
          ),
          'utf8',
        ),
      ).toContain('sintético');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it.each(['healthy', 'drift'])(
    'health fixture %s needs no database configuration',
    async (state) => {
      const root = await mkdtemp(join(tmpdir(), 'connector-health-'));
      try {
        expect(
          await runBrandConnectorCli(
            [
              '--brand',
              'Jeep',
              '--provider',
              'fixture',
              '--mode',
              'health-check',
              '--fixture-state',
              state,
            ],
            {},
            vi.fn(),
            root,
          ),
        ).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
