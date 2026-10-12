create table if not exists public.price_identity_reconciliation_cache (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market ~ '^[A-Z]{2}$'),
  brand text not null check (length(btrim(brand)) between 1 and 100),
  model text not null check (length(btrim(model)) between 1 and 200),
  model_year integer not null check (model_year between 2000 and 2100),
  observed_label text not null check (length(btrim(observed_label)) between 1 and 200),
  observed_key text not null check (length(btrim(observed_key)) between 1 and 240),
  product_id bigint not null references public.products(id) on delete cascade,
  mmv_identity text not null,
  canonical_version text not null,
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  source_url text not null check (length(btrim(source_url)) between 1 and 2048),
  source_fingerprint text,
  model_used text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, brand, model, model_year, observed_key)
);

create index if not exists price_identity_reconciliation_cache_product_idx
  on public.price_identity_reconciliation_cache(product_id, updated_at desc);

alter table public.price_identity_reconciliation_cache enable row level security;

revoke all on table public.price_identity_reconciliation_cache
from public, anon, authenticated, service_role;

grant select, insert, update on table public.price_identity_reconciliation_cache to service_role;
