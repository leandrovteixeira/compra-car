-- Explicit paid Price pilot entry point, separate from deterministic default.
-- Apply in QA only after the updated worker and dedicated secret are deployed.
CREATE OR REPLACE FUNCTION public.enqueue_price_agent_ai_job(
 p_brand text, p_created_by uuid DEFAULT NULL
) RETURNS public.agent_jobs
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $$
DECLARE result public.agent_jobs;
        b text := btrim(coalesce(p_brand,''));
BEGIN
 IF length(b) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'PRICE_JOB_INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('S26_PRICE:BR:'||upper(b),0));
 SELECT * INTO result FROM public.agent_jobs
 WHERE job_type='PRICE_INTELLIGENCE' AND market='BR' AND upper(brand)=upper(b)
 AND status IN ('QUEUED','RUNNING') ORDER BY created_at DESC,id DESC LIMIT 1;
 IF FOUND THEN
   IF result.input->>'provider'<>'openai' THEN
     RAISE EXCEPTION 'PRICE_JOB_ALREADY_ACTIVE';
   END IF;
   RETURN result;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_spend_budgets
    WHERE budget_key='qa:BR:'||upper(b)||':PRICE_INTELLIGENCE'
      AND cap_usd>reserved_usd) THEN
   RAISE EXCEPTION 'COST_BUDGET_NOT_CONFIGURED_OR_EXHAUSTED';
 END IF;
 INSERT INTO public.agent_jobs(job_type,status,market,brand,input,created_by)
 VALUES ('PRICE_INTELLIGENCE','QUEUED','BR',b,
 jsonb_build_object('provider','openai','persistFindings',true,
 'reason','S26_PRICE_AI_QA_PILOT','maxCostUsd',2),p_created_by)
 RETURNING * INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_price_agent_ai_job(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_price_agent_ai_job(text,uuid) TO service_role;
