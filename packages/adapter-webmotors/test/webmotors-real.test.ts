import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { parseWebmotorsYears, parseWebmotorsRows, type HtmlParser } from '../src';
import { groupModelYearTargets, matchStructuredRows } from '@compra-car/core/agents';
import { mmvDiscoveryNivusTargets as targets } from '../../core/test/fixtures/model-year-mmv-discovery';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const parse = (require('next/dist/compiled/node-html-parser') as { parse: HtmlParser }).parse;
const root = 'https://www.webmotors.com.br/tabela-fipe/carros/volkswagen/nivus';
const rootHtml = readFileSync(
  new URL('./fixtures/nivus-root-real-minimal.html', import.meta.url),
  'utf8',
);
const yearHtml = readFileSync(
  new URL('./fixtures/nivus-2027-real-minimal.html', import.meta.url),
  'utf8',
);
const group = groupModelYearTargets(targets)[0]!;
it('extracts real year cards with a separate price subtitle', () =>
  expect(parseWebmotorsYears(rootHtml, root, parse)).toEqual([
    2027, 2026, 2025, 2024, 2023, 2022, 2021,
  ]));
it('does not infer MY from URL when card title disagrees', () =>
  expect(
    parseWebmotorsYears(
      '<a href="' + root + '/2027"><h3 data-testid="card-title">2026</h3><h3>Preço 2027</h3></a>',
      root,
      parse,
    ),
  ).toEqual([]));
it('does not accept a price/subtitle as the year title', () =>
  expect(
    parseWebmotorsYears(
      '<a href="' +
        root +
        '/2027"><h3 data-testid="card-subtitle">2027</h3><span>Preços</span></a>',
      root,
      parse,
    ),
  ).toEqual([]));
it('recovers real full version labels and all four FIPE codes', () => {
  const rows = parseWebmotorsRows(yearHtml, root + '/2027', group, 2027, parse);
  expect(rows.map((r) => r.fipeCode)).toEqual(['005525-5', '005526-3', '005548-4', '005553-0']);
  expect(
    rows.every(
      (r) => r.versionLabel.startsWith('Volkswagen Nivus ') && r.versionLabel.endsWith(' 2027'),
    ),
  ).toBe(true);
});
it('real table produces four unique MMV matches without rejections', () => {
  const result = matchStructuredRows(
    group,
    parseWebmotorsRows(yearHtml, root + '/2027', group, 2027, parse),
  );
  expect(result.rejections).toEqual([]);
  expect(result.observations).toHaveLength(4);
  for (const t of targets)
    expect(result.observations.filter((o) => o.targetKey === t.targetKey)).toHaveLength(1);
});
