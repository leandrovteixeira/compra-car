import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { readLegacySnapshot, validateLocalDatabaseUrl } from './database.js';
import { writeReports } from './reports.js';
import { runDryRun } from './runner.js';
import type { DryRunOptions, SourceSnapshot } from './types.js';

interface CliArguments {
  databaseUrl: string | null;
  fixturePath: string | null;
  outputDirectory: string;
  algorithmVersion: string;
  cutoffDate: string | null;
  insurancePercentage: string | null;
  expectedLocalPort: number;
  verbose: boolean;
  failOnSourceChange: boolean;
  excludeExecutedAtFromHash: boolean;
}

function usage(): string {
  return `Usage:
  pnpm pricing:dry-run -- --database-url <local-url> --output-dir <directory> [options]
  pnpm pricing:dry-run -- --fixture <snapshot.json> --output-dir <directory> [options]

Options:
  --algorithm-version <version>       Default: 1.0.0
  --cutoff-date <YYYY-MM-DD>          Optional source cutoff
  --insurance-percentage <decimal>    Explicit simulation premise only
  --expected-local-port <port>        Default: 54322
  --fail-on-source-change             Exit 2 after reports when baseline changed
  --exclude-executed-at-from-hash     Stable comparison hash across executions
  --verbose                           Print sanitized progress
`;
}

function takeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArguments(args: string[], environment: NodeJS.ProcessEnv): CliArguments {
  let databaseUrl: string | null = environment.DATABASE_URL ?? null;
  let fixturePath: string | null = null;
  let outputDirectory: string | null = null;
  let algorithmVersion = '1.0.0';
  let cutoffDate: string | null = null;
  let insurancePercentage: string | null = null;
  let expectedLocalPort = 54322;
  let verbose = false;
  let failOnSourceChange = false;
  let excludeExecutedAtFromHash = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    switch (argument) {
      case '--database-url':
        databaseUrl = takeValue(args, index, argument);
        index += 1;
        break;
      case '--fixture':
        fixturePath = takeValue(args, index, argument);
        index += 1;
        break;
      case '--output-dir':
        outputDirectory = takeValue(args, index, argument);
        index += 1;
        break;
      case '--algorithm-version':
        algorithmVersion = takeValue(args, index, argument);
        index += 1;
        break;
      case '--cutoff-date':
        cutoffDate = takeValue(args, index, argument);
        index += 1;
        break;
      case '--insurance-percentage':
        insurancePercentage = takeValue(args, index, argument);
        index += 1;
        break;
      case '--expected-local-port':
        expectedLocalPort = Number(takeValue(args, index, argument));
        index += 1;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--fail-on-source-change':
        failOnSourceChange = true;
        break;
      case '--exclude-executed-at-from-hash':
        excludeExecutedAtFromHash = true;
        break;
      case '--help':
        process.stdout.write(usage());
        throw new Error('HELP_REQUESTED');
      default:
        throw new Error(`Unknown argument: ${argument ?? ''}`);
    }
  }

  if (outputDirectory === null) throw new Error('--output-dir is required');
  if ((databaseUrl === null) === (fixturePath === null)) {
    throw new Error('Provide exactly one local DATABASE_URL or --fixture');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(cutoffDate ?? '2000-01-01')) {
    throw new Error('--cutoff-date must use YYYY-MM-DD');
  }
  if (!Number.isInteger(expectedLocalPort) || expectedLocalPort <= 0) {
    throw new Error('--expected-local-port must be a positive integer');
  }

  return {
    databaseUrl,
    fixturePath,
    outputDirectory,
    algorithmVersion,
    cutoffDate,
    insurancePercentage,
    expectedLocalPort,
    verbose,
    failOnSourceChange,
    excludeExecutedAtFromHash,
  };
}

async function readFixture(fixturePath: string): Promise<SourceSnapshot> {
  const content = await readFile(path.resolve(fixturePath), 'utf8');
  const parsed = JSON.parse(content) as Partial<SourceSnapshot>;
  if (!Array.isArray(parsed.offers) || !Array.isArray(parsed.products)) {
    throw new Error('Fixture must contain offers and products arrays');
  }
  return parsed as SourceSnapshot;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(postgres(?:ql)?:\/\/[^:/'"]+:)[^@/'"]+@/giu, '$1***@');
}

async function main(): Promise<void> {
  let args: CliArguments;
  try {
    args = parseArguments(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof Error && error.message === 'HELP_REQUESTED') return;
    throw error;
  }

  const executedAt = new Date().toISOString();
  const options: DryRunOptions = {
    algorithmVersion: args.algorithmVersion,
    cutoffDate: args.cutoffDate,
    insurancePercentage: args.insurancePercentage,
    executedAt,
    excludeExecutedAtFromHash: args.excludeExecutedAtFromHash,
    failOnSourceChange: args.failOnSourceChange,
  };
  const snapshot = args.fixturePath
    ? await readFixture(args.fixturePath)
    : await readLegacySnapshot(
        validateLocalDatabaseUrl(args.databaseUrl ?? '', args.expectedLocalPort),
        args.cutoffDate,
      );
  const result = runDryRun(snapshot, options);
  const outputDirectory = await writeReports(args.outputDirectory, result, options);

  process.stdout.write(`Pricing legacy dry-run completed: ${outputDirectory}\n`);
  if (args.verbose) {
    process.stdout.write(`Source: ${snapshot.databaseIdentity}\n`);
    process.stdout.write(`Status: ${String(result.summary.overallStatus)}\n`);
    process.stdout.write(`Needs review: ${result.needsReview.length}\n`);
  }
  if (args.failOnSourceChange && result.baselineDifferences.length > 0) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`Pricing legacy dry-run failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
});
