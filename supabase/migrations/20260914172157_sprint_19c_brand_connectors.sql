-- Sprint 19C: operational configuration only. No canonical catalog mutations.
create table public.brand_connector_targets (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(trim(brand)) between 1 and 100),
  brand_key text not null check (length(trim(brand_key)) between 1 and 100),
  market text not null default 'BR' check (market ~ '^[A-Z]{2}$'),
  enabled boolean not null default true,
  origin text not null check (origin in ('CATALOG', 'MANUAL')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, brand_key)
);
create table public.brand_connectors (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.brand_connector_targets(id),
  version integer not null check (version > 0),
  status text not null check (status in ('ACTIVE', 'SUPERSEDED')),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  allowed_domains text[] not null check (cardinality(allowed_domains) between 1 and 20),
  source_entries jsonb not null default '[]' check (jsonb_typeof(source_entries) = 'array'),
  search_hints text[] not null default '{}',
  terminology_hints text[] not null default '{}',
  source_finding_id uuid references public.agent_findings(id),
  activated_by uuid,
  activated_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_id, version),
  check ((status = 'ACTIVE' and superseded_at is null) or (status = 'SUPERSEDED' and superseded_at is not null))
);
create unique index brand_connectors_one_active on public.brand_connectors(target_id) where status = 'ACTIVE';
create index brand_connectors_finding on public.brand_connectors(source_finding_id);
alter table public.brand_connector_targets enable row level security;
alter table public.brand_connectors enable row level security;
revoke all on table public.brand_connector_targets, public.brand_connectors from public, anon, authenticated, service_role;
grant select, insert, update on table public.brand_connector_targets, public.brand_connectors to service_role;

-- Reviews remain INSERT-only. A per-finding lock coordinates review INSERT with activation.
create function public.lock_brand_connector_review() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.finding_id::text, 19));
  return new;
end;
$$;
revoke all on function public.lock_brand_connector_review() from public, anon, authenticated;
grant execute on function public.lock_brand_connector_review() to service_role;
create trigger brand_connector_review_lock before insert on public.agent_reviews
for each row execute function public.lock_brand_connector_review();

-- Invoker function is reachable only by the privileged server adapter.
-- Proposal normalization/fingerprint validation is performed by that adapter.
-- This transaction rechecks immutable proposal identity and the effective review.
create function public.activate_brand_connector(p_finding_id uuid, p_actor uuid, p_target_id uuid, p_proposal jsonb, p_fingerprint text)
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
begin
  if p_actor is null then raise exception 'CONNECTOR_ACTIVATION_NOT_ALLOWED'; end if;
  select * into t from public.brand_connector_targets where id = p_target_id for update;
  if not found then raise exception 'CONNECTOR_TARGET_REQUIRED'; end if;
  -- Serialize activation with review INSERTs, so latest effective review cannot change mid-transaction.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_finding_id::text, 19));
  select * into f from public.agent_findings where id = p_finding_id;
  if not found then raise exception 'CONNECTOR_FINDING_REQUIRED'; end if;
  select * into r from public.agent_runs where id = f.run_id;
  select ar.decision into decision from public.agent_reviews ar where finding_id = f.id order by created_at desc, id desc limit 1;
  if r.status <> 'COMPLETED' or r.agent_type <> 'BRAND_CONNECTOR'
    or f.finding_type not in ('NEW_BRAND_CONNECTOR', 'CONNECTOR_DRIFT')
    or decision is distinct from 'ACCEPT' or f.proposal is distinct from p_proposal
    or f.payload->>'connectorFingerprint' is distinct from p_fingerprint
    or f.subject->>'market' is distinct from t.market
    or lower(trim(f.subject->>'brand')) is distinct from lower(trim(t.brand))
  then raise exception 'CONNECTOR_ACTIVATION_NOT_ALLOWED'; end if;
  select * into current_connector from public.brand_connectors where target_id = t.id and status = 'ACTIVE';
  if current_connector.fingerprint = p_fingerprint then return current_connector; end if;
  -- A stale accepted drift must not silently overwrite a newer activation.
  if (f.finding_type = 'NEW_BRAND_CONNECTOR' and current_connector.id is not null)
     or (f.finding_type = 'CONNECTOR_DRIFT' and current_connector.fingerprint is distinct from f.payload->>'previousConnectorFingerprint')
  then raise exception 'CONNECTOR_STALE_PROPOSAL'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.brand_connectors where target_id = t.id;
  update public.brand_connectors set status = 'SUPERSEDED', superseded_at = now() where target_id = t.id and status = 'ACTIVE';
  insert into public.brand_connectors(target_id, version, status, fingerprint, allowed_domains, source_entries, search_hints, terminology_hints, source_finding_id, activated_by)
  values (t.id, next_version, 'ACTIVE', p_fingerprint,
    array(select jsonb_array_elements_text(p_proposal->'allowedDomains')), p_proposal->'sourceEntries',
    array(select jsonb_array_elements_text(p_proposal->'searchHints')), array(select jsonb_array_elements_text(p_proposal->'terminologyHints')), f.id, p_actor)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.activate_brand_connector(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.activate_brand_connector(uuid, uuid, uuid, jsonb, text) to service_role;

-- Controlled bootstrap from the validated 19A registries. No inferred entries or hints.
-- A migration runs once; the data block also tolerates replay without replacing existing history.
do $bootstrap$
declare d jsonb; target_uuid uuid;
begin
  for d in select value from jsonb_array_elements($definitions$[{"brand":"Toyota","market":"BR","allowedDomains":["toyota.com.br","media.toyota.com.br"],"sourceEntries":[],"searchHints":["site:toyota.com.br modelos atuais Brasil","site:media.toyota.com.br ficha técnica versões","site:toyota.com.br configurador lista oficial versões","Prioridade: ficha técnica, documento de versões, lista oficial (somente identidade), configurador, página de modelo, release"],"terminologyHints":[],"brandKey":"toyota","fingerprint":"c8f581e0638804d39ac8562ea4d13e69e514cade8286d8c05e67ad5546230f96"},{"brand":"Jeep","market":"BR","allowedDomains":["jeep.com.br"],"sourceEntries":[],"searchHints":["site:jeep.com.br Jeep Brasil modelos atuais versões ano modelo","site:jeep.com.br ficha técnica motor powertrain T270 T270 MHEV","site:jeep.com.br monte o seu configurador Hurricane Hurricane Flex","Preservar nomes comerciais de powertrain separados de trim e atributos técnicos; somente fatos explícitos."],"terminologyHints":[],"brandKey":"jeep","fingerprint":"2b5ae1d635c7e4d12a03d467f8b90106fac7718c0df8ddbb4ecfc2a7ee4b9381"}]$definitions$::jsonb)
  loop
    insert into public.brand_connector_targets(brand, brand_key, market, origin)
    values(d->>'brand', d->>'brandKey', d->>'market', 'CATALOG') on conflict (market, brand_key) do nothing;
    select id into target_uuid from public.brand_connector_targets where market = d->>'market' and brand_key = d->>'brandKey' for update;
    if not exists(select 1 from public.brand_connectors where target_id = target_uuid) then
      insert into public.brand_connectors(target_id, version, status, fingerprint, allowed_domains, source_entries, search_hints, terminology_hints)
      values(target_uuid, 1, 'ACTIVE', d->>'fingerprint', array(select jsonb_array_elements_text(d->'allowedDomains')), d->'sourceEntries', array(select jsonb_array_elements_text(d->'searchHints')), array(select jsonb_array_elements_text(d->'terminologyHints')));
    end if;
  end loop;
end;
$bootstrap$;
