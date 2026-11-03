-- Sprint 27 SPEC AGENT - REVIEW-ONLY SCHEMA DRAFT.
-- NOT A MIGRATION. Do not run directly on QA or production.
-- Generate a versioned Supabase migration via CLI after review and local validation.
-- Newly introduced tables intentionally have no anon/authenticated API access.

create table if not exists public.agent_spec_documents (
  id uuid primary key default gen_random_uuid(),
  source_family_key text not null,
  source_document_key text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  source_authority text not null check (source_authority in ('REGULATORY','MANUFACTURER','DEALER')),
  source_url text,
  original_filename text,
  source_captured_at timestamptz not null,
  import_agent_run_id uuid references public.agent_runs(id),
  created_at timestamptz not null default now(),
  unique (source_document_key,content_sha256)
);

create table if not exists public.agent_spec_observations (
  id uuid primary key default gen_random_uuid(),
  product_id integer not null references public.products(id),
  model_year smallint not null check (model_year between 2000 and 2100),
  spec_id bigint not null references public.specs(id),
  source_document_id uuid not null references public.agent_spec_documents(id),
  source_locator text not null,
  raw_label text not null,
  raw_value text not null,
  availability text check (availability in ('STANDARD','OPTIONAL','NOT_AVAILABLE')),
  numeric_value numeric(14,4),
  measurement_operator text not null default '='
    check (measurement_operator in ('=','>=','<=')),
  measurement_method text not null default 'UNSPECIFIED',
  input_unit text,
  observed_at timestamptz not null,
  inherited_from_model_year smallint,
  confirmation_status text not null default 'PENDING_REVIEW'
    check (confirmation_status in ('INHERITED','PENDING_REVIEW','CONFIRMED')),
  review_case_id uuid references public.agent_review_cases(id),
  created_at timestamptz not null default now(),
  check (not (availability is not null and numeric_value is not null)),
  check (inherited_from_model_year is null or inherited_from_model_year < model_year),
  check (confirmation_status <> 'INHERITED' or inherited_from_model_year is not null),
  unique (product_id,model_year,spec_id,source_document_id,source_locator),
  unique (id,product_id,model_year,spec_id)
);

-- Selection is separate from the immutable observation journal.
-- A server-side transaction must validate both source authority and review state.
create table if not exists public.agent_spec_selected_values (
  product_id integer not null references public.products(id),
  model_year smallint not null check (model_year between 2000 and 2100),
  spec_id bigint not null references public.specs(id),
  measurement_method text not null default 'UNSPECIFIED',
  observation_id uuid not null,
  is_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (product_id,model_year,spec_id,measurement_method),
  foreign key (observation_id,product_id,model_year,spec_id)
    references public.agent_spec_observations(id,product_id,model_year,spec_id)
);

create table if not exists public.agent_spec_coverage (
  product_id integer not null references public.products(id),
  model_year smallint not null check (model_year between 2000 and 2100),
  status text not null default 'AWAITING_SOURCE'
    check (status in ('AWAITING_SOURCE','PENDING_REVIEW','CONFIRMED')),
  status_reason text,
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  pending_count integer not null default 0 check (pending_count >= 0),
  inherited_count integer not null default 0 check (inherited_count >= 0),
  last_agent_run_id uuid references public.agent_runs(id),
  updated_at timestamptz not null default now(),
  primary key (product_id,model_year)
);

create index if not exists agent_spec_observations_review_idx
  on public.agent_spec_observations (review_case_id,confirmation_status);
create index if not exists agent_spec_observations_source_idx
  on public.agent_spec_observations (source_document_id,product_id,model_year);
create index if not exists agent_spec_coverage_status_idx
  on public.agent_spec_coverage (status,updated_at desc);

alter table public.agent_spec_documents enable row level security;
alter table public.agent_spec_observations enable row level security;
alter table public.agent_spec_selected_values enable row level security;
alter table public.agent_spec_coverage enable row level security;

-- No browser-role access. Server-side authorization and atomic review decisions
-- must be implemented and validated before these tables are deployed.
revoke all on public.agent_spec_documents from public, anon, authenticated;
revoke all on public.agent_spec_observations from public, anon, authenticated;
revoke all on public.agent_spec_selected_values from public, anon, authenticated;
revoke all on public.agent_spec_coverage from public, anon, authenticated;
grant select, insert, update, delete on public.agent_spec_documents to service_role;
grant select, insert, update, delete on public.agent_spec_observations to service_role;
grant select, insert, update, delete on public.agent_spec_selected_values to service_role;
grant select, insert, update, delete on public.agent_spec_coverage to service_role;
