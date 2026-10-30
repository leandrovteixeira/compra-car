-- Sprint 26 FIPE Agent: provider-neutral, append-only monthly valuation observations.
CREATE TABLE IF NOT EXISTS public.agent_fipe_valuation_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 fipe_code text NOT NULL CHECK (fipe_code ~ '^[0-9]{6}-[0-9]$'),
 model_year integer NOT NULL CHECK (model_year BETWEEN 1900 AND 32000),
 fuel_code text NOT NULL DEFAULT '',
 reference_year smallint NOT NULL CHECK (reference_year BETWEEN 1985 AND 2100),
 reference_month smallint NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
 valuation_brl numeric(15,2) NOT NULL CHECK (valuation_brl > 0),
 manufacturer_label text NOT NULL,
 fipe_model_label text NOT NULL,
 source_provider text NOT NULL,
 source_url text NOT NULL,
 source_reference_code text,
 fetched_at timestamptz NOT NULL DEFAULT now(),
 raw_payload jsonb,
 CONSTRAINT agent_fipe_valuation_month_unique UNIQUE (fipe_code,model_year,fuel_code,reference_year,reference_month,source_provider)
);
CREATE INDEX IF NOT EXISTS agent_fipe_valuation_code_history_idx
 ON public.agent_fipe_valuation_history(fipe_code,model_year,reference_year DESC,reference_month DESC);
CREATE TABLE IF NOT EXISTS public.agent_fipe_mapping_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mmv_id uuid NOT NULL REFERENCES public.catalog_mmvs(id),
 fipe_code text NOT NULL CHECK (fipe_code ~ '^[0-9]{6}-[0-9]$'),
 fipe_model_label text NOT NULL,
 provider text NOT NULL,
 source_url text NOT NULL,
 match_confidence numeric(5,4) NOT NULL CHECK (match_confidence BETWEEN 0 AND 1),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 decision text NOT NULL DEFAULT 'PENDING' CHECK (decision IN ('PENDING','ACCEPT','REJECT','DEFER')),
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(mmv_id,fipe_code,provider)
);
CREATE INDEX IF NOT EXISTS agent_fipe_mapping_candidates_review_idx
 ON public.agent_fipe_mapping_candidates(decision,created_at);
ALTER TABLE public.agent_fipe_valuation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_fipe_mapping_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_fipe_valuation_history FROM anon,authenticated;
REVOKE ALL ON public.agent_fipe_mapping_candidates FROM anon,authenticated;
GRANT SELECT,INSERT ON public.agent_fipe_valuation_history TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.agent_fipe_valuation_history_id_seq TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.agent_fipe_mapping_candidates TO service_role;