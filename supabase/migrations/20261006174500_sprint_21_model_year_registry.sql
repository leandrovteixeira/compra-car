-- Sprint 21: canonical MMV x production/model-year registry and reviewed product materialization.

create table public.catalog_mmv_model_years (
  id uuid primary key default gen_random_uuid(),
  mmv_id uuid not null references public.catalog_mmvs(id) on delete restrict,
  production_year smallint not null check (production_year between 2001 and 2100),
  model_year smallint not null check (model_year between 2001 and 2100),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','LIKELY_ACTIVE','DISCONTINUED','UNKNOWN')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  source_finding_id uuid not null references public.agent_findings(id) on delete restrict,
  last_confirmed_finding_id uuid not null references public.agent_findings(id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_mmv_model_years_pair_check
    check (production_year = model_year or production_year = model_year - 1),
  constraint catalog_mmv_model_years_identity unique (mmv_id, production_year, model_year)
);

create index catalog_mmv_model_years_mmv_idx
  on public.catalog_mmv_model_years(mmv_id, model_year desc, production_year desc);
create index catalog_mmv_model_years_status_idx
  on public.catalog_mmv_model_years(status, model_year desc);

alter table public.catalog_mmv_model_years enable row level security;
revoke all privileges on table public.catalog_mmv_model_years
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.catalog_mmv_model_years to service_role;

create or replace function public.apply_catalog_mmv_model_year(
  p_finding_id uuid,
  p_actor uuid,
  p_proposal jsonb,
  p_expected_fingerprint text
)
returns setof public.catalog_mmv_model_years
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.agent_findings;
  r public.agent_runs;
  decision text;
  mmv public.catalog_mmvs;
  applied public.catalog_mmv_model_years;
  v_mmv_id uuid;
  v_production_year smallint;
  v_model_year smallint;
  v_status text;
  v_confidence numeric;
begin
  if p_actor is null then
    raise exception 'PRODUCT_YEAR_APPLY_NOT_ALLOWED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_finding_id::text, 21));

  select * into f from public.agent_findings where id = p_finding_id;
  if not found then raise exception 'PRODUCT_YEAR_FINDING_REQUIRED'; end if;

  select * into r from public.agent_runs where id = f.run_id;
  if not found then raise exception 'PRODUCT_YEAR_RUN_REQUIRED'; end if;

  select ar.decision into decision
  from public.agent_reviews ar
  where ar.finding_id = f.id
  order by ar.created_at desc, ar.id desc
  limit 1;

  if r.status <> 'COMPLETED'
    or r.agent_type <> 'PRODUCT_YEAR'
    or f.finding_type <> 'NEW_PRODUCT_YEAR'
    or decision is distinct from 'ACCEPT'
    or f.fingerprint is distinct from p_expected_fingerprint
    or f.proposal is distinct from p_proposal
    or f.proposal->>'action' is distinct from 'STAGE_PRODUCT_YEAR'
  then
    raise exception 'PRODUCT_YEAR_APPLY_NOT_ALLOWED';
  end if;

  if exists (
    select 1
    from public.agent_findings newer
    join public.agent_runs newer_run on newer_run.id = newer.run_id
    where newer.id <> f.id
      and newer.subject_key is not distinct from f.subject_key
      and newer.created_at > f.created_at
      and newer_run.agent_type = 'PRODUCT_YEAR'
      and newer_run.status = 'COMPLETED'
  ) then
    raise exception 'PRODUCT_YEAR_STALE_PROPOSAL';
  end if;

  v_mmv_id := (f.proposal->>'mmvId')::uuid;
  v_production_year := (f.proposal->>'productionYear')::smallint;
  v_model_year := (f.proposal->>'modelYear')::smallint;
  v_status := coalesce(nullif(btrim(f.proposal->>'status'), ''), 'ACTIVE');
  v_confidence := f.confidence;

  if v_model_year not between 2001 and 2100
    or v_production_year not between 2001 and 2100
    or (v_production_year <> v_model_year and v_production_year <> v_model_year - 1)
    or v_status not in ('ACTIVE','LIKELY_ACTIVE','DISCONTINUED','UNKNOWN')
  then
    raise exception 'PRODUCT_YEAR_INVALID_PROPOSAL';
  end if;

  select * into mmv
  from public.catalog_mmvs
  where id = v_mmv_id
    and market = r.market
    and status = 'ACTIVE';

  if not found then
    raise exception 'PRODUCT_YEAR_MMV_REQUIRED';
  end if;

  insert into public.catalog_mmv_model_years (
    mmv_id,
    production_year,
    model_year,
    status,
    confidence,
    source_finding_id,
    last_confirmed_finding_id,
    created_by
  )
  values (
    mmv.id,
    v_production_year,
    v_model_year,
    v_status,
    v_confidence,
    f.id,
    f.id,
    p_actor
  )
  on conflict (mmv_id, production_year, model_year) do update
    set status = excluded.status,
        confidence = greatest(public.catalog_mmv_model_years.confidence, excluded.confidence),
        last_confirmed_finding_id = excluded.last_confirmed_finding_id,
        updated_at = now()
  returning * into applied;

  -- Reuse a pre-MMV legacy product row when the exact commercial label/year pair already exists.
  -- This avoids duplicating products while Sprint 20/21 progressively attach canonical identity.
  update public.products p
  set mmv_id = mmv.id,
      updated_at = now()
  where p.mmv_id is null
    and p.brand = mmv.brand
    and p.model = mmv.model
    and p.version = mmv.official_version_label
    and p.production_year = v_production_year
    and p.model_year = v_model_year;

  insert into public.products (
    brand,
    model,
    version,
    model_year,
    production_year,
    is_active,
    is_public,
    mmv_id
  )
  select
    mmv.brand,
    mmv.model,
    mmv.official_version_label,
    v_model_year,
    v_production_year,
    true,
    false,
    mmv.id
  where not exists (
    select 1
    from public.products p
    where p.mmv_id = mmv.id
      and p.production_year = v_production_year
      and p.model_year = v_model_year
  );

  return next applied;
  return;
end;
$$;

revoke all on function public.apply_catalog_mmv_model_year(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.apply_catalog_mmv_model_year(uuid, uuid, jsonb, text)
  to service_role;
