-- Sprint 20I: brand identity and alias registry.
-- Structural migration only; existing brand data is not backfilled automatically.

create table public.brand_identities (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market ~ '^[A-Z]{2}$'),
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 100),
  canonical_key text not null check (length(btrim(canonical_key)) between 1 and 100),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  source_finding_id uuid references public.agent_findings(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, canonical_key)
);

create table public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_identity_id uuid not null references public.brand_identities(id) on delete cascade,
  market text not null check (market ~ '^[A-Z]{2}$'),
  alias text not null check (length(btrim(alias)) between 1 and 100),
  alias_key text not null check (length(btrim(alias_key)) between 1 and 100),
  alias_type text not null check (
    alias_type in ('OFFICIAL_SHORT_NAME','LEGAL_NAME','MARKETING_NAME','LEGACY_CATALOG','FORMER_NAME')
  ),
  source_url text not null check (length(btrim(source_url)) between 1 and 2048),
  confidence numeric not null check (confidence between 0 and 1),
  status text not null default 'CONFIRMED' check (status in ('CANDIDATE','CONFIRMED','REJECTED')),
  source_finding_id uuid references public.agent_findings(id),
  reviewed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, alias_key)
);

alter table public.brand_connector_targets
  add column brand_identity_id uuid references public.brand_identities(id);

create index brand_connector_targets_identity_idx
  on public.brand_connector_targets(brand_identity_id);
create index brand_aliases_identity_idx
  on public.brand_aliases(brand_identity_id);
create index brand_aliases_finding_idx
  on public.brand_aliases(source_finding_id);

alter table public.brand_identities enable row level security;
alter table public.brand_aliases enable row level security;
revoke all on table public.brand_identities, public.brand_aliases from public, anon, authenticated, service_role;
grant select, insert, update on table public.brand_identities, public.brand_aliases to service_role;

create or replace function public.activate_brand_connector(
  p_finding_id uuid,
  p_actor uuid,
  p_target_id uuid,
  p_proposal jsonb,
  p_fingerprint text
)
returns public.brand_connectors
language plpgsql security invoker set search_path = '' as $$
declare
  f public.agent_findings;
  r public.agent_runs;
  t public.brand_connector_targets;
  current_connector public.brand_connectors;
  result public.brand_connectors;
  decision text;
  next_version integer;
  identity_row public.brand_identities;
  canonical_name text;
  canonical_key text;
  alias_row jsonb;
  alias_name text;
  alias_key_value text;
