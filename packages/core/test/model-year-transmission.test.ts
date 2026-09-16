import { describe, expect, it, vi } from 'vitest';
import {
  groupModelYearTargets,
  matchStructuredRows,
  normalizeTransmissionFamily,
  structuredVersionMatches,
  StructuredFirstModelYearResearch,
} from '../src/agents';
import { mmvDiscoveryStructuredCases } from './fixtures/model-year-mmv-discovery';

describe('structured transmission normalization', () => {
  it.each([
    'Automático',
    'Automática',
    'Automatico',
    'Automatica',
    'Automática de 6 velocidades',
    'Automática de 8 velocidades',
    'AUTOMÁTICO',
    'AUTOMÁTICA',
  ])('normalizes Portuguese %s to AT', (label) => {
    expect(normalizeTransmissionFamily(label)).toBe('AT');
  });

  const target = mmvDiscoveryStructuredCases[0]!.targets[0]!;
  const row = mmvDiscoveryStructuredCases[0]!.rows[0]!;
  it.each([
    ['CVT', 'Automático'],
    ['Automática de 6 velocidades', 'CVT'],
    ['Manual', 'Automático'],
    ['Automática de 6 velocidades', 'Manual'],
    ['DHT', 'Automático'],
    ['Automática de 8 velocidades', 'DHT'],
  ])('rejects target %s against observed %s', (transmission, observed) => {
    const t = { ...target, structuredIdentity: { ...target.structuredIdentity, transmission } };
    const r = { ...row, versionLabel: row.versionLabel.replace('Automático', observed) };
    const result = matchStructuredRows(groupModelYearTargets([t])[0]!, [r]);
    expect(result.matched).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.rejections[0]?.reasonCode).toBe('STRUCTURED_VERSION_NOT_MATCHED');
  });
  it.each([
    ['Câmbio especial', 'Câmbio especial', true],
    ['Câmbio especial', 'Automático', false],
    ['Câmbio especial', 'Câmbio', false],
  ])('retains literal fallback for %s against %s', (transmission, observed, matches) => {
    expect(
      structuredVersionMatches(
        { ...row, versionLabel: row.versionLabel.replace('Automático', observed) },
        { ...target, structuredIdentity: { ...target.structuredIdentity, transmission } },
      ),
    ).toBe(matches);
  });
});

describe('persisted MMV Discovery transmission regression', () => {
  it.each(mmvDiscoveryStructuredCases)(
    '$model produces $count unique matches',
    ({ targets, rows, count }) => {
      const result = matchStructuredRows(groupModelYearTargets(targets)[0]!, rows);
      expect(result.matched).toBe(count);
      expect(result.rejected).toBe(0);
      expect(result.rejections).toEqual([]);
      expect(result.observations).toHaveLength(count);
      for (const target of targets)
        expect(result.observations.filter((o) => o.targetKey === target.targetKey)).toHaveLength(1);
    },
  );
  it('runtime resolves all three model groups without initializing fallback', async () => {
    const fallback = vi.fn(async () => {
      throw new Error('Fallback must not initialize');
    });
    const research = new StructuredFirstModelYearResearch({
      structured: {
        async discover(group) {
          const rows = mmvDiscoveryStructuredCases.find((c) => c.model === group.model)!.rows;
          return { rows, issues: [], metrics: { structuredRowsParsed: rows.length } };
        },
      },
      fallback,
    });
    const result = await research.researchModelYears(
      mmvDiscoveryStructuredCases.flatMap((c) => c.targets),
      {
        brand: 'VW',
        country: 'BR',
        allowedDomains: ['vw.com.br'],
        allowedHosts: ['www.vw.com.br'],
        allowedSubdomainRoots: [],
        searchHints: [],
      },
    );
    expect(result.metrics).toMatchObject({
      modelGroups: 3,
      structuredRowsParsed: 8,
      structuredRowsMatched: 8,
      structuredRowsRejected: 0,
      openAiModelGroupsResearched: 0,
    });
    expect(result.observations).toHaveLength(8);
    expect(result.rejections).toEqual([]);
    expect(fallback).not.toHaveBeenCalled();
  });
});
