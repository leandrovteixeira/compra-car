create table public.catalog_mmvs (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'BR' check (market ~ '^[A-Z]{2}$'),
  identity_key text not null check (length(btrim(identity_key)) between 1 and 2000),
  brand text not null check (length(btrim(brand)) between 1 and 120),
  model text not null check (length(btrim(model)) between 1 and 200),
  official_version_label text not null check (length(btrim(official_version_label)) between 1 and 200),
  body_style text check (body_style is null or length(btrim(body_style)) between 1 and 200),
  powertrain_label text check (powertrain_label is null or length(btrim(powertrain_label)) between 1 and 200),
  propulsion text check (propulsion is null or propulsion in ('ICE','MHEV','HEV','PHEV','BEV')),
  engine_displacement numeric(6,3) check (engine_displacement is null or (engine_displacement > 0 and engine_displacement <= 20)),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  source_finding_id uuid not null references public.agent_findings(id) on delete restrict,
  last_confirmed_finding_id uuid not null references public.agent_findings(id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_mmvs_market_identity_key unique (market, identity_key),
  constraint catalog_mmvs_public_requires_active check (visibility <> 'PUBLIC' or status = 'ACTIVE')
);

create index catalog_mmvs_brand_model_idx on public.catalog_mmvs(market, brand, model);
create index catalog_mmvs_source_finding_idx on public.catalog_mmvs(source_finding_id);
create index catalog_mmvs_last_confirmed_finding_idx on public.catalog_mmvs(last_confirmed_finding_id);

alter table public.products add column mmv_id uuid;
alter table public.products
  add constraint products_mmv_id_fkey
  foreign key (mmv_id) references public.catalog_mmvs(id) on delete restrict not valid;
alter table public.products validate constraint products_mmv_id_fkey;
create index products_mmv_id_idx on public.products(mmv_id);

alter table public.catalog_mmvs enable row level security;
revoke all privileges on table public.catalog_mmvs from public, anon, authenticated, service_role;
grant select, insert, update on table public.catalog_mmvs to service_role;

create function public.apply_catalog_mmvs(
  p_finding_id uuid,
  p_actor uuid,
  p_proposal jsonb,
  p_expected_fingerprint text
)
returns setof public.catalog_mmvs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.agent_findings;
  r public.agent_runs;
  decision text;
  item jsonb;
  existing public.catalog_mmvs;
  v_market text;
  v_identity_key text;
  v_brand text;
  v_model text;
  v_version text;
  v_body text;
  v_powertrain text;
  v_propulsion text;
  v_displacement numeric;
begin
  if p_actor is null then
    raise exception 'MMV_APPLY_NOT_ALLOWED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_finding_id::text, 19));

  select * into f from public.agent_findings where id = p_finding_id;
  if not found then raise exception 'MMV_FINDING_REQUIRED'; end if;

  select * into r from public.agent_runs where id = f.run_id;
  if not found then raise exception 'MMV_RUN_REQUIRED'; end if;

  select ar.decision into decision
  from public.agent_reviews ar
  where ar.finding_id = f.id
  order by ar.created_at desc, ar.id desc
  limit 1;

  if r.status <> 'COMPLETED'
    or r.agent_type <> 'MMV_DISCOVERY'
    or f.finding_type not in ('NEW_MODEL','NEW_VERSION')
    or decision is distinct from 'ACCEPT'
    or f.fingerprint is distinct from p_expected_fingerprint
    or f.proposal is distinct from p_proposal
    or f.proposal->>'action' is distinct from 'STAGE_MMV_IDENTITIES'
    or f.payload->>'reasonCode' not in ('NEW_MODEL','NEW_COMMERCIAL_VARIANT','SAME_LABEL_DISTINCT_POWERTRAIN')
    or jsonb_typeof(f.proposal->'identities') is distinct from 'array'
    or jsonb_array_length(f.proposal->'identities') not between 1 and 50
  then
    raise exception 'MMV_APPLY_NOT_ALLOWED';
  end if;

  if exists (
    select 1
    from public.agent_findings newer
    join public.agent_runs newer_run on newer_run.id = newer.run_id
    where newer.id <> f.id
      and newer.subject_key is not distinct from f.subject_key
      and newer.created_at > f.created_at
      and newer_run.agent_type = 'MMV_DISCOVERY'
      and newer_run.status = 'COMPLETED'
  ) then
    raise exception 'MMV_STALE_PROPOSAL';
  end if;

  v_market := f.proposal->>'market';
  if v_market is distinct from r.market or v_market !~ '^[A-Z]{2}$' then
    raise exception 'MMV_APPLY_NOT_ALLOWED';
  end if;

  for item in select value from jsonb_array_elements(f.proposal->'identities')
  loop
    v_identity_key := item->>'identityKey';
    v_brand := item->>'brand';
    v_model := item->>'model';
    v_version := item->>'officialVersionLabel';
    v_body := nullif(btrim(item->>'bodyStyle'), '');
    v_powertrain := nullif(btrim(item->>'powertrainLabel'), '');
    v_propulsion := nullif(btrim(item->>'propulsion'), '');
    v_displacement := case
      when item->>'engineDisplacement' is null then null
      else (item->>'engineDisplacement')::numeric
    end;

    if coalesce(length(btrim(v_identity_key)), 0) not between 1 and 2000
      or coalesce(length(btrim(v_brand)), 0) not between 1 and 120
      or coalesce(length(btrim(v_model)), 0) not between 1 and 200
      or coalesce(length(btrim(v_version)), 0) not between 1 and 200
      or (v_propulsion is not null and v_propulsion not in ('ICE','MHEV','HEV','PHEV','BEV'))
      or (v_displacement is not null and (v_displacement <= 0 or v_displacement > 20))
    then
      raise exception 'MMV_APPLY_INVALID_IDENTITY';
    end if;

    insert into public.catalog_mmvs (
      market, identity_key, brand, model, official_version_label,
      body_style, powertrain_label, propulsion, engine_displacement,
      source_finding_id, last_confirmed_finding_id, created_by
    )
    values (
      v_market, v_identity_key, btrim(v_brand), btrim(v_model), btrim(v_version),
      v_body, v_powertrain, v_propulsion, v_displacement,
      f.id, f.id, p_actor
    )
    on conflict (market, identity_key) do update
      set last_confirmed_finding_id = excluded.last_confirmed_finding_id,
          updated_at = now()
    returning * into existing;

    if existing.brand is distinct from btrim(v_brand)
      or existing.model is distinct from btrim(v_model)
      or existing.official_version_label is distinct from btrim(v_version)
      or existing.body_style is distinct from v_body
      or existing.powertrain_label is distinct from v_powertrain
      or existing.propulsion is distinct from v_propulsion
      or existing.engine_displacement is distinct from v_displacement
    then
      raise exception 'MMV_IDENTITY_KEY_COLLISION';
    end if;

    return next existing;
  end loop;

  return;
end;
$$;

revoke all on function public.apply_catalog_mmvs(uuid, uuid, jsonb, text)
from public, anon, authenticated;
grant execute on function public.apply_catalog_mmvs(uuid, uuid, jsonb, text) to service_role;
