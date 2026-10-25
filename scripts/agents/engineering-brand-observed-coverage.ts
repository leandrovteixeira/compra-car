import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { SourceCaptureManifest } from './engineering-source-capture';

export interface BrandObservedCoverage {
  readonly schemaVersion: 'engineering-brand-observed-v1';
  readonly independentlyReviewed: false;
  readonly observations: readonly {
    readonly brand: string;
    readonly sourceUrl: string;
    readonly sourceHash: string;
    readonly expectedLabel: string;
    readonly found: boolean;
  }[];
  readonly missingLabels: number;
}
/** Checks presence of text in frozen source bytes, NOT canonical vehicle identity. */
export async function observeBrandCaptureLabels(
  manifestPath: string,
  inventoryPath: string,
): Promise<BrandObservedCoverage> {
  const capture = JSON.parse(await readFile(manifestPath, 'utf8')) as SourceCaptureManifest;
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as {
    brands: { brand: string; urls: { url: string; modelLabelsObserved: string[] }[] }[];
  };
  if (capture.schemaVersion !== 'engineering-source-capture-v1' ||
      capture.independentlyReviewed !== false ||
      !Array.isArray(capture.captures) || !Array.isArray(inventory.brands)) {
    throw new Error('ENGINEERING_INVALID_OBSERVATION_INPUT');
  }
  const observations: BrandObservedCoverage['observations'][number][] = [];
  for (const brand of inventory.brands) {
    for (const source of brand.urls) {
      const item = capture.captures.find(c => c.brand === brand.brand && c.sourceUrl === source.url);
      if (!item) throw new Error('ENGINEERING_CAPTURE_INCOMPLETE');
      const html = (await readFile(join(dirname(manifestPath), 'snapshots',
        item.contentSha256 + '.html'))).toString('utf8').toLocaleLowerCase('pt-BR');
      for (const label of source.modelLabelsObserved) {
        observations.push({
          brand: brand.brand, sourceUrl: source.url, sourceHash: item.contentSha256,
          expectedLabel: label,
          found: html.includes(label.toLocaleLowerCase('pt-BR')),
        });
      }
    }
  }
  return {
    schemaVersion: 'engineering-brand-observed-v1',
    independentlyReviewed: false,
    observations,
    missingLabels: observations.filter(o => !o.found).length,
  };
}
export async function saveBrandCaptureObservations(manifestPath: string, inventoryPath: string) {
  const result = await observeBrandCaptureLabels(manifestPath, inventoryPath);
  await writeFile(join(dirname(manifestPath), 'observed-coverage.json'),
    JSON.stringify(result, null, 2) + '\n');
  return result;
}
