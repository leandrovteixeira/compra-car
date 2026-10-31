create or replace view public.agent_my_launch_eligibility with (security_invoker=true) as
select m.id as mmv_id,m.brand,m.model,m.official_version_label,
 case
  when exists(select 1 from public.catalog_mmv_model_years y where y.mmv_id=m.id) then 'HAS_CANONICAL_MY'
  when exists(select 1 from public.agent_fipe_model_year_candidates y where y.mmv_id=m.id and y.decision in ('PENDING','ACCEPT','DEFER')) then 'FIPE_MY_PENDING'
  when exists(select 1 from public.catalog_mmv_fipe_mappings f join public.agent_fipe_valuation_history v on v.fipe_code=f.fipe_code where f.mmv_id=m.id and f.status='CONFIRMED' and v.model_year between 2001 and 2100) then 'FIPE_MY_AVAILABLE'
  when exists(select 1 from public.agent_fipe_mapping_candidates c where c.mmv_id=m.id and c.decision in ('PENDING','ACCEPT','DEFER')) then 'FIPE_MAPPING_PENDING'
  else 'ELIGIBLE'
 end as eligibility
from public.catalog_mmvs m where m.status='ACTIVE';
revoke all on public.agent_my_launch_eligibility from public,anon,authenticated;
grant select on public.agent_my_launch_eligibility to service_role;