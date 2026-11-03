CREATE OR REPLACE VIEW public.agent_fipe_unmapped_mmvs AS
SELECT m.id AS mmv_id,m.market,m.brand,m.model,m.official_version_label,m.status,
       count(map.id) FILTER(WHERE map.status='CONFIRMED')::integer AS confirmed_fipe_codes
FROM public.catalog_mmvs m
LEFT JOIN public.catalog_mmv_fipe_mappings map ON map.mmv_id=m.id
WHERE m.status='ACTIVE'
GROUP BY m.id,m.market,m.brand,m.model,m.official_version_label,m.status
HAVING count(map.id) FILTER(WHERE map.status='CONFIRMED')=0;
CREATE OR REPLACE VIEW public.agent_fipe_valuation_monthly AS
SELECT h.fipe_code,h.model_year,h.fuel_code,h.reference_year,h.reference_month,
       h.valuation_brl,h.source_provider,h.source_url,h.fetched_at,
       m.mmv_id,m.status AS mapping_status
FROM public.agent_fipe_valuation_history h
LEFT JOIN public.catalog_mmv_fipe_mappings m
  ON m.fipe_code=h.fipe_code AND m.status='CONFIRMED';
REVOKE ALL ON public.agent_fipe_unmapped_mmvs FROM anon,authenticated;
REVOKE ALL ON public.agent_fipe_valuation_monthly FROM anon,authenticated;
GRANT SELECT ON public.agent_fipe_unmapped_mmvs TO service_role;
GRANT SELECT ON public.agent_fipe_valuation_monthly TO service_role;