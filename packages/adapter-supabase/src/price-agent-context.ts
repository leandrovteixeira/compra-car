import type { SupabaseClient } from '@supabase/supabase-js';
import {
  catalogMmvIdentityId,
  type PriceCatalogReader,
  type PriceModelYearSelectionReader,
  type PriceTarget,
  type PriceIdentityMapping,
  type PriceSourceSnapshot,
  type PriceAiUsage,
} from '@compra-car/core/agents';

type ProductRow = {
  id: number;
  brand: string;
  model: string;
  version: string;
  model_year: number;
  is_active: boolean;
};

type CurrentPriceRow = {
  id: number;
  product_id: number;
  amount: string | number;
  currency_code: string;
  starts_on: string;
};

type PriceAliasRow = {
  product_id: number;
  observed_label: string;
  source_url: string;
  source_fingerprint: string | null;
  confidence: string | number;
};

type KnownPriceReconciliation = {
  observedLabel: string;
  sourceUrl: string;
  sourceFingerprint: string | null;
  confidence: number;
};

export class PriceAgentSupabaseCatalogReader implements PriceCatalogReader {
  constructor(
    private readonly client: SupabaseClient,
    private readonly selection?: PriceModelYearSelectionReader,
  ) {}

  async readPriceTargets(brand: string, market: string): Promise<readonly PriceTarget[]> {
    if (market !== 'BR') throw new Error('PRICE_MARKET_UNSUPPORTED');

    const { data: productsData, error: productsError } = await this.client
      .from('products')
      .select('id,brand,model,version,model_year,is_active')
      .eq('is_active', true)
      .ilike('brand', brand)
      .limit(5000);
    if (productsError) throw new Error('PRICE_PRODUCTS_READ_FAILED');

    let products = (productsData ?? []) as ProductRow[];
    if (!products.length) return [];

    const currentSelection = await this.selection?.latestCompleted(brand, market);
    if (currentSelection) {
      const allowed = new Set(
        currentSelection.pairs.map((pair) => pair.mmvIdentity + '|' + pair.modelYear),
      );
      products = products.filter((row) =>
        allowed.has(catalogMmvIdentityId(row) + '|' + row.model_year),
      );
    }
    if (!products.length) return [];

    const ids = products.map((row) => row.id);
    const { data: pricesData, error: pricesError } = await this.client
      .from('vw_current_product_public_prices')
      .select('id,product_id,amount,currency_code,starts_on')
      .in('product_id', ids);
    if (pricesError) throw new Error('PRICE_CURRENT_READ_FAILED');

    const current = new Map(
      ((pricesData ?? []) as CurrentPriceRow[]).map((row) => [row.product_id, row]),
    );

    const { data: aliasesData, error: aliasesError } = await this.client
      .from('price_identity_reconciliation_cache')
      .select('product_id,observed_label,source_url,source_fingerprint,confidence')
      .in('product_id', ids);
    if (aliasesError) throw new Error('PRICE_ALIAS_CACHE_READ_FAILED');

    const aliases = new Map<number, string[]>();
    const reconciliations = new Map<number, KnownPriceReconciliation[]>();
    for (const row of (aliasesData ?? []) as PriceAliasRow[]) {
      const confidence = Number(row.confidence);
      if (confidence < 0.8) continue;
      aliases.set(row.product_id, [...(aliases.get(row.product_id) ?? []), row.observed_label]);
      reconciliations.set(row.product_id, [
        ...(reconciliations.get(row.product_id) ?? []),
        {
          observedLabel: row.observed_label,
          sourceUrl: row.source_url,
          sourceFingerprint: row.source_fingerprint,
          confidence,
        },
      ]);
    }

    // Historic findings are URL discovery hints, NOT proof of current price.
    const {data:historical,error:historicalError} = await this.client
      .from('agent_findings').select('id,subject_key,created_at')
      .in('subject_key',ids.map(String)).in('finding_type',['NEW_PRICE','PRICE_CHANGE'])
      .order('created_at',{ascending:false}).limit(1500);
    if (historicalError) throw new Error('PRICE_EVIDENCE_HISTORY_READ_FAILED');
    const findingProduct = new Map((historical ?? []).map(item => [item.id,String(item.subject_key)]));
    const officialUrls = new Map<string,Set<string>>();
    if(findingProduct.size){
      const {data:evidences,error:evidenceError} = await this.client.from('agent_evidence')
        .select('finding_id,source_url').in('finding_id',[...findingProduct.keys()]).limit(3000);
      if(evidenceError) throw new Error('PRICE_EVIDENCE_URL_READ_FAILED');
      for(const evidence of evidences ?? []){
        const productId=findingProduct.get(evidence.finding_id);
        if(!productId)continue;
        const urls=officialUrls.get(productId) ?? new Set<string>();
        if(urls.size<8) urls.add(evidence.source_url);
        officialUrls.set(productId,urls);
      }
    }

    return products.map((row) => {
      const price = current.get(row.id);
      return {
        productId: String(row.id),
        mmvIdentity: catalogMmvIdentityId(row),
        brand: row.brand,
        model: row.model,
        version: row.version,
        modelYear: row.model_year,
        knownPriceAliases: aliases.get(row.id) ?? [],
        knownOfficialPriceUrls: [...(officialUrls.get(String(row.id)) ?? [])],
        knownPriceReconciliations: reconciliations.get(row.id) ?? [],
        currentPrice:
          price && price.currency_code === 'BRL'
            ? {
                id: String(price.id),
                money: { amount: Number(price.amount).toFixed(2), currencyCode: 'BRL' as const },
                startsOn: price.starts_on,
                status: 'published' as const,
              }
            : null,
      };
    });
  }
}


function comparableSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin.toLowerCase() + url.pathname.replace(/\/$/u, '').toLowerCase();
  } catch {
    return null;
  }
}

function priceAliasKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export class PriceAgentSupabaseTelemetry {
  constructor(private readonly client: SupabaseClient) {}

  async persistMappings(
    market: string,
    brand: string,
    targets: readonly PriceTarget[],
    mappings: readonly PriceIdentityMapping[],
    snapshots: readonly PriceSourceSnapshot[],
  ) {
    const byId = new Map(targets.map((target) => [target.productId, target]));
    for (const mapping of mappings) {
      const target = byId.get(mapping.productId);
      if (!target || mapping.confidence < 0.8) continue;
      const sourceKey = comparableSourceUrl(mapping.sourceUrl);
      const fingerprint =
        sourceKey === null
          ? null
          : snapshots.find((snapshot) => comparableSourceUrl(snapshot.finalUrl) === sourceKey)
              ?.contentHash ?? null;
      const { error } = await this.client.from('price_identity_reconciliation_cache').upsert(
        {
          market,
          brand,
          model: target.model,
          model_year: target.modelYear,
          observed_label: mapping.observedLabel,
          observed_key: priceAliasKey(mapping.observedLabel),
          product_id: Number(target.productId),
          mmv_identity: target.mmvIdentity,
          canonical_version: target.version,
          confidence: mapping.confidence,
          source_url: mapping.sourceUrl,
          source_fingerprint: fingerprint,
          model_used: mapping.modelUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'market,brand,model,model_year,observed_key' },
      );
      if (error) throw new Error('PRICE_ALIAS_CACHE_WRITE_FAILED');
    }
  }


  /** Append observed results without changing published MSRP or approvals. */
  async persistPriceObservations(input: {
    runId: string;
    targets: readonly PriceTarget[];
    observations: readonly import('@compra-car/core/agents').PriceObservation[];
  }): Promise<void> {
    const accepted = new Map<string, import('@compra-car/core/agents').PriceObservation>();
    for (const item of input.observations) {
      const amount = Number(item.msrpAmount);
      if (!item.msrpAmount || !Number.isFinite(amount) || amount < 20000 ||
          amount > 5000000 || item.ambiguityReasons.length ||
          !item.evidence.length || item.retailBonusAmount === item.msrpAmount) continue;
      if (!accepted.has(item.target.productId)) accepted.set(item.target.productId, item);
    }
    const productIds = input.targets.map(t => Number(t.productId)).filter(Number.isSafeInteger);
    const previous = new Map<string, number>();
    if (productIds.length) {
      const {data,error} = await this.client.from('agent_price_observations')
        .select('product_id,source_url,amount_brl,state,observed_at')
        .in('product_id',productIds)
        .neq('state','not_found')
        .order('observed_at',{ascending:false}).limit(3000);
      if (error) throw new Error('PRICE_OBSERVATION_HISTORY_READ_FAILED');
      for (const item of data ?? []) {
        const key = String(item.product_id) + '|' + item.source_url;
        if (!previous.has(key) && item.amount_brl !== null)
          previous.set(key, Number(item.amount_brl));
      }
    }
    const rows = input.targets.map((target) => {
      const observation = accepted.get(target.productId);
      const evidence = observation?.evidence[0];
      const previous = target.currentPrice?.money.amount;
      const baseline = previous.get(target.productId + '|' + (evidence?.sourceUrl ?? ''));
      const published = target.currentPrice?.money.amount;
      const state = !observation ? 'not_found'
        : (baseline !== undefined && baseline === Number(observation.msrpAmount)) ||
          (published !== undefined && Number(published) === Number(observation.msrpAmount))
          ? 'unchanged' : 'new_price';
      return {
        run_id: input.runId,
        product_id: Number(target.productId),
        market: 'BR',
        brand: target.brand,
        model_year: target.modelYear,
        source_url: evidence?.sourceUrl ?? 'urn:price:no-official-evidence',
        source_fingerprint: evidence?.contentHash ?? 'not_found',
        amount_brl: observation?.msrpAmount ?? null,
        state,
        evidence_excerpt: evidence?.excerpt ?? null,
        confidence: observation?.confidence ?? null,
      };
    });
    if (!rows.length) return;
    const {error} = await this.client.from('agent_price_observations')
      .upsert(rows,{onConflict:'run_id,product_id,source_url'});
    if (error) throw new Error('PRICE_OBSERVATION_JOURNAL_WRITE_FAILED');
  }

  async persistUsage(input: {
    runId: string;
    market: string;
    brand: string;
    usage: readonly PriceAiUsage[];
  }) {
    if (!input.usage.length) return;
    const { error } = await this.client.from('agent_ai_usage_events').insert(
      input.usage.map((item) => ({
        run_id: null,
        intended_run_id: input.runId,
        agent_type: 'PRICE_INTELLIGENCE',
        market: input.market,
        brand: input.brand,
        provider: 'openai',
        model: item.model,
        input_tokens: item.inputTokens,
        output_tokens: item.outputTokens,
        total_tokens: item.inputTokens + item.outputTokens,
        web_search_count: item.webSearchCount,
        estimated_cost_usd: item.estimatedCostUsd,
        reason: 'PRICE_CANONICAL_RECONCILIATION',
      })),
    );
    if (error) throw new Error('PRICE_USAGE_WRITE_FAILED');
  }
}
