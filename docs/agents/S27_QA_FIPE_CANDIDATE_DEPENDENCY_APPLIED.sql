-- Applied to Compra Car Staging on 2026-11-05
-- Migration: s27_qa_fipe_candidate_dependency_intake
-- QA only. Do not apply to Production without release review.
-- This creates *eligibility nodes*, never approves FIPE mappings.
create or replace function public.s27_prepare_fipe_candidate_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_active boolean; v_conflict boolean;
begin
  select exists(select 1 from public.catalog_mmvs m
    where m.id=new.mmv_id and m.market='BR' and m.status='ACTIVE')
    into v_active;
  select exists(select 1 from public.catalog_mmv_fipe_mappings map
    where map.mmv_id=new.mmv_id and map.status='CONFIRMED'
    and map.fipe_code<>new.fipe_code) into v_conflict;
  insert into public.agent_dependency_nodes(node_key,entity_kind,entity_ref,state)
  values ('fipe-candidate:'||new.id::text,'FIPE_MAPPING',new.id::text,
    case when new.decision in ('PENDING','DEFER')
      and v_active and not v_conflict
      then 'READY' else 'BLOCKED' end)
  on conflict(node_key) do nothing;
  return new;
end;
$$;
drop trigger if exists s27_prepare_fipe_candidate_dependency_insert
  on public.agent_fipe_mapping_candidates;
create trigger s27_prepare_fipe_candidate_dependency_insert
  after insert on public.agent_fipe_mapping_candidates
  for each row execute function public.s27_prepare_fipe_candidate_dependency();

insert into public.agent_dependency_nodes(node_key,entity_kind,entity_ref,state)
select 'fipe-candidate:'||c.id::text,'FIPE_MAPPING',c.id::text,
  case when c.decision in ('PENDING','DEFER') and m.status='ACTIVE'
    and m.market='BR'
    and not exists(select 1 from public.catalog_mmv_fipe_mappings p
      where p.mmv_id=c.mmv_id and p.status='CONFIRMED'
      and p.fipe_code<>c.fipe_code)
    then 'READY' else 'BLOCKED' end
from public.agent_fipe_mapping_candidates c
join public.catalog_mmvs m on m.id=c.mmv_id
where not exists(select 1 from public.agent_dependency_nodes n
  where n.node_key='fipe-candidate:'||c.id::text)
on conflict(node_key) do nothing;

-- QA verification:
-- FIPE 003500-9 / Ranger XLS 3.0 V6: PENDING, node READY.
-- FIPE 003293-0 / historical Ranger: REJECT, node BLOCKED.
