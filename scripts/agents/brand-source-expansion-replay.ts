import { randomUUID } from 'node:crypto';
import {
  BrandConnectorAgent,
  validateConnectorDefinition,
  type BrandConnectorResearch,
  type BrandConnectorResearchProvider,
} from '@compra-car/core/agents';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { AgentPlatformSupabaseAdapter, createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { expandBrandProductSources } from './brand-product-source-expansion';

/** QA-only replay: reuse an already-paid Brand discovery, then expand URL
 * coverage with deterministic HTTP requests. No OpenAI or active activation.
 */
export async function replayBrandProductSourceExpansion(
  client: ReturnType<typeof createLegacySupabaseClient>,
  sourceRunId: string,
  expectedBrand: string,
  log: (line: string) => void = console.log,
): Promise<{ runId: string; verified: number; added: number }> {
  if (!/^[0-9a-f-]{36}$/iu.test(sourceRunId)) throw new Error('BRAND_REPLAY_INVALID_RUN_ID');
  const { data: run, error: runError } = await client.from('agent_runs')
    .select('id,brand,market,agent_type,status').eq('id',sourceRunId).single();
  const { data: findings, error: findingError } = await client.from('agent_findings')
    .select('id,finding_type,proposal,payload,summary,confidence')
    .eq('run_id',sourceRunId).limit(2);
  if (runError || findingError || !run ||
    run.agent_type !== 'BRAND_CONNECTOR' || run.status !== 'COMPLETED' ||
    run.market !== 'BR' || run.brand !== expectedBrand || findings?.length !== 1 ||
    !['NEW_BRAND_CONNECTOR','CONNECTOR_DRIFT'].includes(findings[0]!.finding_type))
    throw new Error('BRAND_REPLAY_PARENT_INVALID');
  const finding = findings[0]!;
  const definition = validateConnectorDefinition(finding.proposal);
  if (definition.brand !== run.brand || definition.market !== 'BR')
    throw new Error('BRAND_REPLAY_SCOPE_MISMATCH');
  const { data: evidence, error: evidenceError } = await client.from('agent_evidence')
    .select('source_url,title,excerpt').eq('finding_id',finding.id).limit(100);
  if (evidenceError || !evidence?.length) throw new Error('BRAND_REPLAY_EVIDENCE_MISSING');

  const repository = new BrandConnectorSupabaseAdapter(client);
  const active = await repository.getActiveConnector(run.brand,'BR');
  // A missing active connector is the expected "brand from zero" pilot.
  const input = { brand:run.brand, market:'BR', mode:active ? 'health-check' as const
    : 'discover' as const, ...(active ? {activeConnector:active} : {}),
    activeIdentity: await repository.resolveBrandIdentity(run.brand,'BR'),
  };
  const payload = finding.payload as Record<string,unknown>;
  const researched: BrandConnectorResearch = {
    observedBrandLabel:String(payload.observedBrandLabel??run.brand),
    canonicalBrand:String(payload.canonicalBrand??run.brand),
    aliases:Array.isArray(payload.aliases) ? payload.aliases as BrandConnectorResearch['aliases'] : [],
    market:'BR',
    candidateDomains:definition.allowedDomains,
    sourceEntries:definition.sourceEntries,
    searchHints:definition.searchHints,
    terminologyHints:definition.terminologyHints,
    confidence:Number(finding.confidence),
    warnings:Array.isArray(payload.warnings) ? payload.warnings as string[] : [],
    evidence:evidence.map(e=>({
      url:e.source_url as string,
      title:(e.title as string | null)??'Official source',
      excerpt:(e.excerpt as string | null)??'Official domain evidence',
    })),
    verificationSummary:String(finding.summary??'Official brand source map.'),
    checksPerformed:Array.isArray(payload.checksPerformed)
      ? payload.checksPerformed as string[] : [],
    driftDetected:false,
  };
  const expanded=await expandBrandProductSources(input,researched);
  const provider:BrandConnectorResearchProvider={
    researchConnector:async()=>expanded.research,
  };
  const bundle=await new BrandConnectorAgent(provider).run(input,randomUUID(),'deterministic-expansion');
  const enrichedBundle={...bundle,
    run:{...bundle.run,input:{...bundle.run.input,sourceBrandRunId:sourceRunId}},
  };
  await new AgentPlatformSupabaseAdapter(client).persistRunBundle(enrichedBundle);
  log('Run: '+bundle.run.id);
  log('BRAND_SOURCE_EXPANSION '+JSON.stringify(expanded.report));
  return {
    runId:bundle.run.id,
    verified:expanded.report.productPagesVerified,
    added:expanded.report.addedProductPages,
  };
}