begin
  if p_actor is null then raise exception 'CONNECTOR_ACTIVATION_NOT_ALLOWED'; end if;

  select * into t from public.brand_connector_targets where id = p_target_id for update;
  if not found then raise exception 'CONNECTOR_TARGET_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_finding_id::text, 19));

  select * into f from public.agent_findings where id = p_finding_id;
  if not found then raise exception 'CONNECTOR_FINDING_REQUIRED'; end if;

  select * into r from public.agent_runs where id = f.run_id;
  select ar.decision into decision
  from public.agent_reviews ar
  where finding_id = f.id
  order by created_at desc, id desc
  limit 1;

  if r.status <> 'COMPLETED'
    or r.agent_type <> 'BRAND_CONNECTOR'
    or f.finding_type not in ('NEW_BRAND_CONNECTOR', 'CONNECTOR_DRIFT')
    or decision is distinct from 'ACCEPT'
    or f.proposal is distinct from p_proposal
    or f.payload->>'connectorFingerprint' is distinct from p_fingerprint
    or f.subject->>'market' is distinct from t.market
    or lower(trim(f.subject->>'brand')) is distinct from lower(trim(t.brand))
  then
    raise exception 'CONNECTOR_ACTIVATION_NOT_ALLOWED';
  end if;

  canonical_name := nullif(btrim(f.payload->>'canonicalBrand'), '');
  canonical_key := lower(canonical_name);
  if canonical_name is null
    or length(canonical_name) > 100
    or jsonb_typeof(coalesce(f.payload->'aliases','[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(f.payload->'aliases','[]'::jsonb)) > 20
  then
    raise exception 'BRAND_IDENTITY_INVALID';
  end if;

  insert into public.brand_identities(
    market, canonical_name, canonical_key, source_finding_id, created_by
  )
  values (
    t.market, canonical_name, canonical_key, f.id, p_actor
  )
  on conflict (market, canonical_key)
  do update set
    canonical_name = excluded.canonical_name,
    source_finding_id = excluded.source_finding_id,
    updated_at = now()
  returning * into identity_row;

  update public.brand_connector_targets
  set brand_identity_id = identity_row.id, updated_at = now()
  where id = t.id;

  for alias_row in
    select value from jsonb_array_elements(coalesce(f.payload->'aliases','[]'::jsonb))
  loop
    alias_name := nullif(btrim(alias_row->>'alias'), '');
    alias_key_value := lower(alias_name);
    if alias_name is null
      or length(alias_name) > 100
      or alias_row->>'aliasType' not in (
        'OFFICIAL_SHORT_NAME','LEGAL_NAME','MARKETING_NAME','LEGACY_CATALOG','FORMER_NAME'
      )
      or nullif(btrim(alias_row->>'evidenceUrl'),'') is null
      or (alias_row->>'confidence') is null
    then
      raise exception 'BRAND_ALIAS_INVALID';
    end if;

    insert into public.brand_aliases(
      brand_identity_id, market, alias, alias_key, alias_type, source_url,
      confidence, status, source_finding_id, reviewed_by, confirmed_at
    )
    values (
      identity_row.id,
      t.market,
      alias_name,
      alias_key_value,
      alias_row->>'aliasType',
      alias_row->>'evidenceUrl',
      (alias_row->>'confidence')::numeric,
      'CONFIRMED',
      f.id,
      p_actor,
      now()
    )
    on conflict (market, alias_key)
    do update set
      brand_identity_id = excluded.brand_identity_id,
      alias = excluded.alias,
      alias_type = excluded.alias_type,
      source_url = excluded.source_url,
      confidence = excluded.confidence,
      status = 'CONFIRMED',
      source_finding_id = excluded.source_finding_id,
      reviewed_by = excluded.reviewed_by,
      confirmed_at = excluded.confirmed_at,
      updated_at = now();
  end loop;

  select * into current_connector
  from public.brand_connectors
  where target_id = t.id and status = 'ACTIVE';

  if current_connector.fingerprint = p_fingerprint then
    return current_connector;
  end if;

  if (f.finding_type = 'NEW_BRAND_CONNECTOR' and current_connector.id is not null)
     or (
       f.finding_type = 'CONNECTOR_DRIFT'
       and current_connector.fingerprint is distinct from f.payload->>'previousConnectorFingerprint'
     )
  then
    raise exception 'CONNECTOR_STALE_PROPOSAL';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.brand_connectors
  where target_id = t.id;

  update public.brand_connectors
  set status = 'SUPERSEDED', superseded_at = now()
  where target_id = t.id and status = 'ACTIVE';

  insert into public.brand_connectors(
    target_id, version, status, fingerprint, allowed_domains, source_entries,
    search_hints, terminology_hints, source_finding_id, activated_by
  )
  values (
    t.id,
    next_version,
    'ACTIVE',
    p_fingerprint,
    array(select jsonb_array_elements_text(p_proposal->'allowedDomains')),
    p_proposal->'sourceEntries',
    array(select jsonb_array_elements_text(p_proposal->'searchHints')),
    array(select jsonb_array_elements_text(p_proposal->'terminologyHints')),
    f.id,
    p_actor
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.activate_brand_connector(uuid, uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.activate_brand_connector(uuid, uuid, uuid, jsonb, text)
  to service_role;
