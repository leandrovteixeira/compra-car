-- Sprint 26 QA: dormant, service_role-only atomic decision RPC.
-- Not called by any UI, cron or worker. Requires independently validated case records.
CREATE FUNCTION public.s26_commit_agent_decision(
 p_case_id uuid,p_expected_revision bigint,p_expected_fingerprint text,
 p_action text,p_actor uuid,p_idempotency_key text,
 p_canonical_target uuid DEFAULT NULL,p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 c public.agent_review_cases;
 f public.agent_findings;
 r public.agent_runs;
 b public.brand_connector_targets;
 m public.catalog_mmvs;
 prior public.agent_decision_events;
 v_review text;
 v_status text;
 v_event uuid;
 v_effect jsonb := '{}'::jsonb;
 v_brand text;
 v_model text;
 v_version text;
 v_powertrain text;
 v_brand_key text;
 v_model_key text;
 v_alias_key text;
 v_existing uuid;
 v_active_id uuid;
 v_brand_canonical text;
BEGIN
 IF p_case_id IS NULL OR p_actor IS NULL OR p_expected_revision IS NULL
   OR p_expected_revision < 1 OR length(coalesce(p_expected_fingerprint,''))<1
   OR p_action NOT IN ('APPROVE','MERGE','REJECT','POSTPONE')
   OR length(btrim(coalesce(p_idempotency_key,''))) NOT BETWEEN 6 AND 160
   OR length(coalesce(p_note,''))>4000
 THEN RAISE EXCEPTION 'S26_INVALID_DECISION'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_case_id::text,26));

 SELECT * INTO prior FROM public.agent_decision_events
 WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF prior.case_id<>p_case_id OR prior.action<>p_action
     OR prior.prior_case_revision<>p_expected_revision
     OR prior.snapshot_fingerprint<>p_expected_fingerprint
     OR prior.actor_id<>p_actor OR prior.note IS DISTINCT FROM p_note
     OR prior.canonical_target_ref IS DISTINCT FROM
       (CASE WHEN p_action='MERGE' THEN p_canonical_target::text ELSE NULL END)
   THEN RAISE EXCEPTION 'S26_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN pg_catalog.jsonb_build_object(
     'id',prior.id,'action',prior.action,'status',prior.resulting_status,
     'effect',prior.effect_receipt,'replayed',true);
 END IF;

 SELECT * INTO c FROM public.agent_review_cases WHERE id=p_case_id FOR UPDATE;
 IF NOT FOUND OR c.source_kind<>'AGENT_PLATFORM'
   OR c.status NOT IN('WAITING','POSTPONED')
   OR c.revision<>p_expected_revision
   OR c.source_snapshot_fingerprint IS DISTINCT FROM p_expected_fingerprint
 THEN RAISE EXCEPTION 'S26_STALE_OR_UNSUPPORTED_CASE'; END IF;
 SELECT * INTO f FROM public.agent_findings WHERE id=c.source_ref::uuid;
 IF NOT FOUND OR f.fingerprint IS DISTINCT FROM p_expected_fingerprint
   OR f.requires_review IS NOT TRUE
 THEN RAISE EXCEPTION 'S26_FINDING_CHANGED'; END IF;
 SELECT * INTO r FROM public.agent_runs WHERE id=f.run_id;
 IF NOT FOUND OR r.status<>'COMPLETED'
 THEN RAISE EXCEPTION 'S26_RUN_NOT_COMPLETED'; END IF;

 -- A later completed observation of the same subject supersedes this case.
 IF EXISTS (
   SELECT 1 FROM public.agent_findings newer
   JOIN public.agent_runs nr ON nr.id=newer.run_id
   WHERE newer.id<>f.id AND newer.created_at>f.created_at
     AND newer.subject_key IS NOT DISTINCT FROM f.subject_key
     AND newer.finding_type=f.finding_type
     AND nr.agent_type=r.agent_type AND nr.status='COMPLETED'
 ) THEN RAISE EXCEPTION 'S26_SUPERSEDED_FINDING'; END IF;

 IF p_action<>'MERGE' AND p_canonical_target IS NOT NULL
 THEN RAISE EXCEPTION 'S26_UNEXPECTED_TARGET'; END IF;
 IF p_action='MERGE' AND p_canonical_target IS NULL
 THEN RAISE EXCEPTION 'S26_TARGET_REQUIRED'; END IF;

 v_review := CASE p_action WHEN 'REJECT' THEN 'REJECT'
             WHEN 'POSTPONE' THEN 'DEFER' ELSE 'ACCEPT' END;
 v_status := CASE p_action WHEN 'REJECT' THEN 'REJECTED'
             WHEN 'POSTPONE' THEN 'POSTPONED' ELSE 'APPROVED' END;

 IF p_action='APPROVE' THEN
   IF r.agent_type='BRAND_CONNECTOR' AND
     f.finding_type IN ('NEW_BRAND_CONNECTOR','CONNECTOR_DRIFT') AND
     c.case_kind IN('CONNECTOR_NEW','CONNECTOR_UPDATE') AND f.proposal IS NOT NULL THEN
     SELECT * INTO b FROM public.brand_connector_targets
       WHERE market=f.subject->>'market'
         AND lower(btrim(brand))=lower(btrim(f.subject->>'brand')) FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'S26_CONNECTOR_TARGET_MISSING'; END IF;
     v_brand_canonical:=nullif(btrim(f.payload->>'canonicalBrand'),'');
     IF v_brand_canonical IS NULL THEN RAISE EXCEPTION 'S26_BRAND_MISSING'; END IF;
     IF EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(
         coalesce(f.payload->'aliases','[]'::jsonb)) a
       JOIN public.brand_aliases ba
         ON ba.market=b.market AND ba.alias_key=lower(btrim(a.value->>'alias'))
       JOIN public.brand_identities bi ON bi.id=ba.brand_identity_id
       WHERE bi.canonical_key<>lower(v_brand_canonical)
     ) THEN RAISE EXCEPTION 'S26_BRAND_ALIAS_COLLISION'; END IF;
     INSERT INTO public.agent_reviews(id,finding_id,decision,note,reviewed_by)
       VALUES(pg_catalog.gen_random_uuid(),f.id,v_review,p_note,p_actor);
     SELECT pg_catalog.jsonb_build_object('connectorId',x.id,'targetId',x.target_id)
       INTO v_effect FROM public.activate_brand_connector(
         f.id,p_actor,b.id,f.proposal,f.payload->>'connectorFingerprint') x;
     IF v_effect IS NULL THEN RAISE EXCEPTION 'S26_CONNECTOR_APPLY_FAILED'; END IF;

   ELSIF r.agent_type='MMV_DISCOVERY' AND
      f.finding_type IN('NEW_MODEL','NEW_VERSION') AND c.case_kind='MMV_NEW'
      AND f.proposal IS NOT NULL THEN
     INSERT INTO public.agent_reviews(id,finding_id,decision,note,reviewed_by)
       VALUES(pg_catalog.gen_random_uuid(),f.id,v_review,p_note,p_actor);
     SELECT pg_catalog.jsonb_build_object(
       'mmvIds',coalesce(pg_catalog.jsonb_agg(x.id),'[]'::jsonb))
       INTO v_effect
       FROM public.apply_catalog_mmvs(f.id,p_actor,f.proposal,f.fingerprint) x;

   ELSIF r.agent_type='PRODUCT_YEAR' AND
      f.finding_type='NEW_PRODUCT_YEAR' AND c.case_kind='MODEL_YEAR_NEW'
      AND f.proposal IS NOT NULL THEN
     INSERT INTO public.agent_reviews(id,finding_id,decision,note,reviewed_by)
       VALUES(pg_catalog.gen_random_uuid(),f.id,v_review,p_note,p_actor);
     SELECT pg_catalog.jsonb_build_object(
       'yearIds',coalesce(pg_catalog.jsonb_agg(x.id),'[]'::jsonb))
       INTO v_effect FROM public.apply_catalog_mmv_model_year(
         f.id,p_actor,f.proposal,f.fingerprint) x;
   ELSE RAISE EXCEPTION 'S26_APPROVE_NOT_YET_SUPPORTED'; END IF;

 ELSIF p_action='MERGE' THEN
   IF c.case_kind<>'MMV_AMBIGUOUS' OR NOT (
     (r.agent_type='MMV_DISCOVERY' AND f.finding_type='AMBIGUOUS_MMV') OR
     (r.agent_type='PRODUCT_YEAR' AND f.finding_type='POSSIBLE_NEW_MMV')
   ) THEN RAISE EXCEPTION 'S26_MERGE_NOT_YET_SUPPORTED'; END IF;
   SELECT * INTO m FROM public.catalog_mmvs
     WHERE id=p_canonical_target AND market=r.market AND status='ACTIVE' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'S26_MMV_TARGET_UNAVAILABLE'; END IF;

   v_brand:=coalesce(nullif(btrim(f.subject->>'brand'),''),
     nullif(btrim(f.payload->'structuredCandidate'->>'brand'),''));
   v_model:=coalesce(nullif(btrim(f.subject->>'model'),''),
     nullif(btrim(f.payload->'structuredCandidate'->>'model'),''));
   v_version:=coalesce(nullif(btrim(f.subject->>'officialVersionLabel'),''),
     nullif(btrim(f.payload->'structuredCandidate'->>'officialVersionLabel'),''),
     nullif(btrim(f.payload->'structuredCandidate'->>'trim'),''));
   v_powertrain:=nullif(btrim(f.payload->'structuredCandidate'->>'powertrainLabel'),'');
   IF v_brand IS NULL OR v_model IS NULL OR v_version IS NULL OR
      length(v_brand)>120 OR length(v_model)>200 OR length(v_version)>200 OR
      lower(btrim(m.brand))<>lower(v_brand) OR
      lower(btrim(m.model))<>lower(v_model) OR
      (v_powertrain IS NOT NULL AND m.powertrain_label IS NOT NULL AND
        lower(btrim(m.powertrain_label))<>lower(v_powertrain))
   THEN RAISE EXCEPTION 'S26_INCOMPATIBLE_MMV_TARGET'; END IF;
   v_brand_key:=lower(btrim(pg_catalog.regexp_replace(
     public.unaccent(v_brand),'[^a-zA-Z0-9]+',' ','g')));
   v_model_key:=lower(btrim(pg_catalog.regexp_replace(
     public.unaccent(v_model),'[^a-zA-Z0-9]+',' ','g')));
   v_alias_key:=lower(btrim(pg_catalog.regexp_replace(
     public.unaccent(v_version),'[^a-zA-Z0-9]+',' ','g')));
   IF v_alias_key='' THEN RAISE EXCEPTION 'S26_INVALID_ALIAS'; END IF;

   SELECT canonical_mmv_id INTO v_existing FROM public.mmv_aliases
     WHERE status='CONFIRMED' AND market=m.market AND
       brand_key=v_brand_key AND model_key=v_model_key AND
       commercial_powertrain_key=coalesce(lower(btrim(v_powertrain)),'')
       AND alias_key=v_alias_key FOR UPDATE;
   IF FOUND AND v_existing<>m.id THEN RAISE EXCEPTION 'S26_ALIAS_COLLISION'; END IF;
   v_active_id:=m.id;
   v_effect:=pg_catalog.jsonb_build_object(
     'canonicalMmvId',m.id,'alias',v_version,'alreadyMapped',v_existing IS NOT NULL);
   INSERT INTO public.agent_reviews(id,finding_id,decision,note,reviewed_by)
     VALUES(pg_catalog.gen_random_uuid(),f.id,v_review,p_note,p_actor);

 ELSE
   INSERT INTO public.agent_reviews(id,finding_id,decision,note,reviewed_by)
     VALUES(pg_catalog.gen_random_uuid(),f.id,v_review,p_note,p_actor);
 END IF;

 INSERT INTO public.agent_decision_events(
   case_id,prior_case_revision,snapshot_fingerprint,action,resulting_status,
   actor_id,idempotency_key,canonical_kind,canonical_target_ref,effect_receipt,note)
 VALUES(
   c.id,c.revision,p_expected_fingerprint,p_action,v_status,
   p_actor,p_idempotency_key,
   CASE WHEN p_action='MERGE' THEN 'MMV' ELSE NULL END,
   CASE WHEN p_action='MERGE' THEN v_active_id::text ELSE NULL END,
   v_effect,p_note
 ) RETURNING id INTO v_event;
 IF p_action='MERGE' AND v_existing IS NULL THEN
   INSERT INTO public.mmv_aliases(
     market,brand_key,model_key,commercial_powertrain_key,alias,alias_key,
     canonical_mmv_id,decision_event_id,source_finding_id,source_reference)
   VALUES(m.market,v_brand_key,v_model_key,coalesce(lower(btrim(v_powertrain)),''),
     v_version,v_alias_key,m.id,v_event,f.id,f.id::text);
 END IF;
 UPDATE public.agent_review_cases
   SET status=v_status,revision=revision+1,updated_at=now()
   WHERE id=c.id AND revision=c.revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'S26_CASE_CONCURRENT_CHANGE'; END IF;
 RETURN pg_catalog.jsonb_build_object(
   'id',v_event,'action',p_action,'status',v_status,'effect',v_effect,'replayed',false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.s26_commit_agent_decision(
 uuid,bigint,text,text,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s26_commit_agent_decision(
 uuid,bigint,text,text,uuid,text,uuid,text) TO service_role;
