import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  NewProductCheckResult,
  OfficialProductCandidate,
  MatchedProductCandidate,
  NewProductFinding,
  ReportWriter,
} from '@compra-car/core/agents';

export function redactSecrets(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const form of new Set([
      secret,
      JSON.stringify(secret).slice(1, -1),
      encodeURIComponent(secret),
    ]))
      result = result.split(form).join('[REDACTED]');
  }
  return result;
}
const cell = (value: unknown) =>
  String(value ?? '—')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/\|/gu, '&#124;')
    .replace(/[\r\n]/gu, ' ')
    .replace(/\[/gu, '&#91;')
    .replace(/\]/gu, '&#93;');
function identity(candidate: OfficialProductCandidate): string {
  return [candidate.brand, candidate.model, candidate.officialVersionLabel ?? candidate.trim]
    .filter(Boolean)
    .join(' ');
}
function details(item: MatchedProductCandidate | NewProductFinding): string {
  const c = item.candidate;
  return [
    '### ' + cell(identity(c)),
    '',
    '| Attribute | Official value |',
    '| --- | --- |',
    ...(
      [
        ['Finding type', 'type' in item ? item.type : 'MATCHED'],
        ['Model', c.model],
        ['Official version', c.officialVersionLabel],
        ['Trim', c.trim],
        ['Taxonomy', c.taxonomy],
        ['Powertrain', c.powertrainLabel],
        [
          'Engine',
          [c.engineLabel, c.engineDisplacement === null ? null : c.engineDisplacement + ' L']
            .filter(Boolean)
            .join(' ') || null,
        ],
        ['Propulsion', c.propulsion],
        ['Transmission', c.transmission],
        ['Drivetrain', c.drivetrain],
        ['PY/MY', String(c.productionYear ?? '—') + '/' + String(c.modelYear ?? '—')],
        ['Match mode', item.matchMode],
        ['Confidence', c.confidence.toFixed(2)],
        [
          'Warnings',
          ('warnings' in item ? item.warnings : (c.extractionWarnings ?? [])).join(', ') || null,
        ],
        ['Reason', item.reason],
      ] as const
    ).map(([label, value]) => '| ' + label + ' | ' + cell(value) + ' |'),
    '',
    'Canonical correspondences' +
      ('type' in item && item.type === 'AMBIGUOUS'
        ? ' (review options, not confirmed matches)'
        : '') +
      ':',
    '',
    ...(item.matchedProducts.length
      ? item.matchedProducts.map(
          (p) =>
            '- ' +
            cell(
              p.id +
                ': ' +
                p.brand +
                ' ' +
                p.model +
                ' / ' +
                p.version +
                ' / ' +
                p.productionYear +
                '/' +
                p.modelYear,
            ),
        )
      : ['- None']),
    '',
    'Evidence:',
    '',
    ...c.evidence.map(
      (e) =>
        '- ' +
        cell(e.evidenceType ?? 'official') +
        ': ' +
        cell(e.url) +
        (e.title ? ' — ' + cell(e.title) : '') +
        (e.excerpt ? ' — ' + cell(e.excerpt) : ''),
    ),
    '',
  ].join('\n');
}

