import type { AgentPlatformRepository, AgentRun } from '../agent-platform/types';

export interface PriceModelYearSelection {
  readonly runId: string;
  readonly pairs: readonly {
    readonly mmvIdentity: string;
    readonly modelYear: number;
  }[];
}

export interface PriceModelYearSelectionReader {
  latestCompleted(brand: string, market: string): Promise<PriceModelYearSelection | null>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function year(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999
    ? value
    : null;
}

/**
 * Price target selection reuses the latest completed Model Year run.
 * MODEL_YEAR_MATCHED is operational confirmation.
 * NEW_MODEL_YEAR is eligible only after ACCEPT review.
 */
export class PlatformPriceModelYearSelectionReader implements PriceModelYearSelectionReader {
  constructor(
    private readonly repository: Pick<
      AgentPlatformRepository,
      'listRuns' | 'getRun' | 'getLatestReview'
    >,
  ) {}

  async latestCompleted(brand: string, market: string): Promise<PriceModelYearSelection | null> {
    let latest: AgentRun | undefined;
    for (let offset = 0; ; offset += 100) {
      const page = await this.repository.listRuns({
        agentType: 'MODEL_YEAR',
        offset,
        limit: 100,
      });
      for (const { run } of page.items) {
        if (
          run.agentType !== 'MODEL_YEAR' ||
          run.status !== 'COMPLETED' ||
          run.market !== market ||
          run.brand?.toLowerCase() !== brand.toLowerCase()
        )
          continue;
        if (
          !latest ||
          Date.parse(run.completedAt!) > Date.parse(latest.completedAt!) ||
          (run.completedAt === latest.completedAt && run.id < latest.id)
        )
          latest = run;
      }
      if (offset + page.items.length >= page.total || !page.items.length) break;
    }

    if (!latest) return null;
    const bundle = await this.repository.getRun(latest.id);
    if (!bundle || bundle.run.status !== 'COMPLETED') return null;

    const pairs = new Map<string, { mmvIdentity: string; modelYear: number }>();

    for (const item of bundle.findings) {
      const finding = item.finding;
      if (!['MODEL_YEAR_MATCHED', 'NEW_MODEL_YEAR'].includes(finding.findingType)) continue;

      if (finding.findingType === 'NEW_MODEL_YEAR') {
        const review = await this.repository.getLatestReview(finding.id);
        if (review?.decision !== 'ACCEPT') continue;
      } else {
        const review = await this.repository.getLatestReview(finding.id);
        if (review && ['REJECT', 'DEFER'].includes(review.decision)) continue;
      }

      const mmvIdentity = text(finding.subject.mmvIdentity);
      const modelYear =
        year(finding.subject.modelYear) ??
        year(finding.payload.modelYear) ??
        year(finding.proposal?.modelYear);

      if (!mmvIdentity || modelYear === null) continue;
      pairs.set(mmvIdentity + '|' + modelYear, { mmvIdentity, modelYear });
    }

    return { runId: bundle.run.id, pairs: [...pairs.values()] };
  }
}
