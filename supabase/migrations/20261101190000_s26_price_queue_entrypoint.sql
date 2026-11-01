-- Sprint 26C: guarded QA Price queue entrypoint. No automatic paid invocation.
-- The existing worker handles PRICE_INTELLIGENCE and persists findings for Reviews.
CREATE OR REPLACE FUNCTION public.enqueue_price_agent_job(
  p_brand text,
  p_created_by uuid DEFAULT NULL,
  p_reason text DEFAULT 'MANUAL_QA_PRICE_VALIDATION'
)
RETURNS public.agent_jobs
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $$
DECLARE
  result public.agent_jobs;
  normalized_brand text := btrim(coalesce(p_brand,''));
BEGIN
  IF length(normalized_brand) NOT BETWEEN 1 AND 100 OR
     length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 120
  THEN
    RAISE EXCEPTION 'PRICE_JOB_INVALID_INPUT';
  END IF;

  -- Serializes dispatch per brand, even when multiple operators submit at once.
  PERFORM pg_advisory_xact_lock(hashtextextended('S26_PRICE:BR:' || upper(normalized_brand), 0));

  SELECT * INTO result FROM public.agent_jobs
    WHERE job_type='PRICE_INTELLIGENCE' AND market='BR'
      AND upper(brand)=upper(normalized_brand)
      AND status IN ('QUEUED','RUNNING')
    ORDER BY created_at DESC,id DESC LIMIT 1;
  IF FOUND THEN RETURN result; END IF;

  INSERT INTO public.agent_jobs(job_type,status,market,brand,input,created_by)
  VALUES ('PRICE_INTELLIGENCE','QUEUED','BR',normalized_brand,
    jsonb_build_object('provider','deterministic-first',
      'persistFindings',true,'reason',btrim(p_reason)),
    p_created_by)
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_price_agent_job(text,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_price_agent_job(text,uuid,text)
  TO service_role;
