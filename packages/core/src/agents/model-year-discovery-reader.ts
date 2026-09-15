import type { AgentPlatformRepository, AgentRun } from '../agent-platform/types';
import type { AgentMarketScope } from './new-product-check-types';
import type { MmvDiscoveryReader } from './model-year-types';
/** Reuses the operational read port; never knows table names or gains write capabilities. */
export class PlatformMmvDiscoveryReader implements MmvDiscoveryReader {
  constructor(
    private readonly repository: Pick<
      AgentPlatformRepository,
      'listRuns' | 'getRun' | 'getLatestReview'
    >,
  ) {}
  async latestCompleted(scope: AgentMarketScope) {
    let latest: AgentRun | undefined;
    for (let offset = 0; ; offset += 100) {
      const page = await this.repository.listRuns({
        agentType: 'MMV_DISCOVERY',
        offset,
        limit: 100,
      });
      for (const { run } of page.items) {
        if (
          run.agentType !== 'MMV_DISCOVERY' ||
          run.status !== 'COMPLETED' ||
          run.market !== scope.country ||
          run.brand?.toLocaleLowerCase() !== scope.brand.toLocaleLowerCase()
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
    const findings = [];
    for (const item of bundle.findings)
      findings.push({
        ...item,
        latestReview: await this.repository.getLatestReview(item.finding.id),
      });
    return { run: bundle.run, findings };
  }
}
