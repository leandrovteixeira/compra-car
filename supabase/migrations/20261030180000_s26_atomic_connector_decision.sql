CREATE OR REPLACE FUNCTION public.s26_decide_connector(
 p_finding uuid,p_fingerprint text,p_decision text,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE f public.agent_findings; r public.agent_runs; target public.brand_connector_targets; active public.brand_connectors; latest text;
BEGIN
 IF p_actor IS NULL OR p_decision NOT IN ('ACCEPT','REJECT','DEFER') THEN
 RAISE EXCEPTION 'INVALID_CONNECTOR_DECISION'; END IF;
 SELECT * INTO f FROM public.agent_findings WHERE id=p_finding FOR UPDATE;
 IF NOT FOUND OR f.fingerprint IS DISTINCT FROM p_fingerprint
    OR f.finding_type NOT IN ('NEW_BRAND_CONNECTOR','CONNECTOR_DRIFT')
    OR f.proposal IS NULL
 THEN RAISE EXCEPTION 'STALE_CONNECTOR_FINDING'; END IF;
 SELECT * INTO r FROM public.agent_runs WHERE id=f.run_id;
 IF r.agent_type IS DISTINCT FROM 'BRAND_CONNECTOR' OR r.status IS DISTINCT FROM 'COMPLETED'
 THEN RAISE EXCEPTION 'INVALID_CONNECTOR_RUN'; END IF;
 SELECT * INTO target FROM public.brand_connector_targets t
 WHERE t.market=f.subject->>'market' AND lower(btrim(t.brand))=lower(btrim(f.subject->>'brand'))
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONNECTOR_TARGET_NOT_FOUND'; END IF;
 SELECT ar.decision INTO latest FROM public.agent_reviews ar
 WHERE ar.finding_id=f.id ORDER BY ar.created_at DESC,ar.id DESC LIMIT 1;
 IF latest IS DISTINCT FROM p_decision THEN
 INSERT INTO public.agent_reviews(finding_id,decision,note,reviewed_by)
 VALUES(f.id,p_decision,'Revisão individual na fila de agentes',p_actor);
 END IF;
 IF p_decision='ACCEPT' THEN
   SELECT * INTO active FROM public.activate_brand_connector(f.id,p_actor,target.id,
       f.proposal,f.payload->>'connectorFingerprint');
   RETURN jsonb_build_object('decision',p_decision,'connectorId',active.id,'version',active.version);
 END IF;
 RETURN jsonb_build_object('decision',p_decision);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s26_decide_connector(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;