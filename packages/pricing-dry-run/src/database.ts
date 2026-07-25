import { Client, type QueryResultRow } from 'pg';

import type {
  CanonicalRow,
  LegacyImport,
  LegacyImportRow,
  LegacyOffer,
  LegacyProduct,
  SourceSnapshot,
} from './types.js';

const REQUIRED_OBJECTS = [
  'public.product_price_offers',
  'public.price_offer_imports',
  'public.price_offer_import_rows',
  'public.price_offers_staging',
  'public.products',
  'public.product_specs',
  'public.specs',
  'public.vw_product_value_current',
  'public.vw_product_value_current_v2',
  'public.product_public_prices',
  'public.commercial_policies',
  'public.commercial_policy_accumulators',
] as const;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface LocalDatabaseTarget {
  connectionString: string;
  sanitizedIdentity: string;
}

export function validateLocalDatabaseUrl(
  connectionString: string,
  expectedPort = 54322,
): LocalDatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
  if (parsed.search !== '') {
    throw new Error('DATABASE_URL query parameters are disabled for local dry-run safety');
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Remote database hosts are disabled for pricing legacy dry-run');
  }

  const port = parsed.port === '' ? 5432 : Number(parsed.port);
  if (!Number.isInteger(port) || port !== expectedPort) {
    throw new Error(`DATABASE_URL must target the configured local Supabase port ${expectedPort}`);
  }
  if (parsed.pathname === '' || parsed.pathname === '/') {
    throw new Error('DATABASE_URL must identify a local database');
  }

  return {
    connectionString,
    sanitizedIdentity: `${parsed.hostname}:${port}${parsed.pathname}`,
  };
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asCanonicalRows(rows: QueryResultRow[]): CanonicalRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : (value as CanonicalRow[string]),
      ]),
    ),
  );
}

