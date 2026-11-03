ALTER TABLE public.agent_jobs DROP CONSTRAINT agent_jobs_job_type_check;
ALTER TABLE public.agent_jobs ADD CONSTRAINT agent_jobs_job_type_check
CHECK (job_type = ANY(ARRAY['MMV_DISCOVERY','BRAND_CONNECTOR','SOURCE_MONITOR','PRODUCT_YEAR','PRICE_INTELLIGENCE','FIPE_DISCOVERY']));