function modelDetails(item: NewProductFinding): string {
  return [
    '### ' + cell(identity(item.candidate)),
    '',
    'Confidence: ' + item.candidate.confidence.toFixed(2),
    '',
    'Warnings: ' + cell(item.warnings.join(', ') || null),
    '',
    'Resolved official variants (unresolved observations retain their warnings):',
    '',
    '| Official version | Trim | Powertrain | Engine (L) | Propulsion | Transmission | Drivetrain | PY/MY | Confidence | Warnings |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...item.variants.map(
      (c) =>
        '| ' +
        [
          c.officialVersionLabel,
          c.trim,
          c.powertrainLabel,
          c.engineDisplacement,
          c.propulsion,
          c.transmission,
          c.drivetrain,
          String(c.productionYear ?? '—') + '/' + String(c.modelYear ?? '—'),
          c.confidence.toFixed(2),
          (c.extractionWarnings ?? []).join(', ') || null,
        ]
          .map(cell)
          .join(' | ') +
        ' |',
    ),
    '',
    'Evidence:',
    '',
    ...item.candidate.evidence.map(
      (e) =>
        '- ' + [e.evidenceType, e.url, e.title, e.excerpt].filter(Boolean).map(cell).join(' — '),
    ),
    '',
  ].join('\n');
}
export function renderMarkdownReport(result: NewProductCheckResult): string {
  return [
    '# New Product Check Agent — READ-ONLY dry run',
    '',
    'Run: ' + cell(result.runId),
    'Brand: ' + cell(result.brand),
    'Market: ' + result.market,
    'Provider: ' + cell(result.researchMetadata.provider),
    'Schema: ' + result.schemaVersion,
    'Started: ' + cell(result.startedAt),
    'Completed: ' + cell(result.completedAt),
    '',
    '| State | Count |',
    '| --- | --- |',
    '| Models discovered | ' + result.modelsDiscovered + ' |',
    '| Variants resolved | ' + result.variantsResolved + ' |',
    '| Candidates researched | ' + result.researchedCandidates + ' |',
    '| Candidates accepted (deduplicated) | ' + result.acceptedCandidates + ' |',
    '| Known canonical products | ' + result.knownProducts + ' |',
    '| Matched exact | ' +
      result.matchedCandidates.filter((m) => m.matchMode === 'EXACT_OFFICIAL').length +
      ' |',
    '| Matched legacy naming | ' +
      result.matchedCandidates.filter((m) => m.matchMode === 'LEGACY_NAMING').length +
      ' |',
    ...(['NEW_MODEL', 'NEW_VERSION', 'POSSIBLE_YEAR_CHANGE', 'AMBIGUOUS'] as const).map(
      (type) => '| ' + type + ' | ' + result.findings.filter((f) => f.type === type).length + ' |',
    ),
    '| Rejected | ' + result.rejectedCandidates.length + ' |',
    '| Rejected external sources | ' + result.rejectedExternalSources + ' |',
    '',
    '## Matches',
    '',
    ...result.matchedCandidates.map(details),
    '',
    '## New models',
    '',
    ...result.findings.filter((f) => f.type === 'NEW_MODEL').map(modelDetails),
    '',
    '## New versions',
    '',
    ...result.findings.filter((f) => f.type === 'NEW_VERSION').map(details),
    '',
    '## Possible year changes',
    '',
    ...result.findings.filter((f) => f.type === 'POSSIBLE_YEAR_CHANGE').map(details),
    '',
    '## Ambiguous — manual review',
    '',
    ...result.findings.filter((f) => f.type === 'AMBIGUOUS').map(details),
    '',
    'Official naming is authoritative. Historical canonical labels are displayed unchanged for compatibility review.',
    'No canonical data is written or renamed. Fixture runs are synthetic, not claims about current availability.',
    '',
  ].join('\n');
}
export class LocalProductReportWriter implements ReportWriter {
  constructor(
    private readonly repositoryRoot: string,
    private readonly secrets: readonly string[] = [],
  ) {}
  async write(result: NewProductCheckResult): Promise<void> {
    if (!/^[a-zA-Z0-9-]{1,100}$/u.test(result.runId)) throw new Error('INVALID_RUN_ID');
    const directory = resolve(this.repositoryRoot, '.local-reports/agents/new-product-check');
    const safe = JSON.parse(
      redactSecrets(JSON.stringify(result), this.secrets),
    ) as NewProductCheckResult;
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, result.runId + '.json'),
      JSON.stringify(safe, null, 2) + '\n',
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    await writeFile(resolve(directory, result.runId + '.md'), renderMarkdownReport(safe), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  }
}
