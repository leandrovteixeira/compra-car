CREATE OR REPLACE FUNCTION public.s26_decide_fipe_candidate(p_candidate uuid,p_decision text,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE c public.agent_fipe_mapping_candidates; n public.agent_dependency_nodes;
BEGIN
 IF p_actor IS NULL OR p_decision NOT IN ('ACCEPT','REJECT','DEFER') THEN RAISE EXCEPTION 'INVALID_FIPE_DECISION'; END IF;
 SELECT * INTO c FROM public.agent_fipe_mapping_candidates WHERE id=p_candidate FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FIPE_CANDIDATE_MISSING'; END IF;
 SELECT * INTO n FROM public.agent_dependency_nodes WHERE node_key='fipe-candidate:'||c.id FOR UPDATE;
 IF p_decision='ACCEPT' AND (n.state IS DISTINCT FROM 'READY' AND n.state IS DISTINCT FROM 'APPLIED')
 THEN RAISE EXCEPTION 'FIPE_DEPENDENCY_NOT_READY'; END IF;
 IF c.decision='ACCEPT' AND p_decision<>'ACCEPT' THEN RAISE EXCEPTION 'FIPE_ALREADY_APPLIED'; END IF;
 IF c.decision IS DISTINCT FROM p_decision THEN
  UPDATE public.agent_fipe_mapping_candidates SET decision=p_decision,reviewed_by=p_actor,reviewed_at=now() WHERE id=c.id;
 END IF;
 IF p_decision='ACCEPT' THEN
  IF EXISTS(SELECT 1 FROM public.catalog_mmv_fipe_mappings m WHERE m.mmv_id=c.mmv_id AND m.status='CONFIRMED' AND m.fipe_code<>c.fipe_code)
  THEN RAISE EXCEPTION 'FIPE_EXISTING_CANONICAL_CONFLICT'; END IF;
  INSERT INTO public.catalog_mmv_fipe_mappings
   (mmv_id,fipe_code,fipe_model_label,source_kind,source_url,confidence,status,reviewed_by,confirmed_at)
  VALUES(c.mmv_id,c.fipe_code,c.fipe_model_label,'SECONDARY',c.source_url,c.match_confidence,'CONFIRMED',p_actor,now())
  ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_mmv_fipe_mappings m WHERE m.mmv_id=c.mmv_id AND m.fipe_code=c.fipe_code AND m.status='CONFIRMED')
  THEN RAISE EXCEPTION 'FIPE_MAPPING_NOT_PERSISTED'; END IF;
  UPDATE public.agent_dependency_nodes SET state='APPLIED',revision=revision+1,updated_at=now()
  WHERE node_key='fipe-candidate:'||c.id AND state<>'APPLIED';
  INSERT INTO public.agent_dependency_events(event_key,node_key,event_type,payload)
   VALUES('fipe-applied:'||c.id,'fipe-candidate:'||c.id,'CANONICAL_APPLIED',
     jsonb_build_object('mmvId',c.mmv_id,'fipeCode',c.fipe_code))
   ON CONFLICT(event_key) DO NOTHING;
 ELSE
  UPDATE public.agent_dependency_nodes SET state='BLOCKED',revision=revision+1,updated_at=now()
  WHERE node_key='fipe-candidate:'||c.id AND state<>'BLOCKED';
 END IF;
 RETURN jsonb_build_object('decision',p_decision,'mmvId',c.mmv_id,'fipeCode',c.fipe_code);
END $$;
REVOKE ALL ON FUNCTION public.s26_decide_fipe_candidate(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s26_decide_fipe_candidate(uuid,text,uuid) TO service_role;