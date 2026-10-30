CREATE OR REPLACE FUNCTION public.s26_decide_mmv_identity(
 p_finding uuid,p_identity_key text,p_fingerprint text,p_decision text,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE f public.agent_findings; candidate jsonb; applied public.catalog_mmvs; latest public.agent_mmv_identity_reviews;
BEGIN
 IF p_decision NOT IN ('ACCEPT','REJECT','DEFER') OR p_actor IS NULL
 THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 SELECT * INTO f FROM public.agent_findings WHERE id=p_finding FOR UPDATE;
 IF NOT FOUND OR f.fingerprint IS DISTINCT FROM p_fingerprint
 OR f.finding_type NOT IN ('NEW_MODEL','NEW_VERSION')
 OR f.proposal->>'action' IS DISTINCT FROM 'STAGE_MMV_IDENTITIES'
 THEN RAISE EXCEPTION 'STALE_FINDING'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(f.proposal->'identities') x
 WHERE x->>'identityKey'=p_identity_key)<>1
 THEN RAISE EXCEPTION 'IDENTITY_NOT_FOUND'; END IF;
 SELECT * INTO latest FROM public.agent_mmv_identity_reviews
 WHERE finding_id=p_finding AND identity_key=p_identity_key
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF latest.decision=p_decision AND latest.finding_fingerprint=p_fingerprint THEN
   IF p_decision='ACCEPT' THEN
      SELECT * INTO applied FROM public.s26_apply_approved_mmv_identity(p_finding,p_identity_key);
      RETURN jsonb_build_object('decision',p_decision,'mmvId',applied.id,'idempotent',true);
   END IF;
   RETURN jsonb_build_object('decision',p_decision,'idempotent',true);
 END IF;
 INSERT INTO public.agent_mmv_identity_reviews(finding_id,identity_key,finding_fingerprint,decision,reviewed_by)
 VALUES(p_finding,p_identity_key,p_fingerprint,p_decision,p_actor);
 IF p_decision='ACCEPT' THEN
   SELECT * INTO applied FROM public.s26_apply_approved_mmv_identity(p_finding,p_identity_key);
   RETURN jsonb_build_object('decision',p_decision,'mmvId',applied.id,'idempotent',false);
 END IF;
 RETURN jsonb_build_object('decision',p_decision,'idempotent',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.s26_decide_mmv_identity(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;