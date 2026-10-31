CREATE TABLE IF NOT EXISTS public.agent_fipe_model_year_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mmv_id uuid NOT NULL REFERENCES public.catalog_mmvs(id),
 fipe_code text NOT NULL,
 model_year smallint NOT NULL CHECK(model_year BETWEEN 2001 AND 2100),
 reference_year smallint NOT NULL,
 reference_month smallint NOT NULL CHECK(reference_month BETWEEN 1 AND 12),
 source_url text NOT NULL,
 valuation_brl numeric(15,2),
 decision text NOT NULL DEFAULT 'PENDING' CHECK(decision IN ('PENDING','ACCEPT','REJECT','DEFER')),
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(mmv_id,model_year)
);
CREATE INDEX IF NOT EXISTS agent_fipe_my_review_idx ON public.agent_fipe_model_year_candidates(decision,created_at DESC);
ALTER TABLE public.agent_fipe_model_year_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_fipe_model_year_candidates FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agent_fipe_model_year_candidates TO service_role;
CREATE OR REPLACE FUNCTION public.s26_stage_fipe_model_years()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE inserted_count integer;
BEGIN
 INSERT INTO public.agent_fipe_model_year_candidates
  (mmv_id,fipe_code,model_year,reference_year,reference_month,source_url,valuation_brl)
 SELECT DISTINCT ON (m.mmv_id,v.model_year)
   m.mmv_id,m.fipe_code,v.model_year,v.reference_year,v.reference_month,v.source_url,v.valuation_brl
 FROM public.catalog_mmv_fipe_mappings m
 JOIN public.agent_fipe_valuation_history v ON v.fipe_code=m.fipe_code
 WHERE m.status='CONFIRMED' AND v.model_year BETWEEN 2001 AND 2100
   AND NOT EXISTS (SELECT 1 FROM public.catalog_mmv_model_years y
     WHERE y.mmv_id=m.mmv_id AND y.model_year=v.model_year)
 ORDER BY m.mmv_id,v.model_year,v.reference_year DESC,v.reference_month DESC
 ON CONFLICT (mmv_id,model_year) DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.s26_stage_fipe_model_years() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s26_stage_fipe_model_years() TO service_role;