-- Sprint 20G: keep MMV commercial identity separate from technical attributes
-- and persist FIPE/market reconciliation observations on canonical apply.

update public.catalog_mmvs
set identity_key = format(
  '["mmv-current:v2",%s,%s,%s,null]',
  to_json(lower(regexp_replace(btrim(brand), '\\s+', ' ', 'g')))::text,
  to_json(lower(regexp_replace(btrim(model), '\\s+', ' ', 'g')))::text,
  to_json(lower(regexp_replace(btrim(official_version_label), '\\s+', ' ', 'g')))::text
)
where identity_key like '["mmv-current:v1"%';

create or replace function public.apply_catalog_mmvs(
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
  reconciliation_item jsonb;
  observation jsonb;
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
  v_fipe_code text;
  v_source_kind text;
  v_source_url text;
  v_model_label text;
  v_reference_period text;
  v_model_year integer;
  v_confidence numeric;
  v_mapping_status text;
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

    if jsonb_typeof(f.payload->'marketReconciliation') = 'array' then
      for reconciliation_item in
        select value
        from jsonb_array_elements(f.payload->'marketReconciliation')
        where lower(btrim(value->>'manufacturerVersionLabel')) = lower(btrim(v_version))
      loop
        if jsonb_typeof(reconciliation_item->'observations') = 'array' then
          for observation in select value from jsonb_array_elements(reconciliation_item->'observations')
          loop
            v_fipe_code := observation->>'fipeCode';
            v_source_kind := observation->>'sourceKind';
            v_source_url := observation->>'sourceUrl';
            v_model_label := observation->>'modelLabel';
            v_reference_period := nullif(btrim(observation->>'referencePeriod'), '');
            v_model_year := case
              when observation->>'modelYear' is null then null
              else (observation->>'modelYear')::integer
            end;
            v_confidence := coalesce((observation->>'confidence')::numeric, 0);
            v_mapping_status := case when v_source_kind = 'FIPE' then 'CONFIRMED' else 'CANDIDATE' end;

            if v_fipe_code ~ '^[0-9]{6}-[0-9]$'
              and v_source_kind in ('FIPE','SECONDARY')
              and coalesce(length(btrim(v_source_url)),0) between 1 and 2048
              and coalesce(length(btrim(v_model_label)),0) between 1 and 300
              and v_confidence between 0 and 1
            then
              insert into public.catalog_mmv_fipe_mappings (
                mmv_id, fipe_code, fipe_model_label, model_year_hint,
                reference_period, source_kind, source_url, confidence, status,
                source_finding_id, reviewed_by, confirmed_at
              )
              values (
                existing.id, v_fipe_code, btrim(v_model_label), v_model_year,
                v_reference_period, v_source_kind, btrim(v_source_url), v_confidence,
                v_mapping_status, f.id,
                case when v_mapping_status = 'CONFIRMED' then p_actor else null end,
                case when v_mapping_status = 'CONFIRMED' then now() else null end
              )
              on conflict (mmv_id, fipe_code) do update
                set fipe_model_label = excluded.fipe_model_label,
                    model_year_hint = excluded.model_year_hint,
                    reference_period = excluded.reference_period,
                    source_kind = excluded.source_kind,
                    source_url = excluded.source_url,
                    confidence = greatest(public.catalog_mmv_fipe_mappings.confidence, excluded.confidence),
                    status = case
                      when public.catalog_mmv_fipe_mappings.status = 'CONFIRMED' then 'CONFIRMED'
                      else excluded.status
                    end,
                    source_finding_id = excluded.source_finding_id,
                    reviewed_by = case
                      when excluded.status = 'CONFIRMED' then p_actor
                      else public.catalog_mmv_fipe_mappings.reviewed_by
                    end,
                    confirmed_at = case
                      when excluded.status = 'CONFIRMED' then coalesce(public.catalog_mmv_fipe_mappings.confirmed_at, now())
                      else public.catalog_mmv_fipe_mappings.confirmed_at
                    end,
                    updated_at = now();
            end if;
          end loop;
        end if;
      end loop;
    end if;

    return next existing;
  end loop;

  return;
end;
$$;

revoke all on function public.apply_catalog_mmvs(uuid, uuid, jsonb, text)
from public, anon, authenticated;
grant execute on function public.apply_catalog_mmvs(uuid, uuid, jsonb, text) to service_role;

-- Backfill already-applied QA MMVs from their source findings.
insert into public.catalog_mmv_fipe_mappings (
  mmv_id, fipe_code, fipe_model_label, model_year_hint,
  reference_period, source_kind, source_url, confidence, status,
  source_finding_id, reviewed_by, confirmed_at
)
select
  m.id,
  o->>'fipeCode',
  o->>'modelLabel',
  case when o->>'modelYear' is null then null else (o->>'modelYear')::integer end,
  nullif(btrim(o->>'referencePeriod'),''),
  o->>'sourceKind',
  o->>'sourceUrl',
  coalesce((o->>'confidence')::numeric,0),
  case when o->>'sourceKind' = 'FIPE' then 'CONFIRMED' else 'CANDIDATE' end,
  f.id,
  case when o->>'sourceKind' = 'FIPE' then m.created_by else null end,
  case when o->>'sourceKind' = 'FIPE' then now() else null end
from public.catalog_mmvs m
join public.agent_findings f on f.id = m.source_finding_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(f.payload->'marketReconciliation')='array'
    then f.payload->'marketReconciliation' else '[]'::jsonb end
) mr
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(mr->'observations')='array'
    then mr->'observations' else '[]'::jsonb end
) o
where lower(btrim(mr->>'manufacturerVersionLabel')) = lower(btrim(m.official_version_label))
  and (o->>'fipeCode') ~ '^[0-9]{6}-[0-9]$'
  and (o->>'sourceKind') in ('FIPE','SECONDARY')
on conflict (mmv_id, fipe_code) do nothing;
