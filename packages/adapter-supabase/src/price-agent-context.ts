import type { SupabaseClient } from '@supabase/supabase-js';
import {
  catalogMmvIdentityId,
  type PriceCatalogReader,
  type PriceTarget,
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

export class PriceAgentSupabaseCatalogReader implements PriceCatalogReader {
  constructor(private readonly client: SupabaseClient) {}

  async readPriceTargets(brand: string, market: string): Promise<readonly PriceTarget[]> {
    if (market !== 'BR') throw new Error('PRICE_MARKET_UNSUPPORTED');

    const { data: productsData, error: productsError } = await this.client
      .from('products')
      .select('id,brand,model,version,model_year,is_active')
      .eq('is_active', true)
      .ilike('brand', brand)
      .limit(5000);
    if (productsError) throw new Error('PRICE_PRODUCTS_READ_FAILED');

    const products = (productsData ?? []) as ProductRow[];
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
    const reconciliations = new Map<number, PriceTarget['knownPriceReconciliations'] extends readonly (infer T)[] ? T[] : never>();
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
    mappings: readonly import('@compra-car/core/agents').PriceIdentityMapping[],
  ) {
    const byId = new Map(targets.map((target) => [target.productId, target]));
    for (const mapping of mappings) {
      const target = byId.get(mapping.productId);
      if (!target || mapping.confidence < 0.8) continue;
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
          source_fingerprint: null,
          model_used: mapping.modelUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'market,brand,model,model_year,observed_key' },
      );
      if (error) throw new Error('PRICE_ALIAS_CACHE_WRITE_FAILED');
    }
  }

  async persistUsage(input: {
    runId: string;
    market: string;
    brand: string;
    usage: readonly import('@compra-car/core/agents').PriceAiUsage[];
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