export async function readLegacySnapshot(
  target: LocalDatabaseTarget,
  cutoffDate: string | null,
): Promise<SourceSnapshot> {
  const client = new Client({
    connectionString: target.connectionString,
    application_name: 'compra-car-pricing-legacy-dry-run',
    ssl: false,
  });

  await client.connect();
  try {
    await client.query('begin transaction isolation level repeatable read read only');

    const transaction = await client.query<{ transaction_read_only: string }>(
      "select current_setting('transaction_read_only') as transaction_read_only",
    );
    if (transaction.rows[0]?.transaction_read_only !== 'on') {
      throw new Error('Database did not confirm a read-only transaction');
    }

    const objects = await client.query<{ object_name: string; object_oid: string | null }>(
      `select required.object_name,
              to_regclass(required.object_name)::text as object_oid
         from unnest($1::text[]) as required(object_name)
        order by required.object_name`,
      [REQUIRED_OBJECTS],
    );
    const missing = objects.rows.filter((object) => object.object_oid === null);
    if (missing.length > 0) {
      throw new Error(
        `Required local objects are missing: ${missing.map((item) => item.object_name).join(', ')}`,
      );
    }

    const identity = await client.query<{ database_name: string; server_port: number }>(
      `select current_database() as database_name,
              inet_server_port() as server_port`,
    );
    const databaseIdentity = `${target.sanitizedIdentity}#${identity.rows[0]?.database_name ?? 'unknown'}:${identity.rows[0]?.server_port ?? 'unknown'}`;

    const offersResult = await client.query(
      `select id, product_id, offer_month, public_price, retail_bonus, retail_rebate,
              trade_in_bonus, trade_in_rebate, subsidized_rate_monthly,
              down_payment_percent, installments, rate_rebate, insurance_years,
              ipva_included, others_bonus, total_customer_benefit,
              total_dealer_rebate, notes, is_active
         from public.product_price_offers
        where ($1::date is null or offer_month <= $1::date)
        order by product_id, offer_month, id`,
      [cutoffDate],
    );
    const productsResult = await client.query(
      `select id, is_active
         from public.products
        order by id`,
    );
    const importsResult = await client.query(
      `select id, valid_from, valid_to, status
         from public.price_offer_imports
        where ($1::date is null or valid_from is null or valid_from <= $1::date)
        order by id`,
      [cutoffDate],
    );
    const importRowsResult = await client.query(
      `select id, import_id, product_id, public_price, raw_text, status
         from public.price_offer_import_rows
        order by id`,
    );
    const stagingResult = await client.query(
      `select brand, model, version, registration_base_description, my_code, control,
              msrp, retail_bonus, trade_in_bonus, subsidized_rate_monthly, rate_cost,
              insurance_years, ipva_value, others_bonus, dealer_rebate,
              total_customer_benefit, comment, offer_month_code,
              down_payment_percent, installments
         from public.price_offers_staging
        order by brand nulls first, model nulls first, version nulls first,
                 offer_month_code nulls first, control nulls first, comment nulls first`,
    );
    const productSpecsResult = await client.query(
      `select product_id, equipment_id, value, is_present, input_unit
         from public.product_specs
        order by product_id, equipment_id, id`,
    );
    const specsResult = await client.query(
      `select id, code, type, is_active, unit_perceived_value, relative_value
         from public.specs
        order by id`,
    );
    const legacyViewResult = await client.query(
      `select product_id
         from public.vw_product_value_current
        order by product_id`,
    );
    const v2ViewResult = await client.query(
      `select product_id
         from public.vw_product_value_current_v2
        order by product_id`,
    );
    const sprint9CountsResult = await client.query<{ object_name: string; row_count: string }>(
      `select 'product_public_prices' as object_name, count(*)::text as row_count
         from public.product_public_prices
       union all
       select 'commercial_policies', count(*)::text from public.commercial_policies
       union all
       select 'commercial_policy_accumulators', count(*)::text
         from public.commercial_policy_accumulators
       order by object_name`,
    );

    await client.query('commit');

    const offers: LegacyOffer[] = offersResult.rows.map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      offerMonth: asString(row.offer_month),
      publicPrice: asString(row.public_price),
      retailBonus: asString(row.retail_bonus),
      retailRebate: asString(row.retail_rebate),
      tradeInBonus: asString(row.trade_in_bonus),
      tradeInRebate: asString(row.trade_in_rebate),
      subsidizedRateMonthly: asString(row.subsidized_rate_monthly),
      downPaymentPercent: asString(row.down_payment_percent),
      installments: row.installments === null ? null : Number(row.installments),
      rateRebate: asString(row.rate_rebate),
      insuranceYears: asString(row.insurance_years),
      ipvaIncluded: asBoolean(row.ipva_included),
      othersBonus: asString(row.others_bonus),
      totalCustomerBenefit: asString(row.total_customer_benefit),
      totalDealerRebate: asString(row.total_dealer_rebate),
      notes: asString(row.notes),
      isActive: asBoolean(row.is_active),
    }));
    const products: LegacyProduct[] = productsResult.rows.map((row) => ({
      id: String(row.id),
      isActive: asBoolean(row.is_active),
    }));
    const imports: LegacyImport[] = importsResult.rows.map((row) => ({
      id: String(row.id),
      validFrom: asString(row.valid_from),
      validTo: asString(row.valid_to),
      status: asString(row.status),
    }));
    const importRows: LegacyImportRow[] = importRowsResult.rows.map((row) => ({
      id: String(row.id),
      importId: asString(row.import_id),
      productId: asString(row.product_id),
      publicPrice: asString(row.public_price),
      rawText: asString(row.raw_text),
      status: asString(row.status),
    }));

    return {
      databaseIdentity,
      offers,
      products,
      imports,
      importRows,
      stagingRows: asCanonicalRows(stagingResult.rows),
      productSpecs: asCanonicalRows(productSpecsResult.rows),
      specs: asCanonicalRows(specsResult.rows),
      legacyViewProductIds: legacyViewResult.rows.map((row) => String(row.product_id)),
      v2ViewProductIds: v2ViewResult.rows.map((row) => String(row.product_id)),
      sprint9ObjectCounts: Object.fromEntries(
        sprint9CountsResult.rows.map((row) => [row.object_name, Number(row.row_count)]),
      ),
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
