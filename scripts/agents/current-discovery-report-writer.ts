import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CurrentMmvDiscoverySnapshot, OfficialProductCandidate } from '@compra-car/core/agents';
import { redactSecrets } from './report-writer';

const cell = (value: unknown) =>
  String(value ?? '—')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/\|/gu, '&#124;')
    .replace(/[\r\n]/gu, ' ');

function identity(candidate: OfficialProductCandidate): string {
  return [candidate.brand, candidate.model, candidate.officialVersionLabel ?? candidate.trim]
    .filter(Boolean)
    .join(' ');
}

export function renderCurrentDiscoveryMarkdown(result: CurrentMmvDiscoverySnapshot): string {
  return [
    '# MMV Current Discovery Snapshot — READ-ONLY',
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
    '| Rejected | ' + result.rejectedCandidates.length + ' |',
    '| Rejected external sources | ' + result.rejectedExternalSources + ' |',
    '',
    '## Body/model review proposals',
    '',
    ...(result.bodyModelProposals.length
      ? result.bodyModelProposals.flatMap((proposal) => [
          '- ' + cell(proposal.currentModel) + ' + ' + cell(proposal.bodyStyle) + ' → ' + cell(proposal.proposedModel) + ' (' + proposal.reasonCode + ')',
        ])
      : ['- None']),
    '',
    '## Current discovered candidates',
    '',
    ...result.candidates.flatMap((candidate) => [
      '### ' + cell(identity(candidate)),
      '',
      '| Attribute | Discovered value |',
      '| --- | --- |',
      '| Model | ' + cell(candidate.model) + ' |',
      '| Body style | ' + cell(candidate.bodyStyle ?? null) + ' |',
      '| Official version | ' + cell(candidate.officialVersionLabel) + ' |',
      '| Trim | ' + cell(candidate.trim) + ' |',
      '| Taxonomy | ' + cell(candidate.taxonomy) + ' |',
      '| Powertrain | ' + cell(candidate.powertrainLabel) + ' |',
      '| Propulsion | ' + cell(candidate.propulsion) + ' |',
      '| Engine displacement | ' + cell(candidate.engineDisplacement) + ' |',
      '| Engine label | ' + cell(candidate.engineLabel) + ' |',
      '| Transmission | ' + cell(candidate.transmission) + ' |',
      '| Drivetrain | ' + cell(candidate.drivetrain) + ' |',
      '| Confidence | ' + candidate.confidence.toFixed(2) + ' |',
      '| Warnings | ' + cell((candidate.extractionWarnings ?? []).join(', ') || null) + ' |',
      '',
      'Evidence:',
      '',
      ...candidate.evidence.map(
        (evidence) =>
          '- ' +
          [
            evidence.evidenceType ?? 'official',
            evidence.url,
            evidence.title,
            evidence.excerpt,
          ]
            .filter(Boolean)
            .map(cell)
            .join(' — '),
      ),
      '',
    ]),
    'This snapshot is independent of the legacy Compra-Car catalog.',
    'No match, merge, canonical creation, rename or deactivation is executed.',
    '',
  ].join('\n');
}

export class LocalCurrentDiscoveryReportWriter {
  constructor(
    private readonly repositoryRoot: string,
    private readonly secrets: readonly string[] = [],
  ) {}

  async write(result: CurrentMmvDiscoverySnapshot): Promise<void> {
    if (!/^[a-zA-Z0-9-]{1,100}$/u.test(result.runId)) throw new Error('INVALID_RUN_ID');
    const directory = resolve(this.repositoryRoot, '.local-reports/agents/mmv-current-discovery');
    const safe = JSON.parse(
      redactSecrets(JSON.stringify(result), this.secrets),
    ) as CurrentMmvDiscoverySnapshot;

    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, result.runId + '.json'),
      JSON.stringify(safe, null, 2) + '\n',
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    await writeFile(
      resolve(directory, result.runId + '.md'),
      renderCurrentDiscoveryMarkdown(safe),
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
  }
}
