DO $do$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.apply_catalog_mmv_model_year(uuid,uuid,jsonb,text)'::regprocedure) INTO body;
 IF position('p.version = mmv.official_version_label' in body)=0 OR
    position('select mmv.brand, mmv.model, mmv.official_version_label,' in body)=0
 THEN RAISE EXCEPTION 'MODEL_YEAR_FUNCTION_CONTRACT_CHANGED'; END IF;
 body := replace(body, 'p.version = mmv.official_version_label',
   'p.version = coalesce(mmv.official_version_label, '''')');
 body := replace(body,
   'select mmv.brand, mmv.model, mmv.official_version_label,',
   'select mmv.brand, mmv.model, coalesce(mmv.official_version_label, ''''),');
 EXECUTE body;
END
$do$;
CREATE OR REPLACE FUNCTION public.s26_decide_model_year(
 p_finding uuid,p_fingerprint text,p_decision text,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE f public.agent_findings; r public.agent_runs; existing_decision text; applied public.catalog_mmv_model_years;
BEGIN
 IF p_actor IS NULL OR p_decision NOT IN ('ACCEPT','REJECT','DEFER')
 THEN RAISE EXCEPTION 'INVALID_MY_DECISION'; END IF;
 SELECT * INTO f FROM public.agent_findings WHERE id=p_finding FOR UPDATE;
 IF NOT FOUND OR f.fingerprint IS DISTINCT FROM p_fingerprint
 OR f.finding_type IS DISTINCT FROM 'NEW_PRODUCT_YEAR'
 THEN RAISE EXCEPTION 'STALE_MY_FINDING'; END IF;
 SELECT * INTO r FROM public.agent_runs WHERE id=f.run_id;
 IF r.agent_type IS DISTINCT FROM 'PRODUCT_YEAR' OR r.status IS DISTINCT FROM 'COMPLETED'
 THEN RAISE EXCEPTION 'INVALID_MY_RUN'; END IF;
 IF p_decision='ACCEPT' AND (f.proposal IS NULL OR f.proposal->>'action' IS DISTINCT FROM 'STAGE_PRODUCT_YEAR')
 THEN RAISE EXCEPTION 'INVALID_MY_PROPOSAL'; END IF;
 SELECT decision INTO existing_decision FROM public.agent_reviews
 WHERE finding_id=f.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF existing_decision IS DISTINCT FROM p_decision THEN
 INSERT INTO public.agent_reviews(finding_id,decision,note,reviewed_by)
 VALUES(f.id,p_decision,'Revisão na fila de agentes (aplicação atômica)',p_actor);
 END IF;
 IF p_decision='ACCEPT' THEN
   SELECT * INTO applied FROM public.apply_catalog_mmv_model_year(
     f.id,p_actor,f.proposal,f.fingerprint);
   IF applied.id IS NULL THEN RAISE EXCEPTION 'MY_APPLY_NO_RESULT'; END IF;
   RETURN jsonb_build_object('decision',p_decision,'modelYearId',applied.id,
     'modelYear',applied.model_year,'productionYear',applied.production_year);
 END IF;
 RETURN jsonb_build_object('decision',p_decision);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s26_decide_model_year(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;