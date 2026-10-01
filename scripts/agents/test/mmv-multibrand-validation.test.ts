import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  MMV_MULTI_BRAND_VALIDATION_BRANDS,
  runMmvMultiBrandValidation,
} from '../run-mmv-multibrand-validation';

describe('Sprint 20F multi-brand validation runner', () => {
  it('runs MMV only for active connectors and routes missing connectors to review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mmv-20f-'));
    const connector = vi.fn(async (brand: string) =>
      ['Toyota', 'Jeep'].includes(brand) ? { status: 'ACTIVE' } : null,
    );
    const connectorDiscovery = vi.fn(async () => 0);
    const mmvDiscovery = vi.fn(async () => 0);
    try {
      const result = await runMmvMultiBrandValidation(
        {
          SUPABASE_URL: 'https://offline.invalid',
          SUPABASE_SERVER_KEY: 'server-key',
          OPENAI_API_KEY: 'openai-key',
          OPENAI_AGENT_MODEL: 'fixture-model',
        },
        root,
        {
          getActiveConnector: connector,
          runConnectorDiscovery: connectorDiscovery,
          runMmvDiscovery: mmvDiscovery,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.items.map((item) => [item.brand, item.status])).toEqual([
        ['Toyota', 'MMV_RUN_COMPLETED'],
        ['Jeep', 'MMV_RUN_COMPLETED'],
        ['Volkswagen', 'CONNECTOR_REVIEW_REQUIRED'],
        ['Audi', 'CONNECTOR_REVIEW_REQUIRED'],
      ]);
      expect(mmvDiscovery.mock.calls.map(([brand]) => brand)).toEqual(['Toyota', 'Jeep']);
      expect(connectorDiscovery.mock.calls.map(([brand]) => brand)).toEqual([
        'Volkswagen',
        'Audi',
      ]);
      expect(connector).toHaveBeenCalledTimes(MMV_MULTI_BRAND_VALIDATION_BRANDS.length);

      const dir = join(root, '.local-reports/agents/mmv-multibrand-validation');
      const files = await readdir(dir);
      expect(files.some((name) => name.endsWith('.json'))).toBe(true);
      const json = JSON.parse(
        await readFile(join(dir, files.find((name) => name.endsWith('.json'))!), 'utf8'),
      );
      expect(json).toMatchObject({
        schemaVersion: '20F.1',
        productionMutation: false,
        canonicalApplyExecuted: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
