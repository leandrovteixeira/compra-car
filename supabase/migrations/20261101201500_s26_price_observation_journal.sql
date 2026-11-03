-- QA-only rollout. Immutable verification history, not a public-price catalog.
CREATE TABLE IF NOT EXISTS public.agent_price_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES public.agent_runs(id),
 product_id bigint NOT NULL,
 market text NOT NULL DEFAULT 'BR',
 brand text NOT NULL,
 model_year integer NOT NULL,
 source_url text NOT NULL,
 source_fingerprint text NOT NULL,
 amount_brl numeric(14,2),
 state text NOT NULL CHECK (state IN ('not_found','unchanged','new_price')),
 evidence_excerpt text,
 confidence numeric(5,4),
 observed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,product_id,source_url)
);
CREATE INDEX IF NOT EXISTS agent_price_observations_latest_idx
 ON public.agent_price_observations(product_id,observed_at DESC);
ALTER TABLE public.agent_price_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_price_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.agent_price_observations TO service_role;
