CREATE TABLE IF NOT EXISTS public.agent_my_benchmark_results(
 job_id uuid PRIMARY KEY REFERENCES public.agent_jobs(id),
 brand text NOT NULL,
 model text NOT NULL,
 version text NOT NULL,
 status text NOT NULL CHECK(status IN ('CONFIRMED','CONFLICT','UNKNOWN','ERROR')),
 detected_model_year integer,
 candidate_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
 evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
 input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0,
 web_search_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_my_benchmark_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_my_benchmark_results FROM public,anon,authenticated;
GRANT SELECT,INSERT ON public.agent_my_benchmark_results TO service_role;