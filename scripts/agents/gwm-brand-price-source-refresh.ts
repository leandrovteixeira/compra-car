import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import {
  BrandConnectorAgent,
  extractUniversalPriceCandidates,
  safeConnectorUrl,
  type BrandConnectorResearchProvider,
  type ConnectorSourceEntry,
} from '@compra-car/core/agents';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { AgentPlatformSupabaseAdapter } from '@compra-car/adapter-supabase';
import { PriceAgentSupabaseCatalogReader } from '@compra-car/adapter-supabase/price-agent-context';
import { officialGwmPricePageForTarget } from './gwm-price-sources';

/** Deterministic, QA-only Brand Connector source-map refresh.
 * Reads live official prices as source verification, but does not change
 * canonical pricing or activate the connector.
 */
export async function refreshGwmBrandPriceSources(
  client: ReturnType<typeof createLegacySupabaseClient>,
  log: (line: string) => void = console.log,
): Promise<{ runId: string; verified: number; expected: number; newSources: number }> {
  const connectors = new BrandConnectorSupabaseAdapter(client);
  const active = await connectors.getActiveConnector('GWM','BR');
  if (!active || active.status !== 'ACTIVE') throw new Error('GWM_BRAND_CONNECTOR_ACTIVE_REQUIRED');
  const targets = await new PriceAgentSupabaseCatalogReader(client).readPriceTargets('GWM','BR');
  const expected = [...new Set(targets.map(officialGwmPricePageForTarget).filter((v):v is string=>!!v))];
  if (!expected.length) throw new Error('GWM_PRICE_SOURCE_TARGETS_REQUIRED');
  const allowed = active.allowedDomains;
  for(const url of expected){
    if (safeConnectorUrl(url,allowed)!==url) throw new Error('GWM_PRICE_SOURCE_NOT_OFFICIAL');
  }
  // Concurrent bounded batches; one fetch per distinct dedicated page.
  const verified: { url: string; value: string }[] = [];
  for(let i=0;i<expected.length;i+=4){
    const batch = await Promise.all(expected.slice(i,i+4).map(async url=>{
      try {
        const response=await fetch(url,{
          headers:{'user-agent':'CompraCarBrandConnector/1.0',accept:'text/html'},
          redirect:'follow',signal:AbortSignal.timeout(15000),
        });
        const finalUrl=safeConnectorUrl(response.url,allowed);
        if(!response.ok || !finalUrl || finalUrl!==url) return null;
        const body=await response.text();
        const candidates=extractUniversalPriceCandidates(body)
          .filter(c=>c.method==='HTML_LABEL' && (c.kind==='SINGLE_PRICE'||c.kind==='MSRP'));
        const values=[...new Set(candidates.map(c=>c.amount))];
        return values.length===1 ? {url,value:values[0]!} : null;
      }catch{return null;}
    }));
    verified.push(...batch.filter((item):item is {url:string;value:string}=>item!==null));
  }
  log('GWM_BRAND_SOURCE_VERIFY '+JSON.stringify({
    expected:expected.length,verified:verified.length,
    missing:expected.filter(url=>!verified.some(v=>v.url===url)),
  }));
  if(verified.length!==expected.length)throw new Error('GWM_PRICE_SOURCE_COVERAGE_INCOMPLETE');

  const existing = new Set(active.sourceEntries.map(x=>x.url));
  const additions: ConnectorSourceEntry[] = verified.filter(v=>!existing.has(v.url))
    .map(v=>({
      type:'MODEL_PAGE',url:v.url,priority:1,
      notes:'Official Brazilian per-version model product page with public price',
    }));
  const sourceEntries=[...active.sourceEntries,...additions];
  const provider: BrandConnectorResearchProvider = {
    async researchConnector(){
      return {
        observedBrandLabel:'GWM',canonicalBrand:'GWM',
        aliases:[],
        market:'BR',
        candidateDomains:[...allowed],
        sourceEntries,
        searchHints:[...new Set([...active.searchHints,'preço único','páginas individuais por versão'])],
        terminologyHints:active.terminologyHints,
        confidence:0.99,
        warnings:[],
        evidence: verified.map(item=>({
          url:item.url,
          title:'Official GWM Brazil product page',
          excerpt:'Public single price observed on official page: BRL '+item.value,
        })),
        verificationSummary:'Verified public-price extraction on '+verified.length+
          ' official GWM product pages; proposes '+additions.length+
          ' new source entries. Existing active connector remains unchanged.',
        checksPerformed:[
          'Official HTTPS domain and redirect verification',
          'Per-vehicle commercial price extracted without AI',
          'Complete current QA product coverage',
          'Existing connector URLs preserved',
        ],
        driftDetected:additions.length>0,
      };
    },
  };
  const activeIdentity=await connectors.resolveBrandIdentity('GWM','BR');
  const bundle=await new BrandConnectorAgent(provider).run({
    brand:'GWM',market:'BR',mode:'health-check',activeConnector:active,activeIdentity,
  },undefined,'deterministic');
  await new AgentPlatformSupabaseAdapter(client).persistRunBundle(bundle);
  log('Run: '+bundle.run.id);
  log('GWM_BRAND_SOURCE_PROPOSAL '+JSON.stringify({
    findingType:bundle.findings[0]?.finding.findingType,
    expected:expected.length,verified:verified.length,newSources:additions.length,
    activeConnectorVersion:active.version,
  }));
  return {runId:bundle.run.id,expected:expected.length,verified:verified.length,newSources:additions.length};
}
