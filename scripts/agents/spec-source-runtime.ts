import { buildDocumentSource } from './document-intelligence-source';
import {
  selectSourcesForTarget,
  type DocumentIntelligenceProvider,
  type DocumentIntelligenceResult,
  sourceRoles,
  identityLinksFromFacts,
  validateObservedIdentityLink,
  provenEngineChain,
  type ObservedIdentityLink,
  classifySpecLink,
  connectorOfficialSource,
  extractDeterministicSpecs,
  joinSpecApplicability,
  specApplicability,
  specCacheDecision,
  specTargetKey,
  specText,
  validateSemanticSpecs,
  type BrandConnector,
  type SourceSnapshot,
  type SpecObservation,
  type SpecSemanticProvider,
  type SpecSourceTarget,
  type SpecSourceCandidate,
  type SpecDiscoveredLink,
  type SpecDiscoveryProvider,
  type SpecSourceDocument,
  type SpecApplicabilityAssertion,
} from '@compra-car/core/agents';
import { OfficialSpecDocuments } from './spec-source-documents';
import { SpecOfficialFetcher, specOfficialUrl } from './spec-source-fetch';
import { extractSpecDiscoveryLinks } from './spec-source-discovery';
export interface SpecRunOptions {
  maxTargets: number;
  maxSources: number;
  maxSemanticCalls: number;
  maxDiscoveryDepth?: number;
  provider: 'fixture' | 'structured' | 'hybrid';
  mode: 'baseline' | 'monitor';
}
export async function runSpecSources(
  targets: readonly SpecSourceTarget[],
  connector: BrandConnector,
  options: SpecRunOptions,
  fetcher?: SpecOfficialFetcher,
  semantic?: SpecSemanticProvider,
  discovery?: SpecDiscoveryProvider,
  beforeFetch?: (ranking: readonly SpecSourceCandidate[]) => void,
  documentIntelligence?: DocumentIntelligenceProvider,
) {
  const maxDepth = options.maxDiscoveryDepth ?? 2;
  if (
    ![options.maxTargets, options.maxSources].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 10,
    ) ||
    !Number.isInteger(options.maxSemanticCalls) ||
    options.maxSemanticCalls < 0 ||
    options.maxSemanticCalls > 1 ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 2
  )
    throw new Error('INVALID_RUN_LIMITS');
  if (options.provider === 'fixture' && !fetcher) throw new Error('FIXTURE_TRANSPORT_REQUIRED');
  fetcher ??= new SpecOfficialFetcher();
  if (connector.status !== 'ACTIVE') throw new Error('ACTIVE_CONNECTOR_REQUIRED');
  const policy = connectorOfficialSource(connector);
  const blocked = connector.sourceEntries
    .filter((e) => e.type === 'MEDIA_CENTER')
    .map((e) => new URL(e.url).hostname.replace(/^www\./u, ''))
    .filter(
      (host) =>
        !connector.sourceEntries.some(
          (e) =>
            e.type !== 'MEDIA_CENTER' && new URL(e.url).hostname.replace(/^www\./u, '') === host,
        ),
    );
  const keep = (domain: string) => !blocked.some((b) => domain === b || domain.endsWith('.' + b));
  const source = {
      ...policy,
      allowedDomains: policy.allowedDomains.filter(keep),
      allowedHosts: policy.allowedHosts.filter(keep),
      allowedSubdomainRoots: policy.allowedSubdomainRoots?.filter(keep),
    },
    selected = targets.slice(0, options.maxTargets);
  if (selected.some((t) => specText(t.brand) !== specText(connector.brand)))
    throw new Error('CONNECTOR_TARGET_MISMATCH');
  const metrics = {
    documentModelCalls: 0,
    documentCostUsd: 0,
    rawCandidateFacts: 0,
    acceptedObservations: 0,
    rejectedCandidateFacts: 0,
    unresolvedObservations: 0,
    eligibleTargets: targets.length,
    targetsSelected: selected.length,
    targetsResearched: 0,
    sourcesDiscovered: 0,
    sourcesFetched: 0,
    sourcesRejected: 0,
    sourceKinds: {} as Record<string, number>,
    structuredDocumentsProcessed: 0,
    deterministicExtractions: 0,
    semanticCalls: 0,
    discoveryCalls: 0,
    modelSpecificSources: 0,
    applicabilitySources: 0,
    technicalSources: 0,
    observationsExtracted: 0,
    positiveObservations: 0,
    explicitNegativeObservations: 0,
    exactVersionObservations: 0,
    versionMatrixObservations: 0,
    modelSharedObservations: 0,
    unresolvedApplicability: 0,
    snapshotsCreated: 0,
    snapshotsReused: 0,
    rejectionsByReason: {} as Record<string, number>,
  };
  const documentIntelligenceReports: DocumentIntelligenceResult[] = [];
  const observations: SpecObservation[] = [],
    snapshots: SourceSnapshot[] = [],
    graph: SpecSourceCandidate[] = [];
  const rankedBeforeFetch: { attempt: number; candidates: SpecSourceCandidate[] }[] = [];
  const documentSummaries: {
    url: string;
    facts: number;
    sections: number;
    issues: readonly string[];
    accepted?: number;
    rejected?: number;
    pageContext?: unknown;
  }[] = [];
  const qualityDecisions: {
    sourceUrl: string;
    locator: string;
    state: string;
    reason: string;
    fact: unknown;
  }[] = [];
  const identityLinks: ObservedIdentityLink[] = [];
  const pdfAudits: { sourceUrl: string; audit: unknown }[] = [];
  const pdfEvidence = new Map<string, SpecObservation['evidence']>();
  const rejections: { reason: string; targetKey: string; sourceUrl: string | null }[] = [];
  const reject = (reason: string, target: SpecSourceTarget, url: string | null) => {
    rejections.push({ reason, targetKey: specTargetKey(target), sourceUrl: url });
    metrics.rejectionsByReason[reason] = (metrics.rejectionsByReason[reason] ?? 0) + 1;
  };
  let attempts = 0,
    unavailable = false;
  const parser = new OfficialSpecDocuments();
  for (const target of selected) {
    if (unavailable || attempts >= options.maxSources) break;
    const candidates: SpecSourceCandidate[] = [],
      documents: SpecSourceDocument[] = [];
    const add = (
      link: SpecDiscoveredLink,
      parent: SpecSourceCandidate | null,
      seedType?: string,
    ) => {
      const previous = candidates.find((c) => c.url === link.url);
      if (!previous && candidates.length >= 2000) return;
      const candidate = classifySpecLink(link, target, parent, maxDepth);
      if (seedType && candidate.relevanceSignals.includes('TECHNICAL_DOCUMENT')) {
        candidate.score += 20;
        candidate.scoreReasons.push({ reason: 'CONNECTOR_TECHNICAL_SEED', delta: 20 });
      }
      const safe = specOfficialUrl(link.url, source);
      if (!safe) {
        candidate.status = 'REJECTED';
        candidate.rejectionReason = 'SOURCE_URL_NOT_ALLOWED';
      }
      if (seedType === 'MODEL_PAGE' && !candidate.targetBindingSignals.includes('MODEL_NAME')) {
        candidate.status = 'REJECTED';
        candidate.rejectionReason = 'UNRELATED_MODEL_SEED';
      }
      if (seedType === 'MEDIA_CENTER') {
        candidate.status = 'REJECTED';
        candidate.rejectionReason = 'EXCLUDED_SOURCE_PURPOSE';
      }
      if (
        seedType &&
        /\.pdf(?:$|[?#])/iu.test(link.url) &&
        !candidate.targetBindingSignals.includes('MODEL_NAME')
      ) {
        candidate.status = 'REJECTED';
        candidate.rejectionReason = 'UNRELATED_MODEL_SEED';
      }
      if (previous) {
        if (
          candidate.status === 'ACCEPTED' &&
          ['NO_TARGET_RELEVANCE', 'MAX_DISCOVERY_DEPTH'].includes(previous.rejectionReason ?? '')
        )
          Object.assign(previous, candidate);
        return;
      }
      candidates.push(candidate);
      graph.push(candidate);
      metrics.sourcesDiscovered++;
    };
    for (const entry of [...connector.sourceEntries].sort((a, b) => a.priority - b.priority)) {
      add({ url: entry.url, label: entry.type, method: 'CONNECTOR_SEED' }, null, entry.type);
    }
    if (!candidates.some((c) => c.status === 'ACCEPTED')) {
      reject('OFFICIAL_SOURCE_DISCOVERY_GAP', target, null);
      continue;
    }
    metrics.targetsResearched++;
    let first = true;
    for (;;) {
      // First exhaust target-specific links; after two seed reads, reserve one bounded discovery operation for a missing model/technical source.
      if (
        !first &&
        !unavailable &&
        (attempts >= 2 || !candidates.some((c) => c.status === 'ACCEPTED')) &&
        !candidates.some(
          (c) =>
            c.status === 'ACCEPTED' &&
            c.score >= 0 &&
            c.targetBindingSignals.includes('MODEL_NAME'),
        ) &&
        (!candidates.some(
          (c) =>
            c.status === 'FETCHED' &&
            c.targetBindingSignals.includes('MODEL_NAME') &&
            c.sourceKindCandidate === 'OFFICIAL_HTML',
        ) ||
          !candidates.some(
            (c) =>
              c.status === 'FETCHED' &&
              c.targetBindingSignals.includes('MODEL_NAME') &&
              c.relevanceSignals.includes('TECHNICAL_DOCUMENT'),
          )) &&
        options.provider === 'hybrid' &&
        discovery &&
        metrics.semanticCalls < options.maxSemanticCalls &&
        attempts < options.maxSources
      ) {
        metrics.semanticCalls++;
        metrics.discoveryCalls++;
        try {
          for (const link of await discovery.discover(target, source))
            add(
              { ...link, method: 'OFFICIAL_SEARCH' },
              candidates.find((c) => c.status === 'FETCHED') ?? null,
            );
        } catch {
          reject('OFFICIAL_DISCOVERY_FAILED', target, null);
        }
      }
      // Once a literature index was read, do not spend the remaining budget on duplicate generic navigation.
      const indexVisited = candidates.some(
        (c) =>
          c.status === 'FETCHED' &&
          c.relevanceSignals.includes('TECHNICAL_DOCUMENT') &&
          !c.targetBindingSignals.includes('MODEL_NAME') &&
          !/\.pdf(?:$|[?#])/iu.test(c.url),
      );
      if (indexVisited)
        for (const c of candidates) {
          if (
            c.status === 'ACCEPTED' &&
            c.relevanceSignals.includes('TECHNICAL_DOCUMENT') &&
            !c.targetBindingSignals.includes('MODEL_NAME') &&
            !c.scoreReasons.some((r) => r.reason === 'LITERATURE_INDEX_ALREADY_VISITED')
          ) {
            c.scoreReasons.push({ reason: 'LITERATURE_INDEX_ALREADY_VISITED', delta: -120 });
            c.score -= 120;
          }
        }
      const plan = selectSourcesForTarget(candidates, {
        maxSources: options.maxSources - attempts,
        modelYear: target.modelYear,
        coveredRoles: candidates
          .filter((c) => c.status === 'FETCHED')
          .flatMap((c) => c.roles ?? sourceRoles(c)),
      });
      const bootstrap =
        first &&
        !candidates.some(
          (c) =>
            c.status === 'ACCEPTED' &&
            c.targetBindingSignals.includes('MODEL_NAME') &&
            c.scoreReasons.some((r) => r.reason === 'TECHNICAL_SHEET_PRIORITY'),
        );
      const pending = bootstrap
        ? candidates.filter((c) => c.status === 'ACCEPTED')
        : plan.map((p) =>
            Object.assign(
              candidates.find((c) => c.url === p.candidate.url)!,
              { roles: p.candidate.roles, selectionReason: p.reason },
            ),
          );
      const candidate = pending[0];
      if (bootstrap && candidate) candidate.selectionReason = 'CONNECTOR_BOOTSTRAP';
      first = false;
      if (!candidate || attempts >= options.maxSources || unavailable) break;
      const ranking = pending.map((c) => ({ ...c, scoreReasons: [...c.scoreReasons] }));
      rankedBeforeFetch.push({ attempt: attempts + 1, candidates: ranking });
      beforeFetch?.(ranking);
      attempts++;
      try {
        const result = await fetcher.fetch(
          candidate.url,
          source,
          target,
          candidate.sourceKindCandidate,
        );
        candidate.finalUrl = result.snapshot.finalUrl;
        candidate.status = 'FETCHED';
        metrics.sourcesFetched++;
        const prior = snapshots.find(
          (s) =>
            s.finalUrl === result.snapshot.finalUrl && s.targetKey === result.snapshot.targetKey,
        );
        metrics.snapshotsCreated++;
        snapshots.push(result.snapshot);
        if (specCacheDecision(prior, result.snapshot) === 'REUSE') {
          metrics.snapshotsReused++;
          continue;
        }
        metrics.sourceKinds[result.snapshot.sourceKind] =
          (metrics.sourceKinds[result.snapshot.sourceKind] ?? 0) + 1;
        if (candidate.targetBindingSignals.includes('MODEL_NAME')) metrics.modelSpecificSources++;
        if (candidate.sourceKindCandidate === 'OFFICIAL_CONFIGURATOR')
          metrics.applicabilitySources++;
        if (candidate.relevanceSignals.includes('TECHNICAL_DOCUMENT')) metrics.technicalSources++;
        if (options.provider === 'hybrid') {
          const input = await buildDocumentSource(
            result.bytes,
            result.snapshot,
            target,
            candidate.label,
          );
          if (documentIntelligence) {
            const report = await documentIntelligence.extract(input, target);
            documentIntelligenceReports.push(report);
            observations.push(...report.observations);
            if (report.status === 'HUMAN_REVIEW_REQUIRED')
              reject(report.reason ?? 'LOW_EXTRACTION_QUALITY', target, result.snapshot.finalUrl);
          } else reject('DOCUMENT_INTELLIGENCE_REQUIRED', target, result.snapshot.finalUrl);
        } else if (result.snapshot.contentType === 'application/pdf') {
          reject('DOCUMENT_INTELLIGENCE_REQUIRED', target, result.snapshot.finalUrl);
        } else documents.push(parser.parse(result.body, result.snapshot, target));
        if (result.snapshot.contentType.includes('html'))
          for (const link of extractSpecDiscoveryLinks(result.body, result.snapshot.finalUrl))
            add(link, candidate);
      } catch (error) {
        const reason =
          error instanceof Error && /^[A-Z_]+$/u.test(error.message)
            ? error.message
            : 'SOURCE_PROCESSING_FAILED';
        candidate.status = 'REJECTED';
        candidate.rejectionReason = reason;
        metrics.sourcesRejected++;
        reject(reason, target, candidate.url);
        unavailable = reason === 'STRUCTURED_SOURCE_UNAVAILABLE';
      }
    }
    for (const c of candidates.filter((c) => c.status === 'ACCEPTED')) {
      c.status = 'REJECTED';
      c.rejectionReason = unavailable ? 'SOURCE_UNAVAILABLE_STOP' : 'MAX_SOURCES';
    }
    for (const d of documents) {
      identityLinks.push(
        ...identityLinksFromFacts(d.facts, d.snapshot).filter(
          (l) => specText(l.model) === specText(target.model),
        ),
      );
      if (d.audit) pdfAudits.push({ sourceUrl: d.snapshot.finalUrl, audit: d.audit });
      const proof = pdfEvidence.get(d.snapshot.finalUrl);
      if (proof && d.facts[0]) {
        const f = d.facts[0];
        const edge: ObservedIdentityLink = {
          sourceA: proof.sourceUrl,
          sourceB: d.snapshot.finalUrl,
          model: target.model,
          modelYear: target.modelYear,
          from: { kind: 'MODEL', label: target.model },
          to: { kind: 'MODEL_YEAR_DOCUMENT', label: proof.evidenceText },
          evidence: [
            proof,
            {
              sourceUrl: d.snapshot.finalUrl,
              sourceKind: d.snapshot.sourceKind,
              contentHash: d.snapshot.contentHash,
              locator: f.locator,
              evidenceText: f.text,
            },
          ],
        };
        if (validateObservedIdentityLink(edge)) identityLinks.push(edge);
      }
    }
    const assertions: SpecApplicabilityAssertion[] = documents.flatMap((d) =>
      d.facts.flatMap((f) => {
        const a = specApplicability(f.scope, target);
        return typeof a !== 'string' && a.versionBinding === 'EXACT_VERSION' && f.scope.evidenceText
          ? [
              {
                scope: f.scope,
                evidence: {
                  sourceUrl: d.snapshot.finalUrl,
                  sourceKind: d.snapshot.sourceKind,
                  contentHash: d.snapshot.contentHash,
                  locator: f.locator + '/scope',
                  evidenceText: f.scope.evidenceText,
                },
              },
            ]
          : [];
      }),
    );
    for (const document of documents) {
      documentSummaries.push({
        url: document.snapshot.finalUrl,
        facts: document.facts.length,
        sections: document.sections.length,
        issues: document.issues,
        pageContext: document.pageContext,
      });
      metrics.rawCandidateFacts += document.facts.length + (document.rejectedFacts?.length ?? 0);
      for (const rejected of document.rejectedFacts ?? []) {
        qualityDecisions.push({
          sourceUrl: document.snapshot.finalUrl,
          locator: rejected.locator,
          state: 'REJECTED',
          reason: rejected.reason,
          fact: rejected,
        });
        metrics.rejectedCandidateFacts++;
        reject(rejected.reason, target, document.snapshot.finalUrl);
      }
      if (document.facts.length) metrics.structuredDocumentsProcessed++;
      const joinedEvidence = new Map<string, SpecObservation['evidence']>();
      const facts = document.facts.map((f) => {
        if (f.scope.version) return f;
        const chain = provenEngineChain(f.scope, target.officialVersionLabel, identityLinks);
        if (chain) {
          joinedEvidence.set(f.locator, chain[0]!.evidence[0]!);
          return {
            ...f,
            scope: {
              ...f.scope,
              version: target.officialVersionLabel,
              applicabilityEvidence: chain.flatMap((e) => e.evidence),
            },
          };
        }
        const joined = joinSpecApplicability(f.scope, assertions, target);
        if (!joined) return f;
        joinedEvidence.set(f.locator, joined.evidence);
        return { ...f, scope: joined.scope };
      });
      const extracted = extractDeterministicSpecs(target, {
        ...document,
        facts,
        issues: document.issues.filter((r) => !document.rejectedFacts?.some((f) => f.reason === r)),
      });
      for (const d of extracted.qualityDecisions) {
        qualityDecisions.push({
          sourceUrl: document.snapshot.finalUrl,
          locator: d.fact.locator,
          ...d.quality,
          fact: d.fact,
        });
        if (d.quality.state === 'REJECTED') metrics.rejectedCandidateFacts++;
      }
      const summary = documentSummaries[documentSummaries.length - 1]!;
      summary.accepted = extracted.observations.length;
      summary.rejected =
        extracted.qualityDecisions.filter((d) => d.quality.state === 'REJECTED').length +
        (document.rejectedFacts?.length ?? 0);
      metrics.deterministicExtractions += extracted.observations.length;
      extracted.rejections.forEach((r) => reject(r, target, document.snapshot.finalUrl));
      const current = [...extracted.observations];
      const sections = document.sections
        .filter((s) => {
          const a = specApplicability(s.scope, target);
          return typeof a !== 'string';
        })
        .slice(0, 8);
      if (
        !unavailable &&
        !current.length &&
        sections.length &&
        options.provider === 'hybrid' &&
        metrics.semanticCalls < options.maxSemanticCalls &&
        semantic
      ) {
        metrics.semanticCalls++;
        try {
          const input = { target, snapshot: document.snapshot, sections };
          const v = validateSemanticSpecs(input, await semantic.extract(input));
          current.push(...v.observations);
          v.rejections.forEach((r) => reject(r, target, document.snapshot.finalUrl));
        } catch {
          reject('SEMANTIC_EXTRACTION_FAILED', target, document.snapshot.finalUrl);
        }
      }
      for (const o of current) {
        const scope = facts.find((f) => f.locator === o.evidence.locator)?.scope;
        const extra = joinedEvidence.get(o.evidence.locator);
        const pdfProof = pdfEvidence.get(o.evidence.sourceUrl);
        const applicabilityEvidence = [
          o.evidence,
          ...(pdfProof ? [pdfProof] : []),
          ...(scope?.applicabilityEvidence ?? []),
          ...(!pdfProof && scope?.evidenceText
            ? [
                {
                  ...o.evidence,
                  locator: o.evidence.locator + '/scope',
                  evidenceText: scope.evidenceText,
                },
              ]
            : []),
          ...(extra ? [extra] : []),
        ];
        const observation = { ...o, factEvidence: [o.evidence], applicabilityEvidence };
        if (
          observations.some(
            (p) =>
              JSON.stringify([p.target, p.observation, p.evidence]) ===
              JSON.stringify([o.target, o.observation, o.evidence]),
          )
        )
          reject('DUPLICATE', target, document.snapshot.finalUrl);
        else observations.push(observation);
      }
      if (!current.length && !extracted.rejections.length)
        reject('NO_BOUND_TECHNICAL_FACTS', target, document.snapshot.finalUrl);
    }
  }
  metrics.documentModelCalls = documentIntelligenceReports.reduce(
    (n, r) => n + r.requests.length,
    0,
  );
  metrics.documentCostUsd = documentIntelligenceReports.reduce((n, r) => n + r.totalCostUsd, 0);
  metrics.observationsExtracted = observations.length;
  metrics.acceptedObservations = observations.length;
  for (const o of observations) {
    if (o.observation.polarity === 'POSITIVE') metrics.positiveObservations++;
    else metrics.explicitNegativeObservations++;
    if (o.applicability.versionBinding === 'EXACT_VERSION') metrics.exactVersionObservations++;
    if (o.applicability.versionBinding === 'VERSION_MATRIX') metrics.versionMatrixObservations++;
    if (o.applicability.versionBinding === 'MODEL_SHARED') metrics.modelSharedObservations++;
    if (
      o.applicability.versionBinding === 'UNRESOLVED' ||
      o.applicability.yearBinding === 'UNRESOLVED'
    )
      metrics.unresolvedApplicability++;
  }
  metrics.unresolvedObservations = metrics.unresolvedApplicability;
  return {
    documentIntelligenceReports,
    identityLinks,
    qualityDecisions,
    pdfAudits,
    mode: options.mode,
    provider: options.provider,
    targets: selected,
    metrics,
    snapshots,
    observations,
    rejections,
    discoveryGraph: graph,
    rankedBeforeFetch,
    documentSummaries,
    http: fetcher.audit,
    stoppedUnavailable: unavailable,
  };
}
