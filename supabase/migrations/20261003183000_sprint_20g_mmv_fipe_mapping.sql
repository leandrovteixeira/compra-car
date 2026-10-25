create table if not exists public.catalog_mmv_fipe_mappings (
  id uuid primary key default gen_random_uuid(),
  mmv_id uuid not null references public.catalog_mmvs(id) on delete restrict,
  fipe_vehicle_model_id bigint null references public.fipe_vehicle_models(id) on delete restrict,
  fipe_code text not null check (fipe_code ~ '^[0-9]{6}-[0-9]$'),
  fipe_model_label text not null check (length(btrim(fipe_model_label)) between 1 and 300),
  model_year_hint integer null check (model_year_hint between 1900 and 2100),
  reference_period text null check (reference_period is null or length(btrim(reference_period)) between 1 and 100),
  source_kind text not null check (source_kind in ('FIPE','SECONDARY')),
  source_url text not null check (length(btrim(source_url)) between 1 and 2048),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE','CONFIRMED','REJECTED')),
  source_finding_id uuid null references public.agent_findings(id) on delete restrict,
  reviewed_by uuid null,
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mmv_id, fipe_code)
);

create index if not exists catalog_mmv_fipe_mappings_fipe_code_idx
  on public.catalog_mmv_fipe_mappings (fipe_code);

create index if not exists catalog_mmv_fipe_mappings_mmv_status_idx
  on public.catalog_mmv_fipe_mappings (mmv_id, status);

alter table public.catalog_mmv_fipe_mappings enable row level security;

revoke all on public.catalog_mmv_fipe_mappings from anon, authenticated;
grant select, insert, update on public.catalog_mmv_fipe_mappings to service_role;

comment on table public.catalog_mmv_fipe_mappings is
  'MMV-level FIPE identity mapping. FIPE code belongs to canonical MMV, not Product/PY. Candidate secondary-source codes require later confirmation.';
