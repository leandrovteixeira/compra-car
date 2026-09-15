import { randomUUID } from 'node:crypto';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type { AgentRun, AgentFinding } from '../agent-platform/types';
import { catalogMmvIdentityId } from './catalog-mmv-identity';
import { fixtureActiveConnector } from './brand-connector-fixture';
import { OperationalBrandConnectorResolver } from './brand-connector-resolver';
import type { MmvDiscoveryContext, ModelYearResearchTarget } from './model-year-types';
import type { OfficialBrandSource } from './new-product-check-types';
const definitions = [
  {
    brand: 'VW',
    model: 'Nivus',
    version: 'Highline 1.0 TGDI AT',
    officialVersionLabel: 'Highline 200 TSI',
    domain: 'vw.com.br',
  },
  {
    brand: 'Toyota',
    model: 'Corolla Cross',
    version: 'XRE 2.0 CVT',
    officialVersionLabel: 'XRE 2.0',
    domain: 'toyota.com.br',
  },
  {
    brand: 'Jeep',
    model: 'Commander',
    version: 'Longitude 1.3 TGDI AT',
    officialVersionLabel: 'Longitude T270',
    domain: 'jeep.com.br',
  },
];
/** Synthetic content, never a claim about live manufacturer availability. */
export function modelYearFixture(brand: string) {
  const d = definitions.find((d) => d.brand.toLowerCase() === brand.toLowerCase());
  if (!d) throw new Error('MODEL_YEAR_FIXTURE_NOT_AVAILABLE');
  const rows: AdministrativeVehicle[] = [
    [2024, 2025],
    [2025, 2026],
    [2026, 2026],
  ].map(([py, my], i) => ({
    id: String(i + 1),
    brand: d.brand,
    model: d.model,
    version: d.version,
    productionYear: py!,
    modelYear: my!,
    isActive: true,
    isPublic: true,
  }));
  const time = '2026-09-15T00:00:00.000Z',
    runId = randomUUID();
  const run: AgentRun = {
    id: runId,
    agentType: 'MMV_DISCOVERY',
    status: 'COMPLETED',
    market: 'BR',
    brand: d.brand,
    provider: 'fixture',
    runMode: 'dry-run',
    schemaVersion: '19A.4',
    startedAt: time,
    completedAt: time,
    input: {},
    summary: {},
    configSnapshot: {},
    error: null,
    sourceCommitSha: null,
    createdBy: null,
    createdAt: time,
    updatedAt: time,
  };
  const finding: AgentFinding = {
    id: randomUUID(),
    runId,
    findingType: 'MMV_MATCHED',
    fingerprint: 'synthetic-mmv',
    subjectKey: catalogMmvIdentityId(rows[0]!),
    title: 'Synthetic MMV match',
    summary: null,
    confidence: 0.95,
    requiresReview: false,
    subject: {
      canonicalMmv: [
        {
          id: catalogMmvIdentityId(rows[0]!),
          brand: d.brand,
          model: d.model,
          canonicalVersionLabel: d.version,
        },
      ],
    },
    proposal: null,
    payload: {
      structuredCandidate: {
        brand: d.brand,
        model: d.model,
        officialVersionLabel: d.officialVersionLabel,
        trim: d.officialVersionLabel.split(' ')[0]!,
        powertrainLabel: null,
        engineDisplacement: null,
        engineLabel: null,
        propulsion: 'ICE',
        transmission: 'AT',
        drivetrain: null,
      },
    },
    createdAt: time,
    updatedAt: time,
  };
  const context: MmvDiscoveryContext = {
    run,
    findings: [
      {
        finding,
        latestReview: null,
        evidence: [
          {
            id: randomUUID(),
            findingId: finding.id,
            sourceType: 'MODEL_PAGE',
            sourceUrl: 'https://' + d.domain + '/modelos',
            sourceDomain: d.domain,
            title: 'Synthetic discovery',
            excerpt: d.model + ' ' + d.officialVersionLabel,
            evidenceFingerprint: 'synthetic-evidence',
            metadata: {},
            capturedAt: time,
            createdAt: time,
          },
        ],
      },
    ],
  };
  const active = fixtureActiveConnector({
    brand: d.brand,
    market: 'BR',
    allowedDomains: [d.domain],
    sourceEntries: [{ type: 'MODEL_PAGE', url: 'https://' + d.domain + '/modelos', priority: 1 }],
    searchHints: [d.model + ' ' + d.officialVersionLabel],
    terminologyHints: [],
  });
  const research = {
    async researchModelYears(
      targets: readonly ModelYearResearchTarget[],
      _source?: OfficialBrandSource,
    ) {
      void _source;
      return targets.flatMap((t) =>
        [2026, 2027].map((modelYear) => ({
          targetKey: t.targetKey,
          modelYear,
          confidence: 0.95,
          applicability: 'EXACT_VERSION' as const,
          evidence: [
            {
              url: 'https://' + d.domain + '/modelos',
              title: 'Synthetic MY fixture',
              excerpt:
                d.model +
                ' ' +
                d.officialVersionLabel +
                ' ano/modelo ' +
                (modelYear - 1) +
                '/' +
                modelYear,
              evidenceType: 'MODEL_PAGE' as const,
            },
          ],
        })),
      );
    },
  };
  return {
    rows,
    context,
    active,
    research,
    catalog: {
      async readProducts() {
        return rows;
      },
    },
    discovery: {
      async latestCompleted() {
        return context;
      },
    },
    connectorResolver: new OperationalBrandConnectorResolver({
      async getActiveConnector() {
        return active;
      },
    }),
  };
}
